import random
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from config.database import get_connection
from middleware.auth import auth_required
from services.data_service import find_station_by_code, find_train_by_number
from services.fare_calculator import calculate_fare, get_train_type_from_name

bookings_bp = Blueprint('bookings', __name__)


def generate_pnr():
    return str(random.randint(1000000000, 9999999999))


@bookings_bp.route('/book-ticket', methods=['POST'])
@auth_required
def book_ticket():
    identity = get_jwt_identity()
    user_id = int(identity)
    data = request.get_json()

    train_number = str(data.get('trainNumber') or data.get('trainId') or '')
    source_code = data.get('sourceStationCode')
    dest_code = data.get('destinationStationCode')
    travel_date = data.get('travelDate')
    class_type = data.get('classType')
    passengers = data.get('passengers', [])

    # Validate stations using schedule index instead of stations.json
    from services.data_service import _get_schedule_index
    index = _get_schedule_index()
    stops = index.get(train_number, [])
    
    src_stop = next((s for s in stops if s['station_code'] == source_code), None)
    dst_stop = next((s for s in stops if s['station_code'] == dest_code), None)
    
    if not src_stop or not dst_stop:
        return jsonify({"error": "Invalid station codes for this train"}), 400

    pnr_number = generate_pnr()
    
    # Get train information
    train = find_train_by_number(train_number)
    train_name = train_number
    if train:
        train_name = train['properties'].get('name', train_number)
    
    # Calculate fare using fare calculator
    if src_stop and dst_stop:
        src_idx = stops.index(src_stop)
        dst_idx = stops.index(dst_stop)
        
        # Calculate distance
        train_meta = train
        total_distance = train_meta['properties'].get('distance', 0) if train_meta else 0
        total_stops = len(stops)
        
        if total_distance > 0:
            proportion = (dst_idx - src_idx) / max(total_stops - 1, 1)
            distance_km = max(50, round(proportion * total_distance))
        else:
            distance_km = max(50, (dst_idx - src_idx) * 50)
        
        # Get train type for fare calculation
        train_type_code, is_sf = get_train_type_from_name(train_name)
        fare_info = calculate_fare(distance_km, class_type, train_type_code, is_sf)
        fare_per_passenger = fare_info['totalFare']
    else:
        # Fallback if stops not found
        fare_per_passenger = 500
    
    total_fare = len(passengers) * fare_per_passenger

    # Check availability and determine booking status
    from services.data_service import _get_availability_status
    availability_status, wl_number = _get_availability_status(travel_date, class_type)
    
    if availability_status == 'WL':
        booking_status = 'WL'
        waitlist_number = wl_number
        seat_assignment = f'WL/{waitlist_number}'
    elif availability_status == 'RAC':
        booking_status = 'RAC'
        rac_number = wl_number
        seat_assignment = f'RAC/{rac_number}'
    else:
        booking_status = 'CONFIRMED'
        waitlist_number = None
        rac_number = None

    conn = get_connection()
    try:
        conn.execute(
            """INSERT INTO Bookings (user_id, train_id, pnr_number, source_station_id,
               destination_station_id, travel_date, class_type, total_fare, booking_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, train_number, pnr_number, source_code, dest_code, travel_date, class_type, total_fare, booking_status)
        )
        booking_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

        # Track assigned seats to avoid duplicates
        assigned_seats = set()
        for p in passengers:
            # Generate seat number or WL/RAC assignment
            if booking_status == 'CONFIRMED':
                while True:
                    seat_number = str(random.randint(1, 72))
                    if seat_number not in assigned_seats:
                        assigned_seats.add(seat_number)
                        break
                seat_assignment = seat_number
            else:
                # For WL/RAC, increment the number for each passenger
                if booking_status == 'WL':
                    waitlist_number += 1
                    seat_assignment = f'WL/{waitlist_number}'
                elif booking_status == 'RAC':
                    rac_number += 1
                    seat_assignment = f'RAC/{rac_number}'
            
            conn.execute(
                "INSERT INTO Passengers (booking_id, name, age, gender, seat_number, berth_preference) VALUES (?, ?, ?, ?, ?, ?)",
                (booking_id, p['name'], p['age'], p['gender'], seat_assignment, p.get('berthPreference', 'Lower'))
            )
        conn.commit()

        response_data = {
            "message": "Booking successful",
            "pnrNumber": pnr_number,
            "bookingId": booking_id,
            "totalFare": total_fare,
            "trainName": train_name,
            "bookingStatus": booking_status
        }
        
        if booking_status == 'WL':
            response_data["waitlistNumber"] = waitlist_number - len(passengers) + 1
        elif booking_status == 'RAC':
            response_data["racNumber"] = rac_number - len(passengers) + 1

        return jsonify(response_data), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": f"Booking failed: {str(e)}"}), 500
    finally:
        conn.close()


@bookings_bp.route('/pnr/<pnr_number>', methods=['GET'])
def pnr_status(pnr_number):
    conn = get_connection()
    try:
        booking = conn.execute(
            "SELECT * FROM Bookings WHERE pnr_number = ?", (pnr_number,)
        ).fetchone()

        if not booking:
            return jsonify({"error": "PNR not found"}), 404

        passengers = conn.execute(
            "SELECT * FROM Passengers WHERE booking_id = ?", (booking['booking_id'],)
        ).fetchall()

        # Get train name for PNR response
        train = find_train_by_number(booking['train_id'])
        train_name = train['properties'].get('name', booking['train_id']) if train else booking['train_id']
        
        return jsonify({
            "pnrNumber": booking['pnr_number'],
            "bookingStatus": booking['booking_status'],
            "travelDate": booking['travel_date'],
            "classType": booking['class_type'],
            "totalFare": booking['total_fare'],
            "trainNumber": booking['train_id'],
            "trainName": train_name,
            "sourceStation": booking['source_station_id'],
            "destinationStation": booking['destination_station_id'],
            "passengers": [
                {
                    "name": p['name'],
                    "age": p['age'],
                    "gender": p['gender'],
                    "seatNumber": p['seat_number'],
                    "berthPreference": p['berth_preference']
                } for p in passengers
            ]
        })
    finally:
        conn.close()


@bookings_bp.route('/user/bookings', methods=['GET'])
@auth_required
def user_bookings():
    identity = get_jwt_identity()
    user_id = int(identity)

    conn = get_connection()
    try:
        bookings = conn.execute(
            "SELECT * FROM Bookings WHERE user_id = ? ORDER BY booking_date DESC", (user_id,)
        ).fetchall()

        # Get train names for all bookings
        result = []
        for b in bookings:
            train = find_train_by_number(b['train_id'])
            train_name = train['properties'].get('name', b['train_id']) if train else b['train_id']
            result.append({
                "booking_id": b['booking_id'],
                "pnr_number": b['pnr_number'],
                "booking_status": b['booking_status'],
                "travel_date": b['travel_date'],
                "class_type": b['class_type'],
                "total_fare": b['total_fare'],
                "booking_date": b['booking_date'],
                "train_number": b['train_id'],
                "train_name": train_name,
                "source_station": b['source_station_id'],
                "destination_station": b['destination_station_id'],
            })
        
        return jsonify(result)
    finally:
        conn.close()
