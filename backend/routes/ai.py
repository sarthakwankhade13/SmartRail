import random
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from middleware.auth import auth_required
from services.data_service import find_train_by_number, find_station_by_code, search_trains
from services.ai_engine import (
    fuzzy_station_search,
    extract_intent,
    find_connecting_routes,
    find_split_booking,
    predict_waitlist_confirmation,
    suggest_seat_upgrade,
)

ai_bp = Blueprint('ai', __name__)


# ── 1. SMART SEARCH (Fuzzy + NLP Intent) ──────────────────────────────────────

@ai_bp.route('/smart-search', methods=['POST'])
def smart_search():
    """
    Accepts natural language or fuzzy station names.
    e.g. { "query": "Cheapest train to Delhi tomorrow from Mumbay" }
    or   { "source": "Mumbay", "destination": "Deli", "date": "..." }
    """
    data = request.get_json()
    query = data.get('query', '')
    source_input = data.get('source', '')
    dest_input = data.get('destination', '')
    date_input = data.get('date', '')

    intent = {}
    if query:
        intent = extract_intent(query)
        if intent.get('destination') and not dest_input:
            dest_input = intent['destination']

    # Fuzzy match stations
    source_matches = fuzzy_station_search(source_input) if source_input else []
    dest_matches = fuzzy_station_search(dest_input) if dest_input else []

    source_code = source_matches[0]['stnCode'] if source_matches else None
    dest_code = dest_matches[0]['stnCode'] if dest_matches else None

    travel_date = date_input or intent.get('date', '')
    sort_by = intent.get('sort_by', 'default')

    trains = []
    if source_code and dest_code:
        trains = search_trains(source_code, dest_code)

        # Apply NLP sort
        if sort_by == 'fare':
            trains.sort(key=lambda t: t['fare'])
        elif sort_by == 'availability':
            trains.sort(key=lambda t: -t['available_seats'])

    return jsonify({
        'intent': intent,
        'resolvedSource': source_matches[0] if source_matches else None,
        'resolvedDestination': dest_matches[0] if dest_matches else None,
        'travelDate': travel_date,
        'sortBy': sort_by,
        'trains': trains[:10],
        'totalFound': len(trains),
        'fuzzyCorrections': {
            'source': source_matches[0]['stnName'] if source_matches and source_input else None,
            'destination': dest_matches[0]['stnName'] if dest_matches and dest_input else None,
        }
    })


@ai_bp.route('/fuzzy-stations', methods=['GET'])
def fuzzy_stations():
    """Fuzzy station name lookup — handles typos."""
    query = request.args.get('q', '')
    if not query:
        return jsonify([])
    matches = fuzzy_station_search(query, limit=8)
    return jsonify([
        {'station_code': s['stnCode'], 'station_name': s['stnName'], 'station_city': s.get('stnCity', '')}
        for s in matches
    ])


# ── 2. ROUTE OPTIMIZER ────────────────────────────────────────────────────────

@ai_bp.route('/route-optimizer', methods=['POST'])
@auth_required
def route_optimizer():
    """
    Finds best route A->C. If direct is full/unavailable:
    - Tries connecting routes via a mid-point B
    - Tries split-booking on the same train
    """
    data = request.get_json()
    source_code = data.get('sourceCode', '').upper()
    dest_code = data.get('destinationCode', '').upper()
    travel_date = data.get('travelDate', '')

    source_station = find_station_by_code(source_code)
    dest_station = find_station_by_code(dest_code)

    if not source_station or not dest_station:
        return jsonify({"error": "Invalid station codes"}), 400

    # Direct trains
    direct_trains = search_trains(source_code, dest_code)

    # Connecting routes (if direct is empty or user wants alternatives)
    connecting = find_connecting_routes(source_code, dest_code)

    # Split booking options
    split = find_split_booking(source_code, dest_code)

    response = {
        'sourceStation': source_station.get('stnName'),
        'destinationStation': dest_station.get('stnName'),
        'travelDate': travel_date,
        'directTrains': direct_trains[:5],
        'connectingRoutes': connecting[:3],
        'splitBookingOptions': split[:2],
        'recommendation': None
    }

    # AI recommendation logic
    if direct_trains:
        response['recommendation'] = {
            'type': 'direct',
            'message': f"✅ {len(direct_trains)} direct train(s) available. Best option: {direct_trains[0]['train_name']}",
            'confirmationChance': 95
        }
    elif connecting:
        c = connecting[0]
        response['recommendation'] = {
            'type': 'connecting',
            'message': f"⚡ No direct trains. Best connecting route via {c.get('via', 'intermediate station')}. Total fare: ₹{c['total_fare']}",
            'confirmationChance': 85
        }
    elif split:
        s = split[0]
        response['recommendation'] = {
            'type': 'split',
            'message': f"🔀 Try split-booking on {s['train_name']} via {s['split_at']}. Total fare: ₹{s['total_fare']}",
            'confirmationChance': 90
        }
    else:
        response['recommendation'] = {
            'type': 'none',
            'message': '❌ No routes found for this journey.',
            'confirmationChance': 0
        }

    return jsonify(response)


# ── 3. WAITLIST PREDICTOR ─────────────────────────────────────────────────────

