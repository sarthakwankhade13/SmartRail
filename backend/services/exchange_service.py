from config.db import get_session
from models.exchange import Passenger, ExchangeRequest, ExchangeMatch
from sqlalchemy import or_, and_
import random

# A simple map to infer "opposite" or compatible seat preferences for scoring
SEAT_COMPATIBILITY = {
    'Lower Berth': ['Upper Berth', 'Middle Berth', 'Side Upper'],
    'Upper Berth': ['Lower Berth', 'Side Lower'],
    'Middle Berth': ['Lower Berth', 'Side Lower'],
    'Side Lower': ['Side Upper', 'Upper Berth', 'Middle Berth'],
    'Side Upper': ['Side Lower', 'Lower Berth'],
    'Window Seat': ['Aisle Seat', 'Middle Seat'],
    'Aisle Seat': ['Window Seat'],
    'Middle Seat': ['Window Seat', 'Aisle Seat']
}

def get_or_create_passenger(pnr, name, age, gender, train, coach, seat):
    session = get_session()
    try:
        passenger = session.query(Passenger).filter_by(pnr_number=pnr).first()
        if not passenger:
            passenger = Passenger(
                name=name, age=age, gender=gender,
                pnr_number=pnr, train_number=train,
                coach_number=coach, seat_number=seat
            )
            session.add(passenger)
            session.commit()
            session.refresh(passenger)
        return passenger
    finally:
        session.close()

def create_exchange_request(passenger_id, current_seat_type, requested_seat_type):
    session = get_session()
    try:
        req = ExchangeRequest(
            passenger_id=passenger_id,
            current_seat_type=current_seat_type,
            requested_seat_type=requested_seat_type,
            status='PENDING'
        )
        session.add(req)
        session.commit()
        session.refresh(req)
        return req
    finally:
        session.close()

def calculate_match_score(req1, pass1, req2, pass2):
    """
    Intelligent Matching Logic Scoring:
    +10 if mutual seat preference matches exactly
    +8 if they are in the same coach
    +5 for senior citizen priority (if either is >60 and gets a Lower Berth)
    """
    score = 0
    
    # 1. Seat compatibility
    req1_wants = req1.requested_seat_type
    req2_has = req2.current_seat_type
    req2_wants = req2.requested_seat_type
    req1_has = req1.current_seat_type
    
    # Mutual exact match
    if req1_wants == req2_has and req2_wants == req1_has:
        score += 10
    else:
        # Partial compatibility (e.g., they want what the other generally considers okay to give up)
        comp_req1 = SEAT_COMPATIBILITY.get(req1_wants, [])
        if req2_has in comp_req1:
            score += 5
        comp_req2 = SEAT_COMPATIBILITY.get(req2_wants, [])
        if req1_has in comp_req2:
            score += 5
            
    # 2. Same coach
    if pass1.coach_number == pass2.coach_number:
        score += 8
        
    # 3. Same train (absolute requirement, but added just in case logic expands)
    if pass1.train_number != pass2.train_number:
        return 0 # Incompatible entirely
        
    # 4. Age priority
    if pass1.age > 60 and req1_wants == 'Lower Berth' and req2_has == 'Lower Berth':
        score += 5
    if pass2.age > 60 and req2_wants == 'Lower Berth' and req1_has == 'Lower Berth':
        score += 5
        
    return score

def find_matches_for_request(request_id):
    session = get_session()
    try:
        req1 = session.query(ExchangeRequest).filter_by(id=request_id).first()
        if not req1 or req1.status != 'PENDING':
            return []
            
        pass1 = req1.passenger
        
        # Find all other pending requests on the same train
        other_reqs = session.query(ExchangeRequest).join(Passenger).filter(
            ExchangeRequest.id != request_id,
            ExchangeRequest.status == 'PENDING',
            Passenger.train_number == pass1.train_number
        ).all()
        
        matches = []
        for req2 in other_reqs:
            pass2 = req2.passenger
            score = calculate_match_score(req1, pass1, req2, pass2)
            if score > 0:
                matches.append({
                    'request_id': req2.id,
                    'passenger_name': pass2.name,
                    'coach': pass2.coach_number,
                    'current_seat': pass2.seat_number,
                    'current_seat_type': req2.current_seat_type,
                    'requested_seat_type': req2.requested_seat_type,
                    'match_score': score,
                    'age': pass2.age,
                    'gender': pass2.gender
                })
        
        # Sort by best match score descending
        matches.sort(key=lambda x: x['match_score'], reverse=True)
        return matches
    finally:
        session.close()

