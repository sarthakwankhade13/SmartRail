"""
Feature Engineering for Waitlist Confirmation Prediction.

Transforms raw booking inputs into a rich feature vector used by the ML model.
Covers: date features, demand features, quota features, historical stats,
        seasonal intelligence, and derived interaction features.
"""

import math
import hashlib
from datetime import datetime, date

# ── Constants ──────────────────────────────────────────────────────────────────

# Indian public holidays (month, day)
INDIAN_HOLIDAYS = {
    (1, 1), (1, 26),                    # New Year, Republic Day
    (3, 25), (4, 14),                   # Holi, Ambedkar Jayanti
    (8, 15), (10, 2),                   # Independence Day, Gandhi Jayanti
    (10, 24), (11, 1), (11, 15),        # Dussehra, Diwali
    (12, 25),                           # Christmas
}

# Peak travel months (Oct–Feb = winter/festival, Apr–May = summer)
PEAK_MONTHS = {4, 5, 10, 11, 12, 1, 2}

# Festival windows (month, start_day, end_day)
FESTIVAL_WINDOWS = [
    (3, 20, 31),   # Holi
    (10, 15, 31),  # Navratri / Dussehra
    (11, 1, 20),   # Diwali
    (12, 20, 31),  # Christmas / New Year
    (1, 1, 5),     # New Year
    (4, 10, 20),   # Baisakhi / Ram Navami
    (8, 10, 20),   # Janmashtami
]

# Class clearing speed (higher = clears faster)
CLASS_CLEARING_SPEED = {
    '2S': 2.2, 'SL': 1.8, 'CC': 1.0,
    '3A': 1.2, '2A': 0.8, '1A': 0.4,
}

# Quota base confirmation rates (empirical approximations)
QUOTA_BASE_RATE = {
    'GNWL': 0.65,   # General Waitlist — most common, moderate clearance
    'PQWL': 0.35,   # Pooled Quota — harder to confirm
    'RLWL': 0.50,   # Remote Location — moderate
    'TQWL': 0.45,   # Tatkal Quota — moderate
    'RSWL': 0.30,   # Road-Side Waitlist — hardest
    'GNWL': 0.65,
}

# Total seats per class (approximate per coach × typical coach count)
CLASS_TOTAL_SEATS = {
    '2S': 108, 'SL': 72, 'CC': 78,
    '3A': 64,  '2A': 46, '1A': 18,
}


def _seeded_float(seed_str, lo=0.0, hi=1.0):
    """Deterministic pseudo-random float from a seed string."""
    h = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % 10000
    return lo + (h / 10000) * (hi - lo)


def _is_festival(travel_date: date) -> bool:
    """Check if travel date falls in a festival window."""
    for (m, d_start, d_end) in FESTIVAL_WINDOWS:
        if travel_date.month == m and d_start <= travel_date.day <= d_end:
            return True
    return False


def _is_exam_season(travel_date: date) -> bool:
    """March–April and October–November are major exam seasons in India."""
    return travel_date.month in {3, 4, 10, 11}


def _route_popularity(train_number: str, class_type: str) -> float:
    """
    Simulate route popularity score (0–1) deterministically.
    Premium trains (1xxxx) on AC classes are most popular.
    """
    seed = f"pop:{train_number}:{class_type}"
    base = _seeded_float(seed, 0.3, 1.0)
    # Premium train bonus
    if train_number.startswith('1'):
        base = min(base + 0.15, 1.0)
    # AC class bonus
    if class_type in {'3A', '2A', '1A'}:
        base = min(base + 0.10, 1.0)
    return round(base, 3)


def _historical_confirmation_rate(train_number: str, class_type: str, quota: str) -> float:
    """
    Simulate historical confirmation rate for this train/class/quota combo.
    In production this would come from a DB query over past bookings.
    """
    seed = f"hist:{train_number}:{class_type}:{quota}"
    base = QUOTA_BASE_RATE.get(quota, 0.55)
    noise = _seeded_float(seed, -0.10, 0.10)
    return round(max(0.10, min(0.95, base + noise)), 3)


def _cancellation_rate(train_number: str, class_type: str) -> float:
    """Simulate historical cancellation rate for this train/class."""
    seed = f"cancel:{train_number}:{class_type}"
    return round(_seeded_float(seed, 0.05, 0.35), 3)


def _tatkal_pressure(travel_date: date, class_type: str) -> float:
    """
    Tatkal bookings open 1 day before travel and spike demand.
    Returns 0–1 pressure score.
    """
    days_left = (travel_date - date.today()).days
    if days_left <= 1:
        return 0.9
    if days_left <= 3:
        return 0.6
    if class_type in {'3A', '2A', '1A'}:
        return 0.3
    return 0.1


