import random
import logging
import os
import json
import requests
from datetime import datetime
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

log = logging.getLogger(__name__)

ai_bp = Blueprint('ai', __name__)


# ── 1b. GPT SMART SEARCH ──────────────────────────────────────────────────────

@ai_bp.route('/gpt-smart-search', methods=['POST'])
def gpt_smart_search():
    """
    GPT-powered smart search wizard.
    Parses conversational user inputs, searches trains/routes, and generates
    personalized recommendations using OpenAI ChatGPT.
    """
    data = request.get_json() or {}
    answers = data.get('answers', {})
    user_api_key = data.get('apiKey', '')

    api_key = user_api_key or os.getenv('OPENAI_API_KEY', '')
    if not api_key:
        return jsonify({
            'error': 'OpenAI API key is missing. Please enter your ChatGPT API key.'
        }), 400

    today_date = datetime.today().strftime('%Y-%m-%d')
    from_to = answers.get('from_to', '')
    date_str = answers.get('date', '')
    preferences = answers.get('preferences', '')

    # 1. Parse natural language parameters using ChatGPT
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    parse_payload = {
        "model": "gpt-4o-mini",
        "response_format": { "type": "json_object" },
        "messages": [
            {
                "role": "system",
                "content": (
                    f"You are a structured travel query parser. Extract travel parameters from the user's answers. "
                    f"Current date is {today_date}. Return ONLY a JSON object with these keys: "
                    f"'source' (string, e.g., 'Mumbai'), 'destination' (string, e.g., 'Delhi'), "
                    f"'date' (string in YYYY-MM-DD format, relative to {today_date} if relative), "
                    f"'class' (string: 'SL', '3A', '2A', '1A', 'CC', '2S' or null), "
                    f"'preference' (string: 'cheapest', 'fastest', 'availability' or null)."
                )
            },
            {
                "role": "user",
                "content": f"Answers:\n1. From/To: {from_to}\n2. Travel Date: {date_str}\n3. Preferences/Priority: {preferences}"
            }
        ]
    }

    try:
        response = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=parse_payload, timeout=10)
        if response.status_code != 200:
            return jsonify({"error": f"OpenAI API Error: {response.text}"}), response.status_code
        
        response_data = response.json()
        parsed = json.loads(response_data['choices'][0]['message']['content'])
    except Exception as e:
        return jsonify({"error": f"Failed to call OpenAI API for parsing: {str(e)}"}), 500

    source_name = parsed.get('source')
    destination_name = parsed.get('destination')
    travel_date = parsed.get('date') or today_date
    class_pref = parsed.get('class')
    preference = parsed.get('preference')

    # 2. Fuzzy match/resolve stations
    source_matches = fuzzy_station_search(source_name) if source_name else []
    dest_matches = fuzzy_station_search(destination_name) if destination_name else []

    source_code = source_matches[0]['stnCode'] if source_matches else None
    dest_code = dest_matches[0]['stnCode'] if dest_matches else None

    trains = []
    connecting = []
    split = []

    if source_code and dest_code:
        trains = search_trains(source_code, dest_code, travel_date)
        
        # Apply sorting preferences
        if preference == 'cheapest':
            trains.sort(key=lambda t: t['fare'])
        elif preference == 'fastest':
            trains.sort(key=lambda t: t.get('duration_h') or 24)
        elif preference == 'availability':
            trains.sort(key=lambda t: -t['available_seats'])

        # If no direct trains, find alternatives
        if not trains:
            connecting = find_connecting_routes(source_code, dest_code)
            split = find_split_booking(source_code, dest_code)

    # 3. Create context for ChatGPT recommendation
    trains_summary = []
    for t in trains[:5]:
        fares_str = ", ".join([f"{c}: ₹{f['totalFare']} ({f['availability']})" for c, f in t['class_fares'].items()])
        trains_summary.append(
            f"- Train {t['train_number']} ({t['train_name']}): Departs {t['departure_time']} from {t['source_station']}, Arrives {t['arrival_time']} at {t['destination_station']}. Display Fare: ₹{t['fare']}. Fares: {fares_str}."
        )

    alternatives_summary = []
    if connecting:
        for c in connecting[:2]:
            legs_str = " -> ".join([f"{l['train_name']} ({l['source_station']} to {l['destination_station']})" for l in c['legs']])
            alternatives_summary.append(f"- Connecting via {c['via']}: {legs_str}. Total fare: ₹{c['total_fare']}.")
    if split:
        for s in split[:2]:
            alternatives_summary.append(f"- Split booking on {s['train_name']} via {s['split_at']}. Total fare: ₹{s['total_fare']}.")

    trains_context = "\n".join(trains_summary) if trains_summary else "No direct trains found."
    alts_context = "\n".join(alternatives_summary) if alternatives_summary else "No connecting routes found."

    recommend_payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a friendly, helpful AI railway assistant. Based on the user's travel request, preferences, and the list of available trains and alternatives, write a highly personalized recommendation (max 4 sentences). "
                    "Recommend the best option (train number/name or alternative route) and clearly explain why it fits their preferences (e.g. comfort, budget, time, availability). "
                    "Use markdown for formatting."
                )
            },
            {
                "role": "user",
                "content": (
                    f"User Request: Journey from '{source_name}' to '{destination_name}' on '{travel_date}'.\n"
                    f"Preferred Class: {class_pref or 'No Preference'}. Priority: {preference or 'No Preference'}.\n\n"
                    f"Available Direct Trains:\n{trains_context}\n\n"
                    f"Alternative/Connecting Routes:\n{alts_context}"
                )
            }
        ]
    }

    try:
        rec_response = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=recommend_payload, timeout=15)
        if rec_response.status_code == 200:
            rec_data = rec_response.json()
            recommendation = rec_data['choices'][0]['message']['content']
        else:
            recommendation = "Here are the best options we found for your journey. Please check the list below."
    except Exception as e:
        recommendation = "Here are the best options we found for your journey. Please check the list below."

    return jsonify({
        'resolvedSource': source_matches[0] if source_matches else None,
        'resolvedDestination': dest_matches[0] if dest_matches else None,
        'travelDate': travel_date,
        'class': class_pref,
        'preference': preference,
        'trains': trains,
        'connectingRoutes': connecting,
        'splitBookingOptions': split,
        'recommendation': recommendation
    })


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
def waitlist_predict():
    """
    ML-powered waitlist confirmation prediction.
    Uses a trained stacking ensemble (GradientBoosting + RandomForest + LR).
    Returns probability, risk level, SHAP-style explanations, and timeline.
    """
    data = request.get_json()
    train_number      = data.get('trainNumber', '')
    travel_date       = data.get('travelDate', '')
    waitlist_position = int(data.get('waitlistPosition', 1))
    class_type        = data.get('classType', 'SL')
    quota             = data.get('quota', 'GNWL')
    booking_date      = data.get('bookingDate', None)
    passenger_count   = int(data.get('passengerCount', 1))
    age_group         = data.get('ageGroup', 'adult')
    distance_km       = int(data.get('distanceKm', 500))

    train = find_train_by_number(train_number)
    train_name = train['properties'].get('name') if train else train_number

    # Try ML model first, fall back to formula-based predictor
    try:
        from ml.predictor import predict as ml_predict, predict_timeline
        prediction = ml_predict(
            train_number=train_number,
            class_type=class_type,
            quota=quota,
            waitlist_position=waitlist_position,
            travel_date_str=travel_date,
            booking_date_str=booking_date,
            passenger_count=passenger_count,
            age_group=age_group,
            distance_km=distance_km,
        )
        timeline = predict_timeline(
            train_number=train_number,
            class_type=class_type,
            quota=quota,
            waitlist_position=waitlist_position,
            travel_date_str=travel_date,
            distance_km=distance_km,
        )
        prediction['timeline'] = timeline
        prediction['engine'] = 'ml'
    except Exception as e:
        log.warning(f"ML predictor unavailable ({e}), falling back to formula engine")
        prediction = predict_waitlist_confirmation(
            train_number, travel_date, waitlist_position, class_type
        )
        prediction['engine'] = 'formula'
        prediction['timeline'] = []

    return jsonify({
        'trainNumber': train_number,
        'trainName':   train_name,
        'travelDate':  travel_date,
        'waitlistPosition': waitlist_position,
        **prediction,
    })