@ai_bp.route('/waitlist-predict', methods=['POST'])
@auth_required
def waitlist_predict():
    data = request.get_json()
    train_number = data.get('trainNumber', '')
    travel_date = data.get('travelDate', '')
    waitlist_position = int(data.get('waitlistPosition', 1))
    class_type = data.get('classType', 'SL')

    train = find_train_by_number(train_number)
    train_name = train['properties'].get('name') if train else train_number

    prediction = predict_waitlist_confirmation(train_number, travel_date, waitlist_position, class_type)

    return jsonify({
        'trainNumber': train_number,
        'trainName': train_name,
        'travelDate': travel_date,
        'waitlistPosition': waitlist_position,
        **prediction
    })


# ── 4. SMART SEAT UPGRADE ─────────────────────────────────────────────────────

@ai_bp.route('/seat-upgrade', methods=['POST'])
@auth_required
def seat_upgrade():
    data = request.get_json()
    train_number = data.get('trainNumber', '')
    travel_date = data.get('travelDate', '')
    current_class = data.get('classType', 'SL')

    suggestions = suggest_seat_upgrade(current_class, train_number, travel_date)

    return jsonify({
        'trainNumber': train_number,
        'currentClass': current_class,
        'suggestions': suggestions,
        'hasSuggestions': len(suggestions) > 0
    })


# ── EXISTING FEATURES (kept + improved) ──────────────────────────────────────

@ai_bp.route('/seat-recommend', methods=['POST'])
@auth_required
def seat_recommend():
    data = request.get_json()
    train_number = data.get('trainNumber')
    preferences = data.get('preferences', [])

    recommendations = []
    if 'window' in preferences:
        recommendations.append({"coach": "S1", "seatType": "Window", "seatNumbers": ["1", "4", "6", "9"]})
    if 'lower' in preferences:
        recommendations.append({"coach": "S2", "seatType": "Lower Berth", "seatNumbers": ["1", "8", "15", "22"]})
    if 'family' in preferences:
        recommendations.append({"coach": "S3", "seatType": "Side Lower (Family)", "seatNumbers": ["7", "14", "21", "28"]})
    if not recommendations:
        recommendations = [{"coach": "S1", "seatType": "General", "seatNumbers": ["10", "11", "12", "13"]}]

    return jsonify({"trainNumber": train_number, "recommendations": recommendations})


@ai_bp.route('/price-analysis', methods=['POST'])
@auth_required
def price_analysis():
    data = request.get_json()
    train_number = data.get('trainNumber', '')
    travel_date = data.get('travelDate', '')
    class_type = data.get('classType', 'SL')

    # Resolve train name for type detection
    from services.fare_calculator import calculate_fare, get_train_type_from_name
    from services.data_service import _get_schedule_index

    index = _get_schedule_index()
    stops = index.get(train_number, [])
    train_name = stops[0].get('train_name', '') if stops else ''
    train_type, is_sf = get_train_type_from_name(train_name)

    fare_info = calculate_fare(500, class_type, train_type, is_sf)  # 500 km default
    base_fare = fare_info['totalFare']

    from services.pricing_engine import (
        generate_price_history,
        predict_future_prices,
        get_best_booking_window,
        analyze_demand,
    )

    history = generate_price_history(train_number, class_type, travel_date, base_fare)
    future = predict_future_prices(train_number, class_type, travel_date, base_fare)
    booking_window = get_best_booking_window(travel_date, base_fare)
    demand = analyze_demand(train_number, travel_date)

    return jsonify({
        'trainNumber': train_number,
        'trainName': train_name,
        'classType': class_type,
        'travelDate': travel_date,
        'baseFare': base_fare,
        'priceHistory': history,
        'futurePrices': future,
        'bookingWindow': booking_window,
        'demand': demand,
    })


@ai_bp.route('/seat-swap', methods=['POST'])
@auth_required
def seat_swap():
    data = request.get_json()
    train_number = data.get('trainNumber')
    current_seat = data.get('currentSeat', '')
    desired_seat_type = data.get('desiredSeatType', '').lower()

    train = find_train_by_number(train_number)
    if not train:
        return jsonify({"error": "Train not found"}), 404

    matches = [
        {"passengerName": "Rahul Sharma", "currentSeat": "45", "desiredSeat": current_seat, "matchScore": 95},
        {"passengerName": "Priya Patel", "currentSeat": "12", "desiredSeat": current_seat, "matchScore": 80},
    ]
    filtered = [m for m in matches if desired_seat_type in m['currentSeat'].lower()] if desired_seat_type else matches

    return jsonify({
        "message": "Swap request created",
        "trainName": train['properties'].get('name'),
        "matches": filtered
    })


@ai_bp.route('/journey-plan', methods=['POST'])
@auth_required
def journey_plan():
    data = request.get_json()
    source_code = data.get('sourceCode', '').upper()
    dest_code = data.get('destinationCode', '').upper()
    travel_date = data.get('travelDate', '')

    source_station = find_station_by_code(source_code)
    dest_station = find_station_by_code(dest_code)

    if not source_station or not dest_station:
        return jsonify({"error": "Invalid station codes"}), 404

    trains = search_trains(source_code, dest_code)
    recommendations = [
        {
            "train_number": t['train_number'],
            "train_name": t['train_name'],
            "departure_time": t['departure_time'],
            "arrival_time": t['arrival_time'],
            "recommendation": ["Fastest Route", "Best Value", "Alternative"][min(i, 2)],
            "estimatedFare": 500 + (i * 100)
        }
        for i, t in enumerate(trains[:5])
    ]

    return jsonify({
        "routes": recommendations,
        "sourceStation": source_station.get('stnName'),
        "destinationStation": dest_station.get('stnName')
    })
