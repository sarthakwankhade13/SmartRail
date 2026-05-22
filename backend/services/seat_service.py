"""
Seat Service — business logic for Smart Seat Selection.

Handles:
- Coach/seat generation for any train number
- Smart recommendation scoring algorithm
- Seat booking
"""
import hashlib
from config.db import get_session
from models.seat import TrainCoach, Seat

# ── Coach templates per class ──────────────────────────────────────────────────

# Sleeper (SL): 8 bays × 8 seats = 72 seats
# Each bay: Lower(1), Middle(2), Upper(3), Lower(4), Middle(5), Upper(6), SideLower(7), SideUpper(8)
# 3A: same layout, 64 seats (8 bays × 8)
# 2A: 4 bays × 4 berths + 2 side = 46 seats
# 1A: 2 bays × 4 berths = 18 seats
# CC: 11 rows × 5 seats = 55 seats (window/aisle/middle)
# 2S: 12 rows × 6 seats = 72 seats

COACH_CONFIGS = {
    'SL': {'total': 72, 'bays': 9,  'type': 'berth'},
    '3A': {'total': 64, 'bays': 8,  'type': 'berth'},
    '2A': {'total': 46, 'bays': 6,  'type': 'berth'},
    '1A': {'total': 18, 'bays': 3,  'type': 'berth'},
    'CC': {'total': 78, 'rows': 13, 'type': 'chair'},
    '2S': {'total': 108,'rows': 18, 'type': 'chair'},
}

BERTH_TYPES = ['Lower', 'Middle', 'Upper', 'Lower', 'Middle', 'Upper', 'SideLower', 'SideUpper']
CHAIR_TYPES = ['Window', 'Aisle', 'Middle', 'Aisle', 'Window', 'Window', 'Aisle']


def _seeded_bool(seed_str, probability=0.3):
    """Deterministic boolean from seed — used to simulate bookings."""
    h = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % 100
    return h < int(probability * 100)


def _generate_coach_seats(coach: TrainCoach, seed_prefix: str) -> list:
    """Generate seat objects for a coach based on its type."""
    cfg = COACH_CONFIGS.get(coach.coach_type, COACH_CONFIGS['SL'])
    seats = []
    seat_num = 1

    if cfg['type'] == 'berth':
        bays = cfg['bays']
        for bay in range(1, bays + 1):
            is_first_bay = bay == 1
            is_last_bay  = bay == bays
            for pos, btype in enumerate(BERTH_TYPES):
                if seat_num > cfg['total']:
                    break
                # Side berths only in SL/3A/2A
                if btype in ('SideLower', 'SideUpper') and coach.coach_type == '1A':
                    continue

                near_window   = btype in ('Lower', 'SideLower') and (bay % 2 == 1)
                near_exit     = is_first_bay or is_last_bay
                near_washroom = is_first_bay

                is_booked = _seeded_bool(f"{seed_prefix}:{seat_num}", 0.35)

                seats.append(Seat(
                    coach_id      = coach.id,
                    seat_number   = seat_num,
                    seat_type     = btype,
                    is_booked     = is_booked,
                    position_x    = pos,
                    position_y    = bay - 1,
                    near_window   = near_window,
                    near_exit     = near_exit,
                    near_washroom = near_washroom,
                    bay_number    = bay,
                ))
                seat_num += 1

    else:  # chair car
        rows = cfg['rows']
        cols = 6 if coach.coach_type == '2S' else 5
        ctypes = CHAIR_TYPES[:cols]
        for row in range(rows):
            is_first_row = row == 0
            is_last_row  = row == rows - 1
            for col, ctype in enumerate(ctypes):
                if seat_num > cfg['total']:
                    break
                near_window   = ctype == 'Window'
                near_exit     = is_first_row or is_last_row
                near_washroom = is_first_row

                is_booked = _seeded_bool(f"{seed_prefix}:{seat_num}", 0.30)

                seats.append(Seat(
                    coach_id      = coach.id,
                    seat_number   = seat_num,
                    seat_type     = ctype,
                    is_booked     = is_booked,
                    position_x    = col,
                    position_y    = row,
                    near_window   = near_window,
                    near_exit     = near_exit,
                    near_washroom = near_washroom,
                    bay_number    = row + 1,
                ))
                seat_num += 1

    return seats


def _ensure_coaches_exist(train_number: str, session) -> list:
    """
    Return coaches for a train, generating them if they don't exist yet.
    Generates a realistic set of coaches based on train number pattern.
    """
    coaches = session.query(TrainCoach).filter_by(train_number=train_number).all()
    if coaches:
        return coaches

    # Determine coach mix from train number
    tn = str(train_number)
    if tn.startswith('1'):
        # Premium train: 1A + 2A + 3A + SL
        coach_plan = [
            ('A1', '1A'), ('B1', '2A'), ('B2', '2A'),
            ('C1', '3A'), ('C2', '3A'), ('C3', '3A'),
            ('S1', 'SL'), ('S2', 'SL'), ('S3', 'SL'), ('S4', 'SL'),
        ]
    elif tn.startswith('2'):
        coach_plan = [
            ('B1', '2A'), ('C1', '3A'), ('C2', '3A'),
            ('S1', 'SL'), ('S2', 'SL'), ('S3', 'SL'),
            ('D1', 'CC'), ('D2', 'CC'),
        ]
    else:
        coach_plan = [
            ('S1', 'SL'), ('S2', 'SL'), ('S3', 'SL'), ('S4', 'SL'),
            ('S5', 'SL'), ('D1', '2S'), ('D2', '2S'),
        ]

    new_coaches = []
    for order, (name, ctype) in enumerate(coach_plan, 1):
        cfg = COACH_CONFIGS.get(ctype, COACH_CONFIGS['SL'])
        coach = TrainCoach(
            train_number = train_number,
            coach_name   = name,
            coach_type   = ctype,
            total_seats  = cfg['total'],
            coach_order  = order,
        )
        session.add(coach)
        session.flush()  # get coach.id

        seed = f"{train_number}:{name}"
        for seat in _generate_coach_seats(coach, seed):
            session.add(seat)

        new_coaches.append(coach)

    session.commit()
    return new_coaches


