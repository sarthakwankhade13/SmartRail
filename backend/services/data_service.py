import json
import os
from collections import defaultdict
from datetime import datetime, timedelta
from services.fare_calculator import calculate_fare, get_train_type_from_name

_stations_cache = None
_trains_cache = None
_schedules_cache = None
_schedule_index = None  # train_number -> list of stops sorted by id (sequence)
_trains_by_number = None  # train_number -> train feature
_station_trains_index = None  # station_code -> set of train_numbers
_station_name_to_code = None  # uppercase station name -> station_code

BASE_DIR = os.path.join(os.path.dirname(__file__), '..', '..')


def _load_stations():
    with open(os.path.join(BASE_DIR, 'station.json'), 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('stations', [])


def _load_trains():
    with open(os.path.join(BASE_DIR, 'trains.json'), 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('features', [])


def _load_schedules():
    with open(os.path.join(BASE_DIR, 'schedules.json'), 'r', encoding='utf-8') as f:
        return json.load(f)


def get_stations():
    global _stations_cache
    if _stations_cache is None:
        _stations_cache = _load_stations()
    return _stations_cache


def get_trains():
    global _trains_cache
    if _trains_cache is None:
        _trains_cache = _load_trains()
    return _trains_cache


def get_schedules():
    global _schedules_cache
    if _schedules_cache is None:
        _schedules_cache = _load_schedules()
    return _schedules_cache


def _get_schedule_index():
    """Build index: train_number -> sorted list of stops by id (sequence order)"""
    global _schedule_index
    if _schedule_index is None:
        index = defaultdict(list)
        for stop in get_schedules():
            index[stop['train_number']].append(stop)
        # Sort each train's stops by their id (sequence)
        for tn in index:
            index[tn].sort(key=lambda s: s['id'])
        _schedule_index = index
    return _schedule_index


def _get_trains_by_number():
    global _trains_by_number
    if _trains_by_number is None:
        _trains_by_number = {t['properties']['number']: t for t in get_trains()}
    return _trains_by_number


def _get_station_trains_index():
    """Build reverse index: station_code -> set of train_numbers stopping there."""
    global _station_trains_index
    if _station_trains_index is None:
        idx = defaultdict(set)
        for train_number, stops in _get_schedule_index().items():
            for stop in stops:
                idx[stop['station_code']].add(train_number)
        _station_trains_index = idx
    return _station_trains_index


def _get_station_name_to_code():
    """Build index: uppercase station name -> station_code."""
    global _station_name_to_code
    if _station_name_to_code is None:
        idx = {}
        for stops in _get_schedule_index().values():
            for stop in stops:
                name = stop.get('station_name', '').upper().strip()
                code = stop.get('station_code', '')
                if name and code and name not in idx:
                    idx[name] = code
        _station_name_to_code = idx
    return _station_name_to_code


def _resolve_station_code(code, index):
    """
    Resolve a user-typed value to a valid schedule station code.
    Handles: exact codes, city names, partial names.
    """
    if not code:
        return code

    code_upper = code.upper().strip()

    # 1. Already a valid schedule code
    if code_upper in index:
        return code_upper

    # 2. Exact station name match
    name_idx = _get_station_name_to_code()
    if code_upper in name_idx:
        return name_idx[code_upper]

    # 3. Partial name match
    for name, stn_code in name_idx.items():
        if name.startswith(code_upper) or code_upper in name:
            return stn_code

    return code_upper

def _resolve_all_station_codes(code, index):
    """
    Return all matching station codes for a query (e.g. all Mumbai stations).
    """
    if not code:
        return []
    code_upper = code.upper().strip()
    results = set()
    
    if code_upper in index:
        results.add(code_upper)
        
    name_idx = _get_station_name_to_code()
    if code_upper in name_idx:
        results.add(name_idx[code_upper])
        
    for name, stn_code in name_idx.items():
        if name.startswith(code_upper) or code_upper in name:
            results.add(stn_code)
            
    if not results:
        results.add(code_upper)
    return list(results)

def find_station_by_code(code):
    return next((s for s in get_stations() if s.get('stnCode') == code), None)

def find_train_by_number(train_number):
    return _get_trains_by_number().get(train_number)


def search_trains(source_code, dest_code, travel_date=None):
    """
    Find all trains that stop at source_code before dest_code.
    Uses schedules.json for intermediate stop matching.
    Normalizes codes against the schedule index first.
    """
    index = _get_schedule_index()

    # Normalize: if the exact code isn't in schedules, try to find it via station.json name
    source_codes = _resolve_all_station_codes(source_code, index)
    dest_codes = _resolve_all_station_codes(dest_code, index)

    results = []

    # Use reverse index to only check trains that stop at source
    candidate_trains = set()
    for sc in source_codes:
        candidate_trains.update(_get_station_trains_index().get(sc, set()))

    for train_number in candidate_trains:
        stops = index.get(train_number, [])
        src_idx = None
        dst_idx = None
        src_stop = None
        dst_stop = None

        for i, stop in enumerate(stops):
            if stop['station_code'] in source_codes and src_idx is None:
                src_idx = i
                src_stop = stop
            if stop['station_code'] in dest_codes and src_idx is not None:
                dst_idx = i
                dst_stop = stop
                break

        if src_idx is not None and dst_idx is not None and dst_idx > src_idx:
            # Estimate distance from stop sequence position
            total_stops = len(stops)
            # Try to get distance from trains.json
            train_meta = _get_trains_by_number().get(train_number)
            total_distance = 0
            if train_meta:
                total_distance = train_meta['properties'].get('distance', 0) or 0

            # Proportional distance estimate
            if total_distance > 0:
                proportion = (dst_idx - src_idx) / max(total_stops - 1, 1)
                distance_km = max(50, round(proportion * total_distance))
            else:
                # Fallback: ~50km per stop on average
                distance_km = max(50, (dst_idx - src_idx) * 50)

            # Get train type for surcharge
            train_name = src_stop.get('train_name', '')
            train_type_code, is_sf = get_train_type_from_name(train_name)

            # Calculate class-wise fares
            from services.fare_calculator import get_all_class_fares
            class_fares = get_all_class_fares(distance_km, train_type_code, is_sf)

            # Add availability status to each class
            for class_type, fare_info in class_fares.items():
                status, wl_number = _get_availability_status(travel_date, class_type)
                class_fares[class_type]['availability'] = status
                if status == 'WL':
                    class_fares[class_type]['waitlist_number'] = wl_number
                elif status == 'RAC':
                    class_fares[class_type]['rac_number'] = wl_number

            # Default display fare = SL fare
            default_fare = class_fares['SL']['totalFare']

            results.append({
                'train_number': train_number,
                'train_name': train_name,
                'source_station': src_stop.get('station_name', source_code),
                'destination_station': dst_stop.get('station_name', dest_code),
                'departure_time': src_stop.get('departure', ''),
                'arrival_time': dst_stop.get('arrival', ''),
                'available_seats': 100,
                'fare': default_fare,
                'class_fares': class_fares,
                'distance_km': distance_km,
                'train_type': train_type_code,
                'duration_h': None,
                'duration_m': None,
                'classes': '',
            })

            # Cap at 20 results for performance
            if len(results) >= 20:
                break

    return results


def _resolve_station_code(code, index):
    """
    Resolve a user-typed value to a valid schedule station code.
    Handles: exact codes, city names, partial names.
    e.g. 'NAGPUR' -> 'NGP', 'PUNE' -> 'PUNE', 'Mumbai' -> 'CSTM'
    """
    if not code:
        return code

    code_upper = code.upper().strip()

    # 1. Already a valid schedule code
    if code_upper in index:
        return code_upper

    # 2. Exact station name match
    name_idx = _get_station_name_to_code()
    if code_upper in name_idx:
        return name_idx[code_upper]

    # 3. Partial name match (e.g. "NAGPUR" matches "NAGPUR JN")
    for name, stn_code in name_idx.items():
        if name.startswith(code_upper) or code_upper in name:
            return stn_code

    return code_upper


def _get_availability_status(travel_date_str, class_type):
    """
    Determine availability status based on travel date.
    Nearby dates (within 10 days) are more likely to be booked.
    Returns: 'AVAIL', 'WL', or 'RAC' with waitlist number if applicable.
    """
    try:
        travel_date = datetime.strptime(travel_date_str, '%Y-%m-%d') if travel_date_str else datetime.today()
    except (ValueError, TypeError):
        travel_date = datetime.today()
    
    today = datetime.today()
    days_until_travel = (travel_date - today).days
    
    # Class priority for booking (higher priority classes fill up faster)
    class_priority = {'1A': 5, '2A': 4, '3A': 3, 'CC': 3, 'SL': 2, '2S': 1}
    priority = class_priority.get(class_type, 2)
    
    # Base probability of being available
    if days_until_travel <= 0:
        # Past or today - mostly booked
        if priority >= 4:
            return 'WL', 50 + priority * 10
        else:
            return 'WL', 20 + priority * 5
    elif days_until_travel <= 3:
        # Very near - high chance of WL
        if priority >= 4:
            return 'WL', 30 + priority * 8
        else:
            return 'WL', 10 + priority * 3
    elif days_until_travel <= 7:
        # Near - moderate chance of WL
        if priority >= 4:
            return 'WL', 15 + priority * 5
        elif priority >= 3:
            return 'RAC', 5
        else:
            return 'AVAIL', 0
    elif days_until_travel <= 14:
        # Moderate - mostly available
        if priority >= 4:
            return 'RAC', 3
        else:
            return 'AVAIL', 0
    else:
        # Far - mostly available
        return 'AVAIL', 0