@ai_bp.route('/waitlist-model-info', methods=['GET'])
def waitlist_model_info():
    """Return ML model metadata (accuracy, training date, top features)."""
    try:
        from ml.predictor import get_model_meta
        return jsonify(get_model_meta())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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
def price_analysis():
    data = request.get_json()
    train_number = data.get('trainNumber', '')
    travel_date = data.get('travelDate', '')
    class_type = data.get('classType', 'SL')
    distance_km = int(data.get('distanceKm', 0))

    from services.fare_calculator import calculate_fare, get_train_type_from_name
    from services.data_service import _get_schedule_index

    index = _get_schedule_index()
    stops = index.get(train_number, [])
    train_name = stops[0].get('train_name', '') if stops else ''
    train_type, is_sf = get_train_type_from_name(train_name)

    if distance_km <= 0:
        distance_km = max(len(stops) * 30, 200) if stops else 500

    fare_info = calculate_fare(distance_km, class_type, train_type, is_sf)
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

    # All-class fare comparison
    all_classes = ['2S', 'SL', 'CC', '3A', '2A', '1A']
    class_fares = {}
    for cls in all_classes:
        try:
            fi = calculate_fare(distance_km, cls, train_type, is_sf)
            class_fares[cls] = fi['totalFare']
        except Exception:
            class_fares[cls] = 0

    # Weekly trend (group history by day-of-week)
    from collections import defaultdict
    dow_prices = defaultdict(list)
    dow_names  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    for h in history:
        try:
            from datetime import datetime as dt
            d = dt.strptime(h['date'], '%Y-%m-%d')
            dow_prices[d.weekday()].append(h['price'])
        except Exception:
            pass
    weekly_trend = [
        {'day': dow_names[i], 'avgPrice': round(sum(v)/len(v)) if v else 0}
        for i, v in sorted(dow_prices.items())
    ]

    # Train type distribution (simulate for pie chart)
    train_type_dist = [
        {'name': 'Express',    'value': 45},
        {'name': 'Superfast',  'value': 28},
        {'name': 'Rajdhani',   'value': 12},
        {'name': 'Shatabdi',   'value': 8},
        {'name': 'Passenger',  'value': 7},
    ]

    return jsonify({
        'trainNumber':    train_number,
        'trainName':      train_name,
        'trainType':      train_type,
        'classType':      class_type,
        'travelDate':     travel_date,
        'baseFare':       base_fare,
        'distanceKm':     distance_km,
        'priceHistory':   history,
        'futurePrices':   future,
        'bookingWindow':  booking_window,
        'demand':         demand,
        'classFares':     class_fares,
        'weeklyTrend':    weekly_trend,
        'trainTypeDist':  train_type_dist,
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
