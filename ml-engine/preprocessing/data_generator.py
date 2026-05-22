"""
============================================================================
 Enterprise Synthetic Railway Booking Dataset Generator
 -------------------------------------------------------
 Generates 100,000 realistic Indian Railways booking records with:
   - Basic, Passenger, Operational, External, and Historical features
   - Realistic probability-driven confirmation outcomes
============================================================================
"""

import pandas as pd
import numpy as np
import random
import os
from datetime import datetime, timedelta

# ── Constants ──────────────────────────────────────────────────────────────

TRAINS = {
    '12951': ('Mumbai Rajdhani', 'NDLS', 'BCT', 1384),
    '12952': ('Mumbai Rajdhani', 'BCT', 'NDLS', 1384),
    '12301': ('Howrah Rajdhani', 'NDLS', 'HWH', 1447),
    '12302': ('Howrah Rajdhani', 'HWH', 'NDLS', 1447),
    '12127': ('Pune Intercity', 'CSTM', 'PUNE', 192),
    '12128': ('Pune Intercity', 'PUNE', 'CSTM', 192),
    '11019': ('Konkan Kanya Exp', 'CSTM', 'MAO', 765),
    '11020': ('Konkan Kanya Exp', 'MAO', 'CSTM', 765),
    '12925': ('Paschim Exp', 'BCT', 'ASR', 1930),
    '12926': ('Paschim Exp', 'ASR', 'BCT', 1930),
    '12239': ('Duronto Exp', 'CSTM', 'ADI', 493),
    '12240': ('Duronto Exp', 'ADI', 'CSTM', 493),
    '12953': ('August Kranti', 'BCT', 'NDLS', 1384),
    '12954': ('August Kranti', 'NDLS', 'BCT', 1384),
    '12433': ('Chennai Rajdhani', 'NDLS', 'MAS', 2175),
    '12434': ('Chennai Rajdhani', 'MAS', 'NDLS', 2175),
    '12621': ('Tamil Nadu Exp', 'NDLS', 'MAS', 2175),
    '12622': ('Tamil Nadu Exp', 'MAS', 'NDLS', 2175),
    '12801': ('Purushottam Exp', 'NDLS', 'PURI', 1853),
    '12802': ('Purushottam Exp', 'PURI', 'NDLS', 1853),
    '16031': ('Andaman Exp', 'MAS', 'VSKP', 792),
    '16032': ('Andaman Exp', 'VSKP', 'MAS', 792),
    '12723': ('Telangana Exp', 'NDLS', 'SC', 1659),
    '12724': ('Telangana Exp', 'SC', 'NDLS', 1659),
    '12559': ('Shiv Ganga Exp', 'NDLS', 'BSB', 764),
    '12560': ('Shiv Ganga Exp', 'BSB', 'NDLS', 764),
    '22691': ('Rajdhani Exp', 'NDLS', 'BNC', 2367),
    '22692': ('Rajdhani Exp', 'BNC', 'NDLS', 2367),
    '12309': ('Rajdhani Exp', 'NDLS', 'PNBE', 1001),
    '12310': ('Rajdhani Exp', 'PNBE', 'NDLS', 1001),
}

INTERMEDIATE_STATIONS = {
    'NDLS': ['GZB', 'CNB', 'ALD', 'MGS'],
    'BCT': ['BRC', 'ST', 'ADI', 'RTM'],
    'CSTM': ['TNA', 'KYN', 'LNL', 'PUNE'],
    'HWH': ['DHN', 'GMO', 'KOAA', 'BWN'],
    'MAS': ['AJJ', 'KPD', 'JTJ', 'SA'],
}

CLASS_SEATS = {'SL': 500, '3A': 200, '2A': 150, '1A': 50, 'CC': 70}
CLASS_COACHES = {'SL': 12, '3A': 5, '2A': 4, '1A': 1, 'CC': 2}

FESTIVALS = [
    ('Diwali', 10, 11), ('Holi', 3, 3), ('Eid', 4, 5),
    ('Christmas', 12, 12), ('Pongal', 1, 1), ('Navratri', 10, 10),
    ('Durga Puja', 10, 10), ('Ganesh Chaturthi', 9, 9),
]


def _get_season(month):
    if month in [3, 4, 5]: return 'Summer'
    if month in [6, 7, 8, 9]: return 'Monsoon'
    if month in [10, 11]: return 'Autumn'
    return 'Winter'


def _get_weather(season):
    weights = {
        'Summer':  [0.6, 0.1, 0.05, 0.25],
        'Monsoon': [0.15, 0.55, 0.1, 0.2],
        'Autumn':  [0.65, 0.1, 0.15, 0.1],
        'Winter':  [0.5, 0.05, 0.35, 0.1],
    }
    return np.random.choice(['Clear', 'Rainy', 'Foggy', 'Stormy'], p=weights[season])


