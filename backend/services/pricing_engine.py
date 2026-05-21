"""
Dynamic Pricing Engine for RailAI
Generates historical price data, future price predictions, booking window
recommendations, and demand analysis for Indian Railways trains.
"""

import hashlib
import random
from datetime import datetime, timedelta

# Indian public holidays (month, day) — approximate
HOLIDAYS = {
    (1, 26),   # Republic Day
    (3, 25),   # Holi (approximate)
    (4, 14),   # Ambedkar Jayanti / Baisakhi
    (8, 15),   # Independence Day
    (10, 2),   # Gandhi Jayanti
    (10, 24),  # Dussehra (approximate)
    (11, 1),   # Diwali (approximate)
    (11, 15),  # Diwali (alternate)
    (12, 25),  # Christmas
}

# Peak season: October through February (month numbers)
PEAK_MONTHS = {10, 11, 12, 1, 2}


def _seeded_random(seed_str):
    """Return a seeded Random instance for deterministic results."""
    seed_int = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % (2 ** 31)
    rng = random.Random(seed_int)
    return rng


def _demand_multiplier(date, rng):
    """
    Compute a demand multiplier for a given date.
    Weekends +15%, holidays +25%, peak season +10%.
    Random noise ±5%.
    """
    multiplier = 1.0

    # Weekend check
    if date.weekday() >= 5:  # Saturday=5, Sunday=6
        multiplier += 0.15

    # Holiday check
    if (date.month, date.day) in HOLIDAYS:
        multiplier += 0.25

    # Peak season check
    if date.month in PEAK_MONTHS:
        multiplier += 0.10

    # Random noise ±5%
    noise = rng.uniform(-0.05, 0.05)
    multiplier += noise

    return multiplier


def _days_to_travel_multiplier(days_to_travel):
    """
    Prices rise as travel date approaches.
    Last 3 days: +35%, last 7 days: +20%, otherwise no extra.
    """
    if days_to_travel <= 3:
        return 1.35
    if days_to_travel <= 7:
        return 1.20
    return 1.0


def _demand_level_from_multiplier(multiplier):
    """Map a multiplier value to a human-readable demand level."""
    if multiplier >= 1.40:
        return 'Very High'
    if multiplier >= 1.20:
        return 'High'
    if multiplier >= 1.05:
        return 'Moderate'
    return 'Low'


def generate_price_history(train_number, class_type, travel_date_str, base_fare):
    """
    Generate 30 days of simulated historical price data ending yesterday.

    Returns:
        list of dicts: [{date, price, demand_level}, ...]
    """
    try:
        travel_date = datetime.strptime(travel_date_str, '%Y-%m-%d')
    except (ValueError, TypeError):
        travel_date = datetime.today() + timedelta(days=30)

    today = datetime.today().replace(hour=0, minute=0, second=0, microsecond=0)
    seed_str = f"{train_number}:{class_type}:{travel_date_str}:history"
    rng = _seeded_random(seed_str)

    history = []
    for i in range(30, 0, -1):
        record_date = today - timedelta(days=i)
        days_to_travel = (travel_date - record_date).days

        demand_mult = _demand_multiplier(record_date, rng)
        travel_mult = _days_to_travel_multiplier(max(days_to_travel, 0))

        price = round(base_fare * demand_mult * travel_mult)
        price = max(price, int(base_fare * 0.80))  # floor at 80% of base

        history.append({
            'date': record_date.strftime('%Y-%m-%d'),
            'price': price,
            'demand_level': _demand_level_from_multiplier(demand_mult),
        })

    return history


def predict_future_prices(train_number, class_type, travel_date_str, base_fare):
    """
    Predict prices for the next 14 days from today.

    Returns:
        list of dicts: [{date, price, predicted: True}, ...]
    """
    try:
        travel_date = datetime.strptime(travel_date_str, '%Y-%m-%d')
    except (ValueError, TypeError):
        travel_date = datetime.today() + timedelta(days=30)

    today = datetime.today().replace(hour=0, minute=0, second=0, microsecond=0)
    seed_str = f"{train_number}:{class_type}:{travel_date_str}:future"
    rng = _seeded_random(seed_str)

    future = []
    for i in range(0, 14):
        record_date = today + timedelta(days=i)
        days_to_travel = (travel_date - record_date).days

        demand_mult = _demand_multiplier(record_date, rng)
        travel_mult = _days_to_travel_multiplier(max(days_to_travel, 0))

        price = round(base_fare * demand_mult * travel_mult)
        price = max(price, int(base_fare * 0.80))

        future.append({
            'date': record_date.strftime('%Y-%m-%d'),
            'price': price,
            'predicted': True,
        })

    return future


