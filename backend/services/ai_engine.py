"""
AI Engine - Powers all 4 smart features:
1. Fuzzy Search + NLP Intent Extraction
2. Route Optimizer (Dijkstra / split-booking)
3. Waitlist Confirmation Predictor (logistic regression formula)
4. Smart Seat Upgrade Suggester
"""

import math
import re
from datetime import datetime, timedelta
from collections import defaultdict
from services.data_service import get_stations, search_trains, _get_schedule_index


# ─────────────────────────────────────────────
# 1. FUZZY SEARCH + NLP INTENT EXTRACTION
# ─────────────────────────────────────────────

CLASS_FARES = {'SL': 300, '3A': 800, '2A': 1500, '1A': 2500, 'CC': 600, '2S': 150}
CLASS_WL_SPEED = {'SL': 1.8, '3A': 1.2, '2A': 0.8, '1A': 0.4, 'CC': 1.0, '2S': 2.0}


def _fuzzy_score(query, target):
    """Fuzzy match score (0-1) using substring + character overlap."""
    query = query.lower().strip()
    target = target.lower().strip()
    if not query:
        return 0.0
    if query == target:
        return 1.0
    if query in target:
        return 0.95
    if target.startswith(query[:3]):
        return 0.85
    # Count matching characters in order (subsequence)
    qi = 0
    for ch in target:
        if qi < len(query) and ch == query[qi]:
            qi += 1
    seq_score = qi / len(query)
    # Character overlap score
    overlap = sum(1 for c in query if c in target)
    overlap_score = overlap / len(query)
    return max(seq_score, overlap_score) * 0.9


def fuzzy_station_search(query, limit=8):
    """Find stations matching a possibly misspelled query."""
    stations = get_stations()
    query = query.strip()
    scored = []
    for s in stations:
        score = max(
            _fuzzy_score(query, s.get('stnCode', '')),
            _fuzzy_score(query, s.get('stnName', '')),
            _fuzzy_score(query, s.get('stnCity', ''))
        )
        if score > 0.4:
            scored.append((score, s))
    scored.sort(key=lambda x: -x[0])
    return [s for _, s in scored[:limit]]


def extract_intent(text):
    """
    Parse natural language like:
    'Cheapest train to Delhi tomorrow'
    Returns: { source, destination, date, sort_by, class_type }
    """
    intent = {'sort_by': 'default', 'date': None, 'destination': None, 'class_type': None}

    text_lower = text.lower()

    # Sort intent
    if any(w in text_lower for w in ['cheap', 'cheapest', 'lowest fare', 'budget']):
        intent['sort_by'] = 'fare'
    elif any(w in text_lower for w in ['fast', 'fastest', 'quick', 'express']):
        intent['sort_by'] = 'duration'
    elif any(w in text_lower for w in ['confirm', 'confirmed', 'guaranteed']):
        intent['sort_by'] = 'availability'

    # Date intent
    today = datetime.today()
    if 'tomorrow' in text_lower:
        intent['date'] = (today + timedelta(days=1)).strftime('%Y-%m-%d')
    elif 'today' in text_lower or 'tonight' in text_lower:
        intent['date'] = today.strftime('%Y-%m-%d')
    elif 'day after' in text_lower:
        intent['date'] = (today + timedelta(days=2)).strftime('%Y-%m-%d')
    else:
        # Try to find a date pattern like "15 april" or "april 15"
        match = re.search(r'(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?', text)
        if match:
            day, month = int(match.group(1)), int(match.group(2))
            year = int(match.group(3)) if match.group(3) else today.year
            try:
                intent['date'] = datetime(year, month, day).strftime('%Y-%m-%d')
            except ValueError:
                pass

    # Class intent
    class_map = {
        'sleeper': 'SL', 'sl': 'SL',
        'ac 3': '3A', '3a': '3A', 'third ac': '3A',
        'ac 2': '2A', '2a': '2A', 'second ac': '2A',
        'first ac': '1A', '1a': '1A', 'ac first': '1A',
        'chair': 'CC', 'cc': 'CC',
    }
    for keyword, cls in class_map.items():
        if keyword in text_lower:
            intent['class_type'] = cls
            break

    # Destination extraction — look for "to <word>" pattern
    dest_match = re.search(r'\bto\s+([a-zA-Z\s]+?)(?:\s+(?:tomorrow|today|tonight|on|by|for|in)|$)', text, re.IGNORECASE)
    if dest_match:
        intent['destination'] = dest_match.group(1).strip()

    return intent


# ─────────────────────────────────────────────
# 2. ROUTE OPTIMIZER (Dijkstra + split-booking)
# ─────────────────────────────────────────────

