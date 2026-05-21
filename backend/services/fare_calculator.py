"""
IRCTC-style Fare Calculator
Based on Indian Railways official fare rules:
- Distance-based slab rates (per km)
- Class multipliers
- Train type surcharges (Rajdhani, Shatabdi, Duronto, etc.)
- Reservation charge + superfast charge
- GST on AC classes
"""

import math

# ── Base fare slabs (₹ per km) for Sleeper class ──────────────────────────────
# Source: Indian Railways fare table (approximate)
SLEEPER_SLABS = [
    (0,    50,   0.51),
    (51,   100,  0.47),
    (101,  150,  0.44),
    (151,  200,  0.42),
    (201,  250,  0.40),
    (251,  300,  0.38),
    (301,  400,  0.36),
    (401,  500,  0.34),
    (501,  600,  0.32),
    (601,  700,  0.30),
    (701,  900,  0.28),
    (901,  1200, 0.26),
    (1201, 1500, 0.24),
    (1501, 9999, 0.22),
]

# ── Class multipliers over Sleeper base ───────────────────────────────────────
CLASS_MULTIPLIER = {
    '2S': 0.55,   # Second Sitting
    'SL': 1.00,   # Sleeper (base)
    'CC': 1.40,   # AC Chair Car
    '3E': 1.60,   # AC 3 Economy
    '3A': 2.00,   # AC 3 Tier
    '2A': 2.90,   # AC 2 Tier
    'FC': 2.50,   # First Class (non-AC)
    '1A': 4.00,   # AC First Class
    'EC': 3.50,   # Executive Chair Car
    'EA': 4.50,   # Anubhuti (premium)
}

# ── Train type surcharge (flat ₹ added to base) ───────────────────────────────
TRAIN_TYPE_SURCHARGE = {
    'Raj':    75,   # Rajdhani
    'Sht':    50,   # Shatabdi
    'Dur':    60,   # Duronto
    'SF':     30,   # Superfast
    'Exp':    15,   # Express
    'Pass':   0,    # Passenger
    'MEMU':   0,
    'DEMU':   0,
    'Jan':    10,   # Jan Shatabdi
    'Grt':    20,   # Garib Rath
    'Humsafar': 40,
    'Tejas':  80,
    'Vande':  90,   # Vande Bharat
}

# ── Fixed charges ─────────────────────────────────────────────────────────────
RESERVATION_CHARGE = {
    '2S': 15, 'SL': 20, 'CC': 40, '3E': 40,
    '3A': 40, '2A': 50, 'FC': 40, '1A': 60,
    'EC': 40, 'EA': 60,
}

SUPERFAST_CHARGE = {
    '2S': 10, 'SL': 15, 'CC': 30, '3E': 30,
    '3A': 30, '2A': 40, 'FC': 30, '1A': 45,
    'EC': 30, 'EA': 45,
}

# GST applies to AC classes only (5%)
AC_CLASSES = {'CC', '3E', '3A', '2A', '1A', 'EC', 'EA'}
GST_RATE = 0.05

# Minimum fare
MIN_FARE = {'2S': 10, 'SL': 30, 'CC': 50, '3E': 60,
            '3A': 80, '2A': 120, 'FC': 80, '1A': 200,
            'EC': 100, 'EA': 250}


def _base_fare_for_distance(distance_km):
    """Calculate sleeper base fare using distance slabs."""
    fare = 0.0
    remaining = distance_km

    for (low, high, rate) in SLEEPER_SLABS:
        if remaining <= 0:
            break
        slab_km = min(remaining, high - low + 1)
        fare += slab_km * rate
        remaining -= slab_km

    return fare


def calculate_fare(distance_km, class_type='SL', train_type='Exp', is_superfast=True):
    """
    Calculate realistic IRCTC fare.

    Args:
        distance_km: Journey distance in km
        class_type: e.g. 'SL', '3A', '2A', '1A', 'CC'
        train_type: e.g. 'Raj', 'SF', 'Exp', 'Sht'
        is_superfast: Whether train has superfast surcharge

    Returns:
        dict with fare breakdown
    """
    if distance_km <= 0:
        distance_km = 500  # fallback

    class_type = class_type.upper()
    if class_type not in CLASS_MULTIPLIER:
        class_type = 'SL'

    # 1. Base fare (sleeper rate × class multiplier)
    base = _base_fare_for_distance(distance_km)
    class_fare = base * CLASS_MULTIPLIER.get(class_type, 1.0)

    # 2. Train type surcharge
    surcharge = TRAIN_TYPE_SURCHARGE.get(train_type, 15)

    # 3. Reservation charge
    res_charge = RESERVATION_CHARGE.get(class_type, 20)

    # 4. Superfast charge
    sf_charge = SUPERFAST_CHARGE.get(class_type, 15) if is_superfast else 0

    # 5. Subtotal before GST
    subtotal = class_fare + surcharge + res_charge + sf_charge

    # 6. GST (AC classes only)
    gst = round(subtotal * GST_RATE) if class_type in AC_CLASSES else 0

    # 7. Total
    total = math.ceil(subtotal + gst)

    # Apply minimum fare
    total = max(total, MIN_FARE.get(class_type, 30))

    return {
        'baseFare': round(class_fare),
        'trainSurcharge': surcharge,
        'reservationCharge': res_charge,
        'superfastCharge': sf_charge,
        'gst': gst,
        'totalFare': total,
        'distanceKm': distance_km,
        'classType': class_type,
        'trainType': train_type,
    }


def get_all_class_fares(distance_km, train_type='Exp', is_superfast=True):
    """Return fares for all available classes for a given distance."""
    classes = ['2S', 'SL', 'CC', '3E', '3A', '2A', 'FC', '1A', 'EC']
    return {
        cls: calculate_fare(distance_km, cls, train_type, is_superfast)
        for cls in classes
    }


def estimate_distance_from_stops(src_stop_id, dst_stop_id, total_stops, total_distance):
    """Estimate distance between two stops proportionally."""
    if total_stops <= 1 or total_distance <= 0:
        return total_distance or 500
    proportion = abs(dst_stop_id - src_stop_id) / total_stops
    return max(50, round(proportion * total_distance))


def get_train_type_from_name(train_name):
    """Infer train type from name for surcharge calculation."""
    name = train_name.upper()
    if any(w in name for w in ['RAJDHANI', 'RAJ']):
        return 'Raj', True
    if any(w in name for w in ['SHATABDI', 'SHT']):
        return 'Sht', True
    if 'DURONTO' in name:
        return 'Dur', True
    if 'VANDE BHARAT' in name or 'VANDE' in name:
        return 'Vande', True
    if 'TEJAS' in name:
        return 'Tejas', True
    if 'HUMSAFAR' in name:
        return 'Humsafar', True
    if 'GARIB RATH' in name or 'GARIB' in name:
        return 'Grt', True
    if 'JAN SHATABDI' in name:
        return 'Jan', True
    if any(w in name for w in ['SUPERFAST', 'SF EXP', 'SF EXPRESS']):
        return 'SF', True
    if 'EXPRESS' in name or 'EXP' in name:
        return 'Exp', False
    if any(w in name for w in ['PASSENGER', 'PASS']):
        return 'Pass', False
    return 'Exp', False