def _get_time_slot(hour):
    if hour < 6: return 'Night'
    if hour < 12: return 'Morning'
    if hour < 18: return 'Afternoon'
    return 'Evening'


def _is_festival_period(date):
    month = date.month
    for name, m_start, m_end in FESTIVALS:
        if m_start <= month <= m_end:
            if random.random() < 0.35:
                return True, name
    return False, 'None'


def _compute_confirmation_probability(row):
    """
    Sophisticated probability model based on ALL input features.
    Returns a probability 0-100.
    """
    prob = 50.0  # Base probability

    # ── Waitlist position impact (strongest factor) ──
    wl = row['current_waitlist_number']
    total = row['total_seats']
    wl_ratio = wl / max(total, 1)
    prob -= wl_ratio * 80  # High WL = massive drop

    # ── Days before journey (more time = more cancellations = better chance) ──
    days = row['days_before_journey']
    prob += min(days * 0.5, 25)

    # ── Cancellation ratio (higher cancellations = better chance) ──
    prob += row['cancellation_ratio'] * 40

    # ── Historical confirmation rate ──
    prob += (row['historical_confirmation_rate'] - 0.5) * 30

    # ── Class impact (SL clears fastest, 1A slowest) ──
    class_bonus = {'SL': 12, '3A': 6, 'CC': 4, '2A': -2, '1A': -10}
    prob += class_bonus.get(row['class_type'], 0)

    # ── Quota impact (GNWL best, TQWL worst) ──
    quota_bonus = {'GNWL': 8, 'PQWL': 2, 'RLWL': -2, 'TQWL': -8}
    prob += quota_bonus.get(row['booking_quota'], 0)

    # ── Peak season / festival penalty ──
    if row['is_peak_season']:
        prob -= 10
    if row['is_festival']:
        prob -= 8
    if row['is_holiday']:
        prob -= 5

    # ── Route popularity (popular routes harder) ──
    prob -= (row['route_popularity_score'] - 50) * 0.15

    # ── Tatkal pressure ──
    prob -= row['tatkal_booking_pressure'] * 0.1

    # ── Senior citizen slight priority ──
    if row['age_group'] == 'Senior':
        prob += 5

    # ── Add stochastic noise ──
    prob += np.random.normal(0, 6)

    return np.clip(prob, 1, 99)


