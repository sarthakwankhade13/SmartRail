"""
Synthetic Dataset Generator for Waitlist Prediction Training.

Generates realistic training samples based on Indian Railways booking patterns.
In production, replace with real historical booking data from the DB.

Each sample represents one waitlist booking with a known outcome (confirmed/not).
"""

import random
import math
from datetime import date, timedelta
from ml.features import (
    extract_features, features_to_vector, FEATURE_NAMES,
    CLASS_CLEARING_SPEED, QUOTA_BASE_RATE, CLASS_TOTAL_SEATS,
    INDIAN_HOLIDAYS, PEAK_MONTHS, _is_festival,
)

# Reproducible seed for dataset generation
RANDOM_SEED = 42

# Sample train numbers (mix of premium and regular)
SAMPLE_TRAINS = [
    '12951', '12952', '12301', '12302', '12627', '12628',
    '12001', '12002', '11301', '11302', '12721', '12722',
    '22691', '22692', '12431', '12432', '12259', '12260',
    '12049', '12050', '12565', '12566', '13005', '13006',
    '14003', '14004', '15001', '15002', '16001', '16002',
]

CLASSES = ['SL', '3A', '2A', '1A', 'CC', '2S']
QUOTAS  = ['GNWL', 'PQWL', 'RLWL', 'TQWL']
AGE_GROUPS = ['adult', 'adult', 'adult', 'senior', 'child']  # weighted toward adult


def _true_confirmation_probability(
    wl: int,
    days_left: int,
    class_type: str,
    quota: str,
    is_peak: bool,
    is_festival: bool,
    is_weekend: bool,
    cancel_rate: float,
    hist_rate: float,
    route_pop: float,
) -> float:
    """
    Ground-truth probability function used to label synthetic samples.
    This is the "oracle" that the model learns to approximate.
    """
    speed = CLASS_CLEARING_SPEED.get(class_type, 1.0)
    total = CLASS_TOTAL_SEATS.get(class_type, 72)
    quota_base = QUOTA_BASE_RATE.get(quota, 0.55)

    # Core signal
    if wl <= 0:
        return 0.95
    days_per_wl = (days_left * speed) / wl

    # Sigmoid base
    prob = 1 / (1 + math.exp(-days_per_wl))

    # Demand penalties
    if is_peak:
        prob *= 0.85
    if is_festival:
        prob *= 0.80
    if is_weekend:
        prob *= 0.92

    # Quota adjustment
    prob *= quota_base / 0.65  # normalize to GNWL baseline

    # Cancellation benefit
    cancel_seats = cancel_rate * total
    if cancel_seats > wl:
        prob = min(prob * 1.15, 0.95)

    # Historical rate blend (50% weight)
    prob = 0.5 * prob + 0.5 * hist_rate

    # Route popularity penalty (popular routes fill faster)
    prob *= (1.0 - 0.1 * route_pop)

    # WL position hard caps
    if wl > 100:
        prob *= 0.40
    elif wl > 60:
        prob *= 0.60
    elif wl > 40:
        prob *= 0.75

    # Days left hard caps
    if days_left == 0:
        prob *= 0.20
    elif days_left <= 2:
        prob *= 0.50

    return max(0.02, min(0.97, prob))


def generate_dataset(n_samples: int = 20000, seed: int = RANDOM_SEED):
    """
    Generate n_samples synthetic booking records.

    Returns:
        X: list of feature vectors (list of lists)
        y: list of binary labels (1 = confirmed, 0 = not confirmed)
        probs: list of true probabilities (for calibration)
    """
    rng = random.Random(seed)
    X, y, probs = [], [], []

    today = date.today()

    for _ in range(n_samples):
        # Random booking parameters
        train_number = rng.choice(SAMPLE_TRAINS)
        class_type   = rng.choice(CLASSES)
        quota        = rng.choice(QUOTAS)
        age_group    = rng.choice(AGE_GROUPS)
        passenger_count = rng.randint(1, 4)
        distance_km  = rng.randint(100, 2500)

        # Random travel date (past 2 years for training diversity)
        days_offset = rng.randint(-730, 120)
        travel_dt   = today + timedelta(days=days_offset)
        travel_date_str = travel_dt.strftime('%Y-%m-%d')

        # Booking was made 1–120 days before travel
        days_before = rng.randint(1, 120)
        booking_dt  = travel_dt - timedelta(days=days_before)
        booking_date_str = booking_dt.strftime('%Y-%m-%d')

        # WL position: skewed toward lower numbers (most bookings are WL 1–50)
        wl = int(rng.expovariate(1 / 20)) + 1
        wl = min(wl, 200)

        # Extract features
        feat = extract_features(
            train_number=train_number,
            class_type=class_type,
            quota=quota,
            waitlist_position=wl,
            travel_date_str=travel_date_str,
            booking_date_str=booking_date_str,
            passenger_count=passenger_count,
            age_group=age_group,
            distance_km=distance_km,
        )

        # Compute ground-truth probability
        days_left_at_booking = max((travel_dt - booking_dt).days, 0)
        true_prob = _true_confirmation_probability(
            wl=wl,
            days_left=days_left_at_booking,
            class_type=class_type,
            quota=quota,
            is_peak=feat['is_peak_season'] == 1,
            is_festival=feat['is_festival'] == 1,
            is_weekend=feat['is_weekend'] == 1,
            cancel_rate=feat['cancel_rate'],
            hist_rate=feat['hist_confirm_rate'],
            route_pop=feat['route_popularity'],
        )

        # Stochastic label (Bernoulli draw from true probability)
        label = 1 if rng.random() < true_prob else 0

        X.append(features_to_vector(feat))
        y.append(label)
        probs.append(true_prob)

    return X, y, probs


if __name__ == '__main__':
    X, y, probs = generate_dataset(1000)
    confirmed = sum(y)
    print(f"Generated 1000 samples: {confirmed} confirmed ({confirmed/10:.1f}%)")
    print(f"Feature count: {len(X[0])}")
    print(f"Features: {FEATURE_NAMES}")
