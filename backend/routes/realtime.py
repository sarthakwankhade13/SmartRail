import random
from flask import Blueprint, request, jsonify
from services.data_service import get_stations, get_trains, find_train_by_number

realtime_bp = Blueprint('realtime', __name__)


@realtime_bp.route('/stations/live', methods=['GET'])
def stations_live():
    stations = get_stations()
    formatted = [
        {"station_code": s.get('stnCode'), "station_name": s.get('stnName'), "city": s.get('stnCity'), "state": s.get('stnState', s.get('stnCity'))}
        for s in stations
    ]
    return jsonify({"success": True, "count": len(formatted), "data": formatted})


@realtime_bp.route('/trains/live', methods=['GET'])
def trains_live():
    trains = get_trains()
    formatted = [
        {"train_number": t['properties'].get('number'), "train_name": t['properties'].get('name'), "train_type": t['properties'].get('type')}
        for t in trains
    ]
    return jsonify({"success": True, "count": len(formatted), "data": formatted})


@realtime_bp.route('/trains/<train_number>/live-schedule', methods=['GET'])
def live_schedule(train_number):
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
            "arrival_time": None if i == 0 else train['properties'].get('departure'),
            "departure_time": None if i == total - 1 else train['properties'].get('arrival'),
            "distance_km": round((distance / total) * i) if total else 0,
            "day_offset": 0,
        })

    return jsonify({"success": True, "trainNumber": train_number, "stops": len(schedule), "data": schedule})


@realtime_bp.route('/trains/<train_number>/availability', methods=['GET'])
def availability(train_number):
    class_type = request.args.get('class')
    train = find_train_by_number(train_number)
    if not train:
        return jsonify({"error": "Train not found"}), 404

    classes = [
        {"class_type": "SL", "total_seats": 72, "base_fare": 300},
        {"class_type": "3A", "total_seats": 64, "base_fare": 800},
        {"class_type": "2A", "total_seats": 48, "base_fare": 1500},
        {"class_type": "1A", "total_seats": 24, "base_fare": 2500},
    ]
    result = [
        {**c, "available_seats": random.randint(10, c['total_seats']), "train_name": train['properties'].get('name')}
        for c in classes
    ]
    if class_type:
        result = [r for r in result if r['class_type'] == class_type]

    return jsonify({"success": True, "trainNumber": train_number, "data": result})