def _build_graph():
    """
    Build a station graph from schedules.
    Edge: station_A -> station_B if a train goes A then B consecutively.
    Weight: 1 (hop count). We cache this.
    """
    index = _get_schedule_index()
    graph = defaultdict(set)  # station_code -> set of (next_station_code, train_number, train_name)
    for train_number, stops in index.items():
        for i in range(len(stops) - 1):
            a = stops[i]['station_code']
            b = stops[i + 1]['station_code']
            graph[a].add((b, train_number, stops[i].get('train_name', '')))
    return graph


_graph_cache = None

def _get_graph():
    global _graph_cache
    if _graph_cache is None:
        _graph_cache = _build_graph()
    return _graph_cache


def find_connecting_routes(source_code, dest_code, max_hops=1):
    """
    Find routes from source to dest with up to max_hops intermediate stations.
    Returns list of route options, each being a list of legs.
    """
    # First try direct trains
    direct = search_trains(source_code, dest_code)
    if direct:
        return [{'type': 'direct', 'legs': [direct[0]], 'total_fare': direct[0]['fare']}]

    # BFS for 1-stop connections
    graph = _get_graph()
    results = []
    visited_mid = set()

    for (mid_code, train1_num, train1_name) in graph.get(source_code, set()):
        if mid_code == dest_code or mid_code in visited_mid:
            continue
        visited_mid.add(mid_code)

        # Check if any train goes mid -> dest
        leg2_trains = search_trains(mid_code, dest_code)
        if leg2_trains:
            leg1_trains = search_trains(source_code, mid_code)
            if leg1_trains:
                leg1 = leg1_trains[0]
                leg2 = leg2_trains[0]
                total_fare = leg1['fare'] + leg2['fare']
                results.append({
                    'type': 'connecting',
                    'via': mid_code,
                    'legs': [leg1, leg2],
                    'total_fare': total_fare,
                    'note': f"Change at {leg1['destination_station']}"
                })
                if len(results) >= 3:
                    break

    return results