def accept_match(req1_id, req2_id):
    """
    Accepting a match marks both requests as MATCHED, creates an ExchangeMatch record,
    and updates the seat_number in the core Passengers booking table.
    """
    session = get_session()
    try:
        req1 = session.query(ExchangeRequest).filter_by(id=req1_id).first()
        req2 = session.query(ExchangeRequest).filter_by(id=req2_id).first()
        
        if not req1 or not req2:
            raise ValueError("Invalid request IDs")
            
        pass1 = req1.passenger
        pass2 = req2.passenger
        
        score = calculate_match_score(req1, pass1, req2, pass2)
        
        req1.status = 'MATCHED'
        req2.status = 'MATCHED'
        
        match = ExchangeMatch(
            request_one_id=req1.id,
            request_two_id=req2.id,
            match_score=score,
            approval_status='APPROVED'
        )
        
        # Swap the seat numbers in exchange_passengers table
        temp_seat = pass1.seat_number
        pass1.seat_number = pass2.seat_number
        pass2.seat_number = temp_seat
        
        session.add(match)
        session.commit()

        # ── Also update the core Passengers booking table ──────────────────
        try:
            from config.database import get_connection
            conn = get_connection()
            try:
                # Update seat_number for passenger 1's PNR
                conn.execute(
                    "UPDATE Passengers SET seat_number = ? "
                    "WHERE booking_id = (SELECT booking_id FROM Bookings WHERE pnr_number = ?) "
                    "AND name = ?",
                    (pass1.seat_number, pass1.pnr_number, pass1.name)
                )
                # Update seat_number for passenger 2's PNR
                conn.execute(
                    "UPDATE Passengers SET seat_number = ? "
                    "WHERE booking_id = (SELECT booking_id FROM Bookings WHERE pnr_number = ?) "
                    "AND name = ?",
                    (pass2.seat_number, pass2.pnr_number, pass2.name)
                )
                conn.commit()
            finally:
                conn.close()
        except Exception as db_err:
            # Non-fatal — exchange ORM side is already committed
            print(f"[SmartRail] Exchange booking update warning: {db_err}")

        return True
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

def get_passenger_requests(pnr_number):
    session = get_session()
    try:
        passenger = session.query(Passenger).filter_by(pnr_number=pnr_number).first()
        if not passenger:
            return []
            
        reqs = []
        for r in passenger.requests:
            reqs.append({
                'id': r.id,
                'current_seat_type': r.current_seat_type,
                'requested_seat_type': r.requested_seat_type,
                'status': r.status,
                'created_at': r.created_at.isoformat()
            })
        return reqs
    finally:
        session.close()

# For demo purposes, seed some fake requests on the same train to allow matching
def seed_dummy_requests_for_train(train_number, coach_number):
    session = get_session()
    try:
        # Check if we already have dummies
        count = session.query(Passenger).filter(Passenger.train_number == train_number, Passenger.name.like("Mock%")).count()
        if count > 0:
            return
            
        mock_data = [
            {"name": "Mock Senior", "age": 68, "gender": "M", "seat": "71", "cur_type": "Upper Berth", "req_type": "Lower Berth"},
            {"name": "Mock Youth", "age": 25, "gender": "F", "seat": "12", "cur_type": "Lower Berth", "req_type": "Upper Berth"},
            {"name": "Mock Traveler", "age": 35, "gender": "M", "seat": "45", "cur_type": "Middle Berth", "req_type": "Side Lower"}
        ]
        
        for idx, md in enumerate(mock_data):
            pnr = f"MOCKPNR{random.randint(100,999)}{idx}"
            passenger = Passenger(
                name=md['name'], age=md['age'], gender=md['gender'],
                pnr_number=pnr, train_number=train_number,
                coach_number=coach_number, seat_number=md['seat']
            )
            session.add(passenger)
            session.commit()
            
            req = ExchangeRequest(
                passenger_id=passenger.id,
                current_seat_type=md['cur_type'],
                requested_seat_type=md['req_type'],
                status='PENDING'
            )
            session.add(req)
            session.commit()
    finally:
        session.close()