def extract_features(
    train_number: str,
    class_type: str,
    quota: str,
    waitlist_position: int,
    travel_date_str: str,
    booking_date_str: str = None,
    passenger_count: int = 1,
    age_group: str = 'adult',   # child / adult / senior
    distance_km: int = 500,
) -> dict:
    """
    Build the full feature vector for a waitlist prediction request.

    Returns a flat dict of named features (all numeric).
    """
    # ── Parse dates ────────────────────────────────────────────────────────────
    try:
        travel_dt = datetime.strptime(travel_date_str, '%Y-%m-%d').date()
    except Exception:
        travel_dt = date.today()

    if booking_date_str:
        try:
            booking_dt = datetime.strptime(booking_date_str, '%Y-%m-%d').date()
        except Exception:
            booking_dt = date.today()
    else:
        booking_dt = date.today()

    days_before_journey = max((travel_dt - booking_dt).days, 0)
    days_left = max((travel_dt - date.today()).days, 0)

    # ── Date features ──────────────────────────────────────────────────────────
    day_of_week = travel_dt.weekday()          # 0=Mon … 6=Sun
    is_weekend = int(day_of_week >= 5)
    month = travel_dt.month
    quarter = (month - 1) // 3 + 1
    is_holiday = int((travel_dt.month, travel_dt.day) in INDIAN_HOLIDAYS)
    is_festival = int(_is_festival(travel_dt))
    is_peak_season = int(month in PEAK_MONTHS)
    is_exam_season = int(_is_exam_season(travel_dt))

    # ── Waitlist / quota features ──────────────────────────────────────────────
    wl = max(int(waitlist_position), 1)
    class_speed = CLASS_CLEARING_SPEED.get(class_type, 1.0)
    quota_base = QUOTA_BASE_RATE.get(quota, 0.55)
    total_seats = CLASS_TOTAL_SEATS.get(class_type, 72)
    wl_ratio = wl / total_seats                # how full is the waitlist relative to capacity
    wl_log = math.log1p(wl)                    # log-scaled WL position

    # ── Demand features ────────────────────────────────────────────────────────
    route_popularity = _route_popularity(train_number, class_type)
    hist_confirm_rate = _historical_confirmation_rate(train_number, class_type, quota)
    cancel_rate = _cancellation_rate(train_number, class_type)
    tatkal_pressure = _tatkal_pressure(travel_dt, class_type)

    # Booking pressure: how many days before journey was this booked
    # Earlier booking = lower pressure (more time for WL to clear)
    booking_pressure = 1.0 / (1.0 + days_before_journey / 30.0)

    # Demand multiplier (composite)
    demand_mult = (
        1.0
        + 0.15 * is_weekend
        + 0.25 * is_holiday
        + 0.20 * is_festival
        + 0.10 * is_peak_season
        + 0.08 * is_exam_season
    )

    # ── Time-series proxy features ─────────────────────────────────────────────
    # Seat movement velocity: how fast WL typically moves for this class
    # Approximated as: (historical_confirm_rate × class_speed) / days_left
    if days_left > 0:
        seat_movement_velocity = (hist_confirm_rate * class_speed) / days_left
    else:
        seat_movement_velocity = 0.0

    # Trend momentum: days_before_journey × class_speed (more time = more movement)
    trend_momentum = min(days_before_journey * class_speed / 60.0, 1.0)

    # ── Interaction features ───────────────────────────────────────────────────
    # Core signal: days available per WL position (adjusted for class speed)
    days_per_wl = (days_left * class_speed) / wl if wl > 0 else days_left * class_speed

    # Demand-adjusted days per WL
    demand_adj_days_per_wl = days_per_wl / demand_mult

    # Cancellation benefit: higher cancel rate → more seats free up
    cancel_benefit = cancel_rate * total_seats / wl if wl > 0 else cancel_rate

    # Distance factor: longer journeys have more intermediate boarding/deboarding
    distance_factor = min(distance_km / 1000.0, 2.0)

    # Passenger count penalty (group bookings harder to confirm together)
    group_penalty = 1.0 / (1.0 + 0.1 * (passenger_count - 1))

    # Age group factor (senior/child quotas sometimes easier)
    age_factor = {'child': 1.1, 'adult': 1.0, 'senior': 1.05}.get(age_group, 1.0)

    return {
        # Date
        'day_of_week':          day_of_week,
        'is_weekend':           is_weekend,
        'month':                month,
        'quarter':              quarter,
        'is_holiday':           is_holiday,
        'is_festival':          is_festival,
        'is_peak_season':       is_peak_season,
        'is_exam_season':       is_exam_season,
        'days_before_journey':  days_before_journey,
        'days_left':            days_left,

        # Waitlist
        'waitlist_position':    wl,
        'wl_ratio':             round(wl_ratio, 4),
        'wl_log':               round(wl_log, 4),
        'class_speed':          class_speed,
        'quota_base_rate':      quota_base,
        'total_seats':          total_seats,

        # Demand
        'route_popularity':     route_popularity,
        'hist_confirm_rate':    hist_confirm_rate,
        'cancel_rate':          cancel_rate,
        'tatkal_pressure':      tatkal_pressure,
        'booking_pressure':     round(booking_pressure, 4),
        'demand_multiplier':    round(demand_mult, 4),

        # Time-series proxies
        'seat_movement_velocity': round(seat_movement_velocity, 6),
        'trend_momentum':         round(trend_momentum, 4),

        # Interactions
        'days_per_wl':              round(days_per_wl, 4),
        'demand_adj_days_per_wl':   round(demand_adj_days_per_wl, 4),
        'cancel_benefit':           round(cancel_benefit, 4),
        'distance_factor':          round(distance_factor, 4),
        'group_penalty':            round(group_penalty, 4),
        'age_factor':               age_factor,
    }


# Ordered list of feature names (must match training order)
FEATURE_NAMES = [
    'day_of_week', 'is_weekend', 'month', 'quarter',
    'is_holiday', 'is_festival', 'is_peak_season', 'is_exam_season',
    'days_before_journey', 'days_left',
    'waitlist_position', 'wl_ratio', 'wl_log',
    'class_speed', 'quota_base_rate', 'total_seats',
    'route_popularity', 'hist_confirm_rate', 'cancel_rate',
    'tatkal_pressure', 'booking_pressure', 'demand_multiplier',
    'seat_movement_velocity', 'trend_momentum',
    'days_per_wl', 'demand_adj_days_per_wl', 'cancel_benefit',
    'distance_factor', 'group_penalty', 'age_factor',
]


def features_to_vector(feat_dict: dict) -> list:
    """Convert feature dict to ordered list for model input."""
    return [feat_dict[k] for k in FEATURE_NAMES]
