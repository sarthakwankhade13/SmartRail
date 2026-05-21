"""
Service layer for the Journey Planner feature.
Uses the existing JSON data files (station.json, trains.json, schedules.json)
via data_service.py for real train/station/schedule data.
"""
import random
from services.data_service import (
    search_trains as ds_search_trains,
    get_trains,
    find_train_by_number,
    _get_schedule_index,
    _get_trains_by_number,
    _get_station_trains_index,
)


# Mock platform and availability for display
_AVAILABILITY_OPTIONS = ['Available', 'Available', 'Available', 'RAC', 'Waitlist']


def _compute_duration(dep_str, arr_str):
    """Estimate duration from HH:MM strings. Returns e.g. '5h 30m'."""
    try:
        dh, dm = int(dep_str.split(':')[0]), int(dep_str.split(':')[1])
        ah, am = int(arr_str.split(':')[0]), int(arr_str.split(':')[1])
        total_dep = dh * 60 + dm
        total_arr = ah * 60 + am
        diff = total_arr - total_dep
        if diff <= 0:
            diff += 24 * 60  # crosses midnight
        hours, mins = divmod(diff, 60)
        return f"{hours}h {mins:02d}m"
    except Exception:
        return "—"


def _train_type_label(train_name):
    """Derive a user-friendly type label from the train name."""
    name_upper = (train_name or '').upper()
    if 'RAJDHANI' in name_upper:
        return 'Rajdhani'
    if 'SHATABDI' in name_upper:
        return 'Shatabdi'
    if 'DURONTO' in name_upper:
        return 'Duronto'
    if 'VANDE BHARAT' in name_upper or 'VANDEBHARAT' in name_upper:
        return 'Vande Bharat'
    if 'GARIB' in name_upper:
        return 'Garib Rath'
    if 'HUMSAFAR' in name_upper:
        return 'Humsafar'
    if 'TEJAS' in name_upper:
        return 'Tejas'
    if 'JAN SHATABDI' in name_upper:
        return 'Jan Shatabdi'
    if 'SF' in name_upper or 'SUPERFAST' in name_upper or 'S F' in name_upper:
        return 'Superfast'
    if 'EXP' in name_upper or 'EXPRESS' in name_upper:
        return 'Express'
    if 'MAIL' in name_upper:
        return 'Mail/Express'
    if 'PASSENGER' in name_upper:
        return 'Passenger'
    return 'Express'


def get_all_journey_trains(limit=50):
    """Return a list of trains for the Journey Planner listing view."""
    all_trains = get_trains()
    result = []
    for t in all_trains[:limit]:
        props = t.get('properties', {})
        train_name = props.get('name', '')
        dep = props.get('departure', '')
        arr = props.get('arrival', '')
        number = props.get('number', '')

        # Seed a deterministic pseudo-random platform / availability
        seed_val = hash(number) if number else random.randint(0, 999)
        platform = (seed_val % 10) + 1
        avail = _AVAILABILITY_OPTIONS[seed_val % len(_AVAILABILITY_OPTIONS)]

        result.append({
            'id': number,
            'trainName': train_name,
            'trainNumber': number,
            'source': props.get('from_station_name', ''),
            'destination': props.get('to_station_name', ''),
            'departureTime': dep,
            'arrivalTime': arr,
            'duration': _compute_duration(dep, arr),
            'platform': platform,
            'trainType': _train_type_label(train_name),
            'seatAvailability': avail,
            'distanceKm': props.get('distance', 0),
        })
    return result


