1"""
Production Prediction Engine for SmartRail Waitlist Confirmation.

Loads the trained ML model and provides:
  - predict()         → full prediction with SHAP-style explanations
  - predict_timeline()→ probability over time (confirmation graph)
  - get_model_meta()  → model performance stats
  - ensure_model()    → auto-trains if model file missing
"""

import os
import pickle
import logging
import math
import numpy as np
from datetime import date, timedelta

from ml.features import (
    extract_features, features_to_vector, FEATURE_NAMES,
    CLASS_CLEARING_SPEED, CLASS_TOTAL_SEATS,
)

log = logging.getLogger(__name__)

MODEL_DIR  = os.path.join(os.path.dirname(__file__), 'model')
MODEL_PATH = os.path.join(MODEL_DIR, 'waitlist_model.pkl')
META_PATH  = os.path.join(MODEL_DIR, 'model_meta.pkl')

_model = None
_meta  = None


def _load_model():
    """Load model from disk (lazy, cached)."""
    global _model, _meta
    if _model is not None:
        return _model

    if not os.path.exists(MODEL_PATH):
        log.warning("Model not found — training now (first-run setup)...")
        ensure_model()

    with open(MODEL_PATH, 'rb') as f:
        _model = pickle.load(f)

    if os.path.exists(META_PATH):
        with open(META_PATH, 'rb') as f:
            _meta = pickle.load(f)

    log.info("ML model loaded successfully.")
    return _model


def ensure_model():
    """Train and save the model if it doesn't exist yet."""
    if os.path.exists(MODEL_PATH):
        return
    log.info("Training ML model for the first time...")
    from ml.train_model import train
    train(n_samples=25000)


def get_model_meta() -> dict:
    """Return model metadata (accuracy, ROC-AUC, training date, etc.)."""
    global _meta
    if _meta is None and os.path.exists(META_PATH):
        with open(META_PATH, 'rb') as f:
            _meta = pickle.load(f)
    if _meta is None:
        return {'status': 'model not trained yet'}
    return {
        'trainedAt':    _meta.get('trained_at'),
        'nSamples':     _meta.get('n_samples'),
        'testAccuracy': _meta.get('test_metrics', {}).get('accuracy'),
        'testRocAuc':   _meta.get('test_metrics', {}).get('roc_auc'),
        'cvRocAuc':     _meta.get('cv_roc_auc_mean'),
        'cvRocAucStd':  _meta.get('cv_roc_auc_std'),
        'topFeatures':  [
            {'feature': name, 'importance': round(float(imp), 4)}
            for name, imp in (_meta.get('feature_importances') or [])[:10]
        ],
    }


def _shap_approximation(model, feat_vector: list, feat_dict: dict) -> list:
    """
    Lightweight SHAP-style feature attribution using finite differences.
    Perturbs each feature by ±10% and measures probability change.
    Returns top influential features with direction and magnitude.
    """
    try:
        base_vec = np.array([feat_vector], dtype=np.float32)
        base_prob = model.predict_proba(base_vec)[0][1]

        attributions = []
        for i, name in enumerate(FEATURE_NAMES):
            val = feat_vector[i]
            if val == 0:
                perturbed = 0.1
            else:
                perturbed = val * 1.1

            vec_up = base_vec.copy()
            vec_up[0][i] = perturbed
            prob_up = model.predict_proba(vec_up)[0][1]

            delta = prob_up - base_prob
            attributions.append((name, delta, feat_dict.get(name, val)))

        # Sort by absolute impact
        attributions.sort(key=lambda x: -abs(x[1]))
        return attributions[:8]
    except Exception as e:
        log.warning(f"SHAP approximation failed: {e}")
        return []