# ── Public API ─────────────────────────────────────────────────────────────────

def get_coaches(train_number: str) -> list:
    """Return all coaches for a train (generates if missing)."""
    session = get_session()
    try:
        coaches = _ensure_coaches_exist(train_number, session)
        return [c.to_dict() for c in coaches]
    finally:
        session.close()


def get_coach_seats(train_number: str, coach_name: str) -> dict:
    """Return full seat map for one coach."""
    session = get_session()
    try:
        _ensure_coaches_exist(train_number, session)
        coach = session.query(TrainCoach).filter_by(
            train_number=train_number, coach_name=coach_name
        ).first()
        if not coach:
            return None
        seats = session.query(Seat).filter_by(coach_id=coach.id).order_by(Seat.seat_number).all()
        return {
            'coach': coach.to_dict(),
            'seats': [s.to_dict() for s in seats],
        }
    finally:
        session.close()


def recommend_seats(
    train_number: str,
    coach_name: str,
    passenger_count: int,
    preferences: list,          # e.g. ['window', 'lower', 'group', 'exit']
) -> dict:
    """
    Scoring-based seat recommendation.

    Scoring rules:
      +10  window preference matched
      +8   lower berth preference matched
      +6   group seats in same bay
      +5   near exit preference matched
      -5   near washroom (unless user wants it)
      +4   quiet zone (middle of coach, away from exits)
      +3   side lower preference
    """
    session = get_session()
    try:
        _ensure_coaches_exist(train_number, session)
        coach = session.query(TrainCoach).filter_by(
            train_number=train_number, coach_name=coach_name
        ).first()
        if not coach:
            return {'error': 'Coach not found'}

        available = session.query(Seat).filter_by(
            coach_id=coach.id, is_booked=False
        ).order_by(Seat.seat_number).all()

        if len(available) < passenger_count:
            return {'error': 'Not enough available seats', 'available': len(available)}

        prefs = [p.lower() for p in preferences]

        def score(seat: Seat) -> float:
            s = 0.0
            if 'window' in prefs and seat.near_window:
                s += 10
            if 'lower' in prefs and seat.seat_type in ('Lower', 'SideLower'):
                s += 8
            if 'side_lower' in prefs and seat.seat_type == 'SideLower':
                s += 6
            if 'upper' in prefs and seat.seat_type == 'Upper':
                s += 7
            if 'exit' in prefs and seat.near_exit:
                s += 5
            if 'quiet' in prefs and not seat.near_exit and not seat.near_washroom:
                s += 4
            if seat.near_washroom and 'washroom' not in prefs:
                s -= 5
            # Slight preference for lower seat numbers (front of coach)
            s -= seat.seat_number * 0.01
            return s

        scored = sorted(available, key=score, reverse=True)

        # For group seating: try to find passenger_count seats in same bay
        recommended = []
        if 'group' in prefs and passenger_count > 1:
            from collections import defaultdict
            bay_map = defaultdict(list)
            for seat in scored:
                bay_map[seat.bay_number].append(seat)
            # Find bay with most available seats
            best_bay = max(bay_map.items(), key=lambda x: len(x[1]))
            bay_seats = sorted(best_bay[1], key=score, reverse=True)
            recommended = bay_seats[:passenger_count]
            # If not enough in one bay, fill from top scored
            if len(recommended) < passenger_count:
                used_ids = {s.id for s in recommended}
                extras = [s for s in scored if s.id not in used_ids]
                recommended += extras[:passenger_count - len(recommended)]
        else:
            recommended = scored[:passenger_count]

        return {
            'recommended': [s.to_dict() for s in recommended],
            'totalAvailable': len(available),
            'preferences': prefs,
        }
    finally:
        session.close()


def book_seats(train_number: str, coach_name: str, seat_ids: list) -> dict:
    """Mark seats as booked."""
    session = get_session()
    try:
        _ensure_coaches_exist(train_number, session)
        coach = session.query(TrainCoach).filter_by(
            train_number=train_number, coach_name=coach_name
        ).first()
        if not coach:
            return {'error': 'Coach not found'}

        seats = session.query(Seat).filter(
            Seat.id.in_(seat_ids),
            Seat.coach_id == coach.id,
        ).all()

        already_booked = [s.seat_number for s in seats if s.is_booked]
        if already_booked:
            return {'error': f'Seats already booked: {already_booked}'}

        for seat in seats:
            seat.is_booked = True
        session.commit()

        return {
            'success': True,
            'bookedSeats': [s.to_dict() for s in seats],
            'message': f'{len(seats)} seat(s) booked successfully',
        }
    except Exception as e:
        session.rollback()
        return {'error': str(e)}
    finally:
        session.close()