def get_journey_train_by_number(train_number):
    """Get full train details + schedule stops from the JSON data."""
    index = _get_schedule_index()
    stops_data = index.get(train_number, [])
    train_meta = _get_trains_by_number().get(train_number)

    if not stops_data and not train_meta:
        return None

    # Build train info from first/last stop or meta
    train_name = ''
    source = ''
    destination = ''
    dep = ''
    arr = ''

    if stops_data:
        train_name = stops_data[0].get('train_name', '')
        source = stops_data[0].get('station_name', '')
        destination = stops_data[-1].get('station_name', '')
        dep = stops_data[0].get('departure', '')
        arr = stops_data[-1].get('arrival', '')

    if train_meta:
        props = train_meta.get('properties', {})
        train_name = train_name or props.get('name', '')
        source = source or props.get('from_station_name', '')
        destination = destination or props.get('to_station_name', '')
        dep = dep or props.get('departure', '')
        arr = arr or props.get('arrival', '')

    seed_val = hash(train_number) if train_number else 0
    platform = (seed_val % 10) + 1
    avail = _AVAILABILITY_OPTIONS[seed_val % len(_AVAILABILITY_OPTIONS)]

    # Build stops list
    formatted_stops = []
    for i, stop in enumerate(stops_data):
        is_first = i == 0
        is_last = i == len(stops_data) - 1
        stop_arr = stop.get('arrival', '')
        stop_dep = stop.get('departure', '')

        # Compute halt time
        halt_time = None
        if stop_arr and stop_dep and not is_first and not is_last:
            try:
                ah, am = int(stop_arr.split(':')[0]), int(stop_arr.split(':')[1])
                dh, dm = int(stop_dep.split(':')[0]), int(stop_dep.split(':')[1])
                diff = (dh * 60 + dm) - (ah * 60 + am)
                if diff < 0:
                    diff += 24 * 60
                if diff > 0:
                    halt_time = f"{diff} min"
            except Exception:
                pass

        formatted_stops.append({
            'id': i + 1,
            'stationName': stop.get('station_name', stop.get('station_code', '')),
            'stationCode': stop.get('station_code', ''),
            'arrival': stop_arr if not is_first else None,
            'departure': stop_dep if not is_last else None,
            'haltTime': halt_time,
            'stopOrder': i + 1,
        })

    return {
        'id': train_number,
        'trainName': train_name,
        'trainNumber': train_number,
        'source': source,
        'destination': destination,
        'departureTime': dep,
        'arrivalTime': arr,
        'duration': _compute_duration(dep, arr),
        'platform': platform,
        'trainType': _train_type_label(train_name),
        'seatAvailability': avail,
        'distanceKm': train_meta['properties'].get('distance', 0) if train_meta else 0,
        'stops': formatted_stops,
    }


def search_journey_trains(source, destination, travel_date=None):
    """
    Search trains using the real JSON schedule data.
    Leverages data_service.search_trains() and enriches with Journey Planner fields.
    """
    raw_results = ds_search_trains(source, destination, travel_date)

    results = []
    index = _get_schedule_index()

    for r in raw_results:
        train_number = r.get('train_number', '')
        train_name = r.get('train_name', '')
        dep = r.get('departure_time', '')
        arr = r.get('arrival_time', '')

        seed_val = hash(train_number) if train_number else 0
        platform = (seed_val % 10) + 1
        avail = _AVAILABILITY_OPTIONS[seed_val % len(_AVAILABILITY_OPTIONS)]

        # Get stops for this train between source and destination
        all_stops = index.get(train_number, [])
        src_station = r.get('source_station', '')
        dst_station = r.get('destination_station', '')

        # Find the slice of stops between source and destination
        src_idx = None
        dst_idx = None
        for i, stop in enumerate(all_stops):
            if stop.get('station_name', '').lower() == src_station.lower() and src_idx is None:
                src_idx = i
            if stop.get('station_name', '').lower() == dst_station.lower() and src_idx is not None:
                dst_idx = i
                break
        # Fallback: match on station_code
        if src_idx is None or dst_idx is None:
            src_code = None
            dst_code = None
            for i, stop in enumerate(all_stops):
                if stop.get('station_name', '') == src_station and src_idx is None:
                    src_idx = i
                if stop.get('station_name', '') == dst_station and src_idx is not None:
                    dst_idx = i
                    break

        journey_stops = []
        if src_idx is not None and dst_idx is not None:
            slice_stops = all_stops[src_idx:dst_idx + 1]
            for j, stop in enumerate(slice_stops):
                is_first = j == 0
                is_last = j == len(slice_stops) - 1
                stop_arr = stop.get('arrival', '')
                stop_dep = stop.get('departure', '')
                halt_time = None
                if stop_arr and stop_dep and not is_first and not is_last:
                    try:
                        ah, am = int(stop_arr.split(':')[0]), int(stop_arr.split(':')[1])
                        dh, dm = int(stop_dep.split(':')[0]), int(stop_dep.split(':')[1])
                        diff = (dh * 60 + dm) - (ah * 60 + am)
                        if diff < 0:
                            diff += 24 * 60
                        if diff > 0:
                            halt_time = f"{diff} min"
                    except Exception:
                        pass
                journey_stops.append({
                    'id': j + 1,
                    'stationName': stop.get('station_name', stop.get('station_code', '')),
                    'stationCode': stop.get('station_code', ''),
                    'arrival': stop_arr if not is_first else None,
                    'departure': stop_dep if not is_last else None,
                    'haltTime': halt_time,
                    'stopOrder': j + 1,
                })

        results.append({
            'id': train_number,
            'trainName': train_name,
            'trainNumber': train_number,
            'source': src_station,
            'destination': dst_station,
            'departureTime': dep,
            'arrivalTime': arr,
            'duration': _compute_duration(dep, arr),
            'platform': platform,
            'trainType': _train_type_label(train_name),
            'seatAvailability': avail,
            'distanceKm': r.get('distance_km', 0),
            'fare': r.get('fare', 0),
            'stops': journey_stops,
        })

    return results
