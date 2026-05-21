from flask import Blueprint, request, jsonify
from services.data_service import get_stations, get_trains, search_trains, find_train_by_number
from services.fare_calculator import calculate_fare, get_all_class_fares, get_train_type_from_name

trains_bp = Blueprint('trains', __name__)


@trains_bp.route('/stations', methods=['GET'])
def stations():
    from services.data_service import _get_schedule_index
    index = _get_schedule_index()

    # Build station list directly from schedules — guaranteed to match search codes
    seen = {}
    for stops in index.values():
        for stop in stops:
            code = stop.get('station_code')
            if code and code not in seen:
                name = stop.get('station_name', code).title()
                seen[code] = {
                    "station_code": code,
                    "station_name": name,
                    "station_city": name
                }

    return jsonify(sorted(seen.values(), key=lambda x: x['station_name']))


@trains_bp.route('/trains', methods=['GET'])
def all_trains():
    data = get_trains()
    formatted = [
        {
            "train_number": t['properties'].get('number'),
            "train_name": t['properties'].get('name'),
            "train_type": t['properties'].get('type'),
            "from_station_code": t['properties'].get('from_station_code'),
            "from_station_name": t['properties'].get('from_station_name'),
            "to_station_code": t['properties'].get('to_station_code'),
            "to_station_name": t['properties'].get('to_station_name'),
            "departure_time": t['properties'].get('departure'),
            "arrival_time": t['properties'].get('arrival'),
            "duration_h": t['properties'].get('duration_h'),
            "duration_m": t['properties'].get('duration_m'),
            "distance": t['properties'].get('distance'),
            "zone": t['properties'].get('zone'),
        }
        for t in data
    ]
    return jsonify(formatted)


@trains_bp.route('/trains/search', methods=['GET'])
def search():
    source = request.args.get('source')
    destination = request.args.get('destination')
    travel_date = request.args.get('date')

    if not source or not destination:
        return jsonify({"error": "source and destination are required"}), 400

    trains = search_trains(source, destination, travel_date)
    return jsonify(trains)


@trains_bp.route('/fare', methods=['GET'])
def fare():
    """
    Calculate fare for a journey.
    Query params: train_number, source, destination, class (optional)
    Returns full class-wise fare breakdown.
    """
    train_number = request.args.get('train_number', '')
    source = request.args.get('source', '')
    destination = request.args.get('destination', '')
    class_type = request.args.get('class', 'SL').upper()

    from services.data_service import search_trains, _get_schedule_index, _get_trains_by_number
    from services.fare_calculator import get_all_class_fares, get_train_type_from_name

    # Find the train in schedules to get distance
    index = _get_schedule_index()
    stops = index.get(train_number, [])

    src_stop = next((s for s in stops if s['station_code'] == source), None)
    dst_stop = next((s for s in stops if s['station_code'] == destination), None)

    if not src_stop or not dst_stop:
        return jsonify({"error": "Train or stations not found"}), 404

    src_idx = stops.index(src_stop)
    dst_idx = stops.index(dst_stop)

    if src_idx >= dst_idx:
        return jsonify({"error": "Invalid journey direction"}), 400

    # Distance calculation
    train_meta = _get_trains_by_number().get(train_number)
    total_distance = train_meta['properties'].get('distance', 0) if train_meta else 0
    total_stops = len(stops)

    if total_distance > 0:
        proportion = (dst_idx - src_idx) / max(total_stops - 1, 1)
        distance_km = max(50, round(proportion * total_distance))
    else:
        distance_km = max(50, (dst_idx - src_idx) * 50)

    train_name = src_stop.get('train_name', '')
    train_type_code, is_sf = get_train_type_from_name(train_name)
    all_fares = get_all_class_fares(distance_km, train_type_code, is_sf)

    return jsonify({
        'trainNumber': train_number,
        'trainName': train_name,
        'source': src_stop.get('station_name', source),
        'destination': dst_stop.get('station_name', destination),
        'distanceKm': distance_km,
        'trainType': train_type_code,
        'isSuperfast': is_sf,
        'fares': all_fares,
        'selectedClass': class_type,
        'selectedFare': all_fares.get(class_type, all_fares.get('SL'))
    })


@trains_bp.route('/train/<train_number>/schedule', methods=['GET'])
def train_schedule(train_number):
    train = find_train_by_number(train_number)
    if not train:
        return jsonify({"error": "Train not found"}), 404

    coordinates = train.get('geometry', {}).get('coordinates', [])
    total = len(coordinates)
    distance = train['properties'].get('distance', 0)

    schedule = []
    for i, coord in enumerate(coordinates):
        schedule.append({
            "stop_number": i + 1,
            "station_code": train['properties'].get('from_station_code') if i == 0
                            else train['properties'].get('to_station_code') if i == total - 1
                            else f"STN{i}",
            "station_name": train['properties'].get('from_station_name') if i == 0
                            else train['properties'].get('to_station_name') if i == total - 1
                            else f"Station {i}",
            "arrival_time": None if i == 0 else train['properties'].get('arrival'),
            "departure_time": None if i == total - 1 else train['properties'].get('departure'),
            "distance_km": round((distance / total) * i) if total else 0,
            "day_offset": 0,
        })
    return jsonify(schedule)