def get_best_booking_window(travel_date_str, base_fare):
    """
    Analyse the next 14 days to find the optimal booking day.

    Returns:
        dict with bestDayToBook, currentPrice, lowestPrice,
              savingsAmount, recommendation, urgency
    """
    try:
        travel_date = datetime.strptime(travel_date_str, '%Y-%m-%d')
    except (ValueError, TypeError):
        travel_date = datetime.today() + timedelta(days=30)

    today = datetime.today().replace(hour=0, minute=0, second=0, microsecond=0)
    days_until_travel = (travel_date - today).days

    # Use a stable seed for the booking window analysis
    seed_str = f"window:{travel_date_str}:{base_fare}"
    rng = _seeded_random(seed_str)

    # Build price forecast for next 14 days
    forecast = []
    for i in range(14):
        record_date = today + timedelta(days=i)
        days_to_travel = (travel_date - record_date).days
        demand_mult = _demand_multiplier(record_date, rng)
        travel_mult = _days_to_travel_multiplier(max(days_to_travel, 0))
        price = round(base_fare * demand_mult * travel_mult)
        price = max(price, int(base_fare * 0.80))
        forecast.append({'date': record_date, 'price': price, 'days_offset': i})

    current_price = forecast[0]['price']
    lowest_entry = min(forecast, key=lambda x: x['price'])
    lowest_price = lowest_entry['price']
    best_day_offset = lowest_entry['days_offset']
    best_day_date = lowest_entry['date'].strftime('%Y-%m-%d')
    savings = max(0, current_price - lowest_price)

    # Urgency based on days until travel
    if days_until_travel <= 3:
        urgency = 'high'
    elif days_until_travel <= 10:
        urgency = 'medium'
    else:
        urgency = 'low'

    # Recommendation text
    if savings > 0 and best_day_offset > 0:
        recommendation = (
            f"Book in {best_day_offset} day{'s' if best_day_offset != 1 else ''} "
            f"to save ₹{savings} (on {best_day_date})"
        )
    elif days_until_travel <= 3:
        recommendation = "Travel is very soon — book immediately to secure your seat."
    else:
        recommendation = f"Current price is already near the lowest. Book now to confirm your seat."

    return {
        'bestDayToBook': best_day_date,
        'currentPrice': current_price,
        'lowestPrice': lowest_price,
        'savingsAmount': savings,
        'recommendation': recommendation,
        'urgency': urgency,
    }


def analyze_demand(train_number, travel_date_str):
    """
    Analyse demand for a train on a given travel date.

    Returns:
        dict with demandLevel, occupancyPercent, peakFactors, availabilityTrend
    """
    try:
        travel_date = datetime.strptime(travel_date_str, '%Y-%m-%d')
    except (ValueError, TypeError):
        travel_date = datetime.today() + timedelta(days=30)

    today = datetime.today().replace(hour=0, minute=0, second=0, microsecond=0)
    days_until_travel = (travel_date - today).days

    seed_str = f"{train_number}:{travel_date_str}:demand"
    rng = _seeded_random(seed_str)

    # Compute base multiplier for the travel date itself
    base_mult = 1.0
    peak_factors = []

    if travel_date.weekday() >= 5:
        base_mult += 0.15
        peak_factors.append('Weekend')

    if (travel_date.month, travel_date.day) in HOLIDAYS:
        base_mult += 0.25
        peak_factors.append('Public Holiday')

    if travel_date.month in PEAK_MONTHS:
        base_mult += 0.10
        peak_factors.append('Peak Season (Oct–Feb)')

    # Days-to-travel pressure
    if days_until_travel <= 3:
        base_mult += 0.20
        peak_factors.append('Last-Minute Booking')
    elif days_until_travel <= 7:
        base_mult += 0.10
        peak_factors.append('Near Departure')

    # Festival season heuristic (Oct–Nov)
    if travel_date.month in {10, 11}:
        peak_factors.append('Festival Season')

    # Simulated occupancy: base 55% + demand pressure + train-specific noise
    train_seed_noise = rng.randint(-8, 12)
    occupancy = min(99, max(30, round(55 + (base_mult - 1.0) * 100 + train_seed_noise)))

    demand_level = _demand_level_from_multiplier(base_mult)

    # Availability trend
    if occupancy >= 85:
        availability_trend = 'Filling Fast'
    elif occupancy >= 65:
        availability_trend = 'Stable'
    else:
        availability_trend = 'Plenty Available'

    return {
        'demandLevel': demand_level,
        'occupancyPercent': occupancy,
        'peakFactors': peak_factors,
        'availabilityTrend': availability_trend,
    }