def _build_explanation(attributions: list, feat_dict: dict) -> list:
    """Convert raw attributions into human-readable explanations."""
    LABELS = {
        'days_left':            ('Days until travel',       'More days = more time for WL to clear'),
        'waitlist_position':    ('Waitlist position',       'Lower WL number = higher chance'),
        'class_speed':          ('Class clearing speed',    'SL clears faster than AC classes'),
        'hist_confirm_rate':    ('Historical confirm rate', 'Past confirmation rate for this route/class'),
        'cancel_rate':          ('Cancellation rate',       'Higher cancellations free up more seats'),
        'is_peak_season':       ('Peak season',             'Oct–Feb and Apr–May are high-demand periods'),
        'is_festival':          ('Festival period',         'Festivals spike demand significantly'),
        'is_weekend':           ('Weekend travel',          'Weekends have higher demand'),
        'demand_multiplier':    ('Demand level',            'Combined demand pressure on this date'),
        'route_popularity':     ('Route popularity',        'Popular routes fill up faster'),
        'quota_base_rate':      ('Booking quota',           'GNWL confirms more often than PQWL/RLWL'),
        'days_per_wl':          ('Days per WL position',    'Key signal: time available per WL slot'),
        'tatkal_pressure':      ('Tatkal pressure',         'Last-minute Tatkal bookings reduce availability'),
        'wl_ratio':             ('WL fill ratio',           'How full the waitlist is relative to capacity'),
        'seat_movement_velocity': ('Seat movement speed',  'How fast seats are moving for this class'),
    }

    result = []
    for name, delta, value in attributions:
        label, desc = LABELS.get(name, (name.replace('_', ' ').title(), ''))
        direction = 'positive' if delta > 0 else 'negative'
        impact = abs(delta) * 100  # convert to percentage points

        result.append({
            'feature':   name,
            'label':     label,
            'value':     round(float(value), 3),
            'impact':    round(impact, 2),
            'direction': direction,
            'description': desc,
        })

    return result


def _risk_level(prob: float) -> str:
    if prob >= 75:
        return 'Low'
    if prob >= 45:
        return 'Medium'
    return 'High'


def _advice(prob: float, days_left: int, wl: int) -> str:
    if prob >= 80:
        return 'Very likely to confirm. Safe to plan your trip.'
    if prob >= 65:
        return 'Good chance of confirmation. Keep an eye on status.'
    if prob >= 45:
        return 'Moderate chance. Consider booking an alternative as backup.'
    if prob >= 25:
        return 'Low probability. Strongly recommend a confirmed ticket on another train.'
    return 'Very unlikely to confirm. Book a confirmed ticket immediately.'


def _expected_confirmation_time(prob: float, days_left: int) -> str:
    """Estimate when the ticket might confirm."""
    if prob >= 80:
        if days_left > 14:
            return f"Within {max(1, days_left - 10)} days"
        return "Within 1–3 days"
    if prob >= 60:
        return f"Within {max(3, days_left // 2)} days"
    if prob >= 40:
        return f"Closer to departure ({max(1, days_left - 3)} days)"
    return "Unlikely before departure"