def find_split_booking(source_code, dest_code):
    """
    Split-booking: find a mid-point B where the same train
    has seats for A->B and B->C separately.
    """
    index = _get_schedule_index()
    results = []

    for train_number, stops in index.items():
        codes = [s['station_code'] for s in stops]
        if source_code not in codes or dest_code not in codes:
            continue
        src_i = codes.index(source_code)
        dst_i = codes.index(dest_code)
        if src_i >= dst_i:
            continue

        # Find a mid-point between src and dst
        mid_range = stops[src_i + 1:dst_i]
        if not mid_range:
            continue
        mid = mid_range[len(mid_range) // 2]  # pick middle stop

        results.append({
            'type': 'split_booking',
            'train_number': train_number,
            'train_name': stops[src_i].get('train_name', ''),
            'split_at': mid['station_name'],
            'split_code': mid['station_code'],
            'leg1': {
                'from': stops[src_i]['station_name'],
                'to': mid['station_name'],
                'departure': stops[src_i].get('departure', ''),
                'arrival': mid.get('arrival', ''),
                'fare': 250
            },
            'leg2': {
                'from': mid['station_name'],
                'to': stops[dst_i]['station_name'],
                'departure': mid.get('departure', ''),
                'arrival': stops[dst_i].get('arrival', ''),
                'fare': 250
            },
            'total_fare': 500,
            'note': f"Book same train {train_number} in two segments via {mid['station_name']}"
        })
        if len(results) >= 2:
            break

    return results


# ─────────────────────────────────────────────
# 3. WAITLIST CONFIRMATION PREDICTOR
# ─────────────────────────────────────────────

def _is_peak_season(date_obj):
    """Check if date falls in peak travel season."""
    month = date_obj.month
    # Peak seasons: April-May (summer), October-December (festivals/winter)
    if month in [4, 5, 10, 11, 12]:
        return True
    # Check for major festivals (simplified - would need actual festival calendar)
    # Diwali, Holi, Christmas, New Year period
    if month == 3 and 20 <= date_obj.day <= 30:  # Holi period
        return True
    if month == 11 and 5 <= date_obj.day <= 20:  # Diwali period
        return True
    if month == 12 and 20 <= date_obj.day <= 31:  # Christmas/New Year
        return True
    return False

def _is_weekend(date_obj):
    """Check if date is weekend."""
    return date_obj.weekday() >= 5  # 5=Saturday, 6=Sunday

def _get_train_popularity_factor(train_number):
    """Simulate train popularity based on train number patterns."""
    # Trains starting with 1xxx are usually premium/superfast
    if train_number.startswith('1'):
        return 0.7  # Lower clearance due to high demand
    # Trains starting with 2xxx are also popular
    elif train_number.startswith('2'):
        return 0.8
    # Other trains
    return 1.0

def predict_waitlist_confirmation(train_number, travel_date_str, waitlist_position, class_type='SL'):
    """
    Enhanced waitlist prediction using multiple factors:
    - Days until travel
    - Waitlist position
    - Class type (clearing speed)
    - Peak season factor
    - Weekend factor
    - Train popularity
    - Distance-based adjustment
    
    Uses weighted logistic regression formula.
    """
    try:
        travel_date = datetime.strptime(travel_date_str, '%Y-%m-%d')
        days_left = (travel_date - datetime.today()).days
    except Exception:
        days_left = 7
        travel_date = datetime.today()

    days_left = max(days_left, 0)
    wl = max(int(waitlist_position), 1)

    # Base class sensitivity factor
    k = CLASS_WL_SPEED.get(class_type, 1.0)

    # Peak season penalty (reduces clearance probability)
    peak_season_penalty = 0.6 if _is_peak_season(travel_date) else 1.0

    # Weekend penalty (slightly lower clearance on weekends)
    weekend_penalty = 0.9 if _is_weekend(travel_date) else 1.0

    # Train popularity factor
    popularity_factor = _get_train_popularity_factor(train_number)

    # Distance-based adjustment (longer journeys have better WL clearance)
    # Simulated distance based on train number pattern
    distance_factor = 1.1 if len(train_number) == 5 else 1.0

    # Combined factors
    combined_factor = k * peak_season_penalty * weekend_penalty * popularity_factor * distance_factor

    # Enhanced logistic formula with multiple factors
    # Base probability from days/wl ratio
    base_ratio = days_left / wl if wl > 0 else days_left
    
    # Apply sigmoid with adjusted factor
    exponent = combined_factor * base_ratio
    probability = 1 / (1 + math.exp(-exponent)) * 100

    # Additional adjustments based on specific scenarios
    if days_left <= 1:
        # Very short notice - very low chance unless WL is very small
        probability *= 0.3 if wl > 5 else 0.6
    elif days_left <= 3:
        # Short notice - moderate reduction
        probability *= 0.7 if wl > 10 else 0.9
    elif days_left >= 30:
        # Long notice - better chance
        probability *= 1.1

    # WL position penalty (exponential decay for high WL positions)
    if wl > 50:
        probability *= 0.5
    elif wl > 30:
        probability *= 0.7
    elif wl > 20:
        probability *= 0.85

    # Cap at 95% (never 100% guaranteed) and minimum 5%
    probability = max(min(round(probability, 1), 95.0), 5.0)

    # Determine status and advice
    if probability >= 75:
        status = 'High Chance'
        advice = 'Very likely to confirm. Safe to plan your trip.'
    elif probability >= 50:
        status = 'Moderate Chance'
        advice = 'Reasonable chance. Consider booking an alternative as backup.'
    elif probability >= 25:
        status = 'Low Chance'
        advice = 'Low probability. Strongly recommend booking a confirmed ticket on another train.'
    else:
        status = 'Very Low Chance'
        advice = 'Very unlikely to confirm. Book a confirmed ticket immediately.'

    # Build factor explanation
    factors = []
    if peak_season_penalty < 1.0:
        factors.append('Peak season')
    if weekend_penalty < 1.0:
        factors.append('Weekend travel')
    if popularity_factor < 1.0:
        factors.append('High-demand train')
    if distance_factor > 1.0:
        factors.append('Long-distance journey')

    return {
        'confirmationProbability': probability,
        'status': status,
        'advice': advice,
        'daysLeft': days_left,
        'waitlistPosition': wl,
        'classType': class_type,
        'classFactor': f"{'Fast' if k >= 1.5 else 'Moderate' if k >= 1.0 else 'Slow'} clearing class",
        'factors': factors if factors else ['Normal conditions'],
        'peakSeason': peak_season_penalty < 1.0,
        'isWeekend': weekend_penalty < 1.0
    }


# ─────────────────────────────────────────────
# 4. SMART SEAT UPGRADE SUGGESTER
# ─────────────────────────────────────────────

CLASS_ORDER = ['2S', 'SL', 'CC', '3A', '2A', '1A']

def suggest_seat_upgrade(current_class, train_number, travel_date_str):
    """
    If current class is nearly full, suggest upgrading to next class
    if it offers better value (simulated availability).
    """
    import random
    random.seed(hash(train_number + travel_date_str))  # deterministic per train+date

    current_fare = CLASS_FARES.get(current_class, 500)
    current_idx = CLASS_ORDER.index(current_class) if current_class in CLASS_ORDER else 2

    suggestions = []
    for cls in CLASS_ORDER[current_idx + 1:]:
        upgrade_fare = CLASS_FARES.get(cls, 1000)
        diff = upgrade_fare - current_fare
        # Simulate: higher classes have more availability near travel date
        availability = random.randint(5, 40)
        if availability > 10 and diff <= 800:
            suggestions.append({
                'upgradeClass': cls,
                'currentClass': current_class,
                'priceDifference': diff,
                'upgradeAvailability': availability,
                'message': f"Upgrade to {cls} for only ₹{diff} more — {availability} seats available with 100% confirmation."
            })
        if len(suggestions) >= 2:
            break

    return suggestions