def generate_dataset(num_records=100000, seed=42):
    """Generate comprehensive synthetic railway booking dataset."""
    np.random.seed(seed)
    random.seed(seed)

    print(f"[DataGen] Generating {num_records:,} synthetic booking records...")
    records = []
    start_date = datetime(2023, 1, 1)

    for i in range(num_records):
        # ── Select Train ──
        train_no = random.choice(list(TRAINS.keys()))
        train_name, src, dst, distance = TRAINS[train_no]

        # ── Boarding station ──
        if src in INTERMEDIATE_STATIONS and random.random() < 0.3:
            boarding = random.choice(INTERMEDIATE_STATIONS[src])
        else:
            boarding = src

        # ── Dates ──
        journey_date = start_date + timedelta(days=random.randint(0, 730))
        days_before = int(np.random.gamma(shape=2.5, scale=12.0))
        days_before = max(1, min(days_before, 120))
        booking_date = journey_date - timedelta(days=days_before)

        # ── Date features ──
        dow = journey_date.weekday()
        is_weekend = 1 if dow >= 5 else 0
        month = journey_date.month
        season = _get_season(month)
        is_peak = 1 if month in [5, 6, 10, 11, 12] else 0
        is_holiday = 1 if random.random() < 0.10 else 0
        is_fest, fest_name = _is_festival_period(journey_date)
        is_festival = 1 if is_fest else 0
        time_slot = _get_time_slot(random.randint(0, 23))

        # ── Passenger ──
        cls = np.random.choice(['SL', '3A', '2A', '1A', 'CC'], p=[0.45, 0.30, 0.12, 0.05, 0.08])
        quota = np.random.choice(['GNWL', 'PQWL', 'RLWL', 'TQWL'], p=[0.65, 0.15, 0.12, 0.08])
        wl_position = max(1, int(np.random.exponential(scale=25)))
        rac_count = random.randint(0, 30)
        pax_count = random.choices([1, 2, 3, 4, 5, 6], weights=[30, 35, 20, 10, 3, 2])[0]
        age_group = np.random.choice(['Child', 'Youth', 'Adult', 'Senior'], p=[0.05, 0.15, 0.60, 0.20])

        # ── Operational ──
        total_seats = CLASS_SEATS[cls]
        coach_count = CLASS_COACHES[cls]
        dynamic_avail = max(0, total_seats - wl_position - rac_count - random.randint(0, 50))
        hist_occ = round(np.random.uniform(0.60, 1.00), 3)
        cancel_ratio = round(np.random.uniform(0.05, 0.35), 3)
        delay_hist = random.choices(range(0, 241), weights=[50] + [1]*240)[0]
        route_pop = random.randint(1, 100)
        peak_demand = random.randint(1, 100)
        hist_conf_rate = round(np.random.uniform(0.30, 0.95), 3)
        tatkal_pressure = random.randint(0, 100)

        # ── External ──
        weather = _get_weather(season)
        school_hol = 1 if month in [5, 6, 12] and random.random() < 0.5 else 0
        long_wknd = 1 if is_weekend and is_holiday else 0
        state_hol = 1 if random.random() < 0.08 else 0
        exam_season = 1 if month in [2, 3, 4, 5] and random.random() < 0.4 else 0
        tourism = 1 if month in [10, 11, 12, 1, 2, 3] and random.random() < 0.35 else 0

        # ── Historical trends ──
        booking_trend_30d = random.randint(50, 500)
        cancel_trend_90d = round(np.random.uniform(0.05, 0.40), 3)
        same_date_prev_occ = round(np.random.uniform(0.50, 1.00), 3)
        demand_trend = np.random.choice(['Rising', 'Stable', 'Declining'], p=[0.3, 0.5, 0.2])
        seat_mvmt = np.random.choice(['Fast', 'Moderate', 'Slow'], p=[0.3, 0.45, 0.25])

        # ── Build record ──
        rec = {
            'train_number': train_no,
            'train_name': train_name,
            'source_station': src,
            'destination_station': dst,
            'boarding_station': boarding,
            'travel_distance': distance,
            'journey_date': journey_date.strftime('%Y-%m-%d'),
            'booking_date': booking_date.strftime('%Y-%m-%d'),
            'days_before_journey': days_before,
            'journey_day': journey_date.strftime('%A'),
            'is_weekend': is_weekend,
            'is_holiday': is_holiday,
            'is_festival': is_festival,
            'season': season,
            'time_slot': time_slot,
            'class_type': cls,
            'booking_quota': quota,
            'current_waitlist_number': wl_position,
            'rac_count': rac_count,
            'passenger_count': pax_count,
            'age_group': age_group,
            'total_seats': total_seats,
            'dynamic_seat_availability': dynamic_avail,
            'coach_count': coach_count,
            'historical_occupancy': hist_occ,
            'cancellation_ratio': cancel_ratio,
            'train_delay_history': delay_hist,
            'route_popularity_score': route_pop,
            'peak_demand_score': peak_demand,
            'historical_confirmation_rate': hist_conf_rate,
            'tatkal_booking_pressure': tatkal_pressure,
            'weather': weather,
            'festival_name': fest_name,
            'school_holiday': school_hol,
            'long_weekend': long_wknd,
            'state_holiday': state_hol,
            'exam_season': exam_season,
            'tourism_season': tourism,
            'booking_trend_30d': booking_trend_30d,
            'cancellation_trend_90d': cancel_trend_90d,
            'same_date_prev_year_occupancy': same_date_prev_occ,
            'route_demand_trend': demand_trend,
            'seat_movement_pattern': seat_mvmt,
        }

        # ── Compute Confirmation Probability ──
        conf_prob = _compute_confirmation_probability(rec)
        rec['confirmation_probability'] = round(conf_prob, 2)

        # ── RAC probability ──
        rac_prob = max(1, min(40, 100 - conf_prob + np.random.normal(0, 5)))
        rec['rac_probability'] = round(rac_prob, 2)

        # ── Expected WL movement ──
        rec['expected_wl_movement'] = max(0, int(wl_position * cancel_ratio * (days_before / 30)))

        # ── Final status ──
        r = random.random() * 100
        if r < conf_prob:
            rec['final_status'] = 'CONFIRMED'
        elif r < conf_prob + rac_prob:
            rec['final_status'] = 'RAC'
        else:
            rec['final_status'] = 'WL'

        records.append(rec)

        if (i + 1) % 25000 == 0:
            print(f"  Generated {i+1:,} / {num_records:,} records...")

    df = pd.DataFrame(records)

    # ── Save ──
    data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    os.makedirs(data_dir, exist_ok=True)
    out_path = os.path.join(data_dir, 'historical_bookings.csv')
    df.to_csv(out_path, index=False)

    # ── Stats ──
    print(f"\n{'='*60}")
    print(f"  Dataset Generated: {len(df):,} records")
    print(f"  Columns: {len(df.columns)}")
    print(f"  Saved to: {out_path}")
    print(f"{'='*60}")
    print(f"\n  Status Distribution:")
    print(df['final_status'].value_counts().to_string())
    print(f"\n  Class Distribution:")
    print(df['class_type'].value_counts().to_string())
    print(f"\n  Avg Confirmation Prob: {df['confirmation_probability'].mean():.1f}%")
    print(f"  Avg WL Position: {df['current_waitlist_number'].mean():.1f}")

    return df


if __name__ == "__main__":
    generate_dataset()