def predict(
    train_number: str,
    class_type: str,
    quota: str,
    waitlist_position: int,
    travel_date_str: str,
    booking_date_str: str = None,
    passenger_count: int = 1,
    age_group: str = 'adult',
    distance_km: int = 500,
) -> dict:
    """
    Main prediction function.

    Returns:
        confirmationProbability: float (0–100)
        racProbability:          float (0–100)
        riskLevel:               str (Low/Medium/High)
        status:                  str
        advice:                  str
        expectedConfirmationTime: str
        confidenceScore:         float (0–100)
        daysLeft:                int
        explanation:             list of feature attributions
        modelInfo:               dict
    """
    model = _load_model()

    # Build features
    feat_dict = extract_features(
        train_number=train_number,
        class_type=class_type,
        quota=quota,
        waitlist_position=waitlist_position,
        travel_date_str=travel_date_str,
        booking_date_str=booking_date_str,
        passenger_count=passenger_count,
        age_group=age_group,
        distance_km=distance_km,
    )
    feat_vec = features_to_vector(feat_dict)
    X = np.array([feat_vec], dtype=np.float32)

    # Predict
    prob_raw = float(model.predict_proba(X)[0][1])
    prob_pct = round(prob_raw * 100, 1)

    # RAC probability: roughly half of confirmation probability for low WL
    wl = feat_dict['waitlist_position']
    rac_prob = round(min(prob_pct * 0.15, 20.0), 1)
    if wl <= 5:
        rac_prob = round(min(prob_pct * 0.25, 30.0), 1)

    # Confidence score: based on model certainty (distance from 0.5)
    certainty = abs(prob_raw - 0.5) * 2  # 0 = uncertain, 1 = certain
    confidence = round(50 + certainty * 45, 1)  # 50–95 range

    days_left = feat_dict['days_left']

    # SHAP-style explanations
    attributions = _shap_approximation(model, feat_vec, feat_dict)
    explanation  = _build_explanation(attributions, feat_dict)

    return {
        'confirmationProbability': prob_pct,
        'racProbability':          rac_prob,
        'riskLevel':               _risk_level(prob_pct),
        'status':                  (
            'High Chance'    if prob_pct >= 75 else
            'Moderate Chance' if prob_pct >= 45 else
            'Low Chance'     if prob_pct >= 25 else
            'Very Low Chance'
        ),
        'advice':                  _advice(prob_pct, days_left, wl),
        'expectedConfirmationTime': _expected_confirmation_time(prob_pct, days_left),
        'confidenceScore':         confidence,
        'daysLeft':                days_left,
        'classType':               class_type,
        'quota':                   quota,
        'classFactor':             (
            'Fast clearing'     if feat_dict['class_speed'] >= 1.5 else
            'Moderate clearing' if feat_dict['class_speed'] >= 1.0 else
            'Slow clearing'
        ),
        'peakSeason':              bool(feat_dict['is_peak_season']),
        'isFestival':              bool(feat_dict['is_festival']),
        'isWeekend':               bool(feat_dict['is_weekend']),
        'demandLevel':             (
            'Very High' if feat_dict['demand_multiplier'] >= 1.4 else
            'High'      if feat_dict['demand_multiplier'] >= 1.2 else
            'Moderate'  if feat_dict['demand_multiplier'] >= 1.05 else
            'Low'
        ),
        'explanation':             explanation,
        'modelInfo':               {
            'type': 'Stacking Ensemble (GradientBoosting + RandomForest + LogisticRegression)',
            'features': len(FEATURE_NAMES),
        },
    }


def predict_timeline(
    train_number: str,
    class_type: str,
    quota: str,
    waitlist_position: int,
    travel_date_str: str,
    distance_km: int = 500,
) -> list:
    """
    Predict confirmation probability at multiple points in time.
    Returns a list of {daysFromNow, date, probability} for the confirmation graph.
    """
    model = _load_model()
    today = date.today()

    try:
        travel_dt = date.fromisoformat(travel_date_str)
    except Exception:
        travel_dt = today + timedelta(days=30)

    days_total = max((travel_dt - today).days, 1)
    checkpoints = []

    # Sample at: today, 25%, 50%, 75%, and each day in last 7 days
    sample_days = sorted(set(
        [0, days_total // 4, days_total // 2, 3 * days_total // 4] +
        list(range(max(0, days_total - 7), days_total + 1))
    ))

    for d in sample_days:
        check_date = today + timedelta(days=d)
        if check_date > travel_dt:
            break

        booking_date_str = check_date.strftime('%Y-%m-%d')
        feat_dict = extract_features(
            train_number=train_number,
            class_type=class_type,
            quota=quota,
            waitlist_position=waitlist_position,
            travel_date_str=travel_date_str,
            booking_date_str=booking_date_str,
            distance_km=distance_km,
        )
        feat_vec = features_to_vector(feat_dict)
        X = np.array([feat_vec], dtype=np.float32)
        prob = round(float(model.predict_proba(X)[0][1]) * 100, 1)

        checkpoints.append({
            'daysFromNow': d,
            'date':        check_date.strftime('%Y-%m-%d'),
            'probability': prob,
        })

    return checkpoints
