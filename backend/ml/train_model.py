"""
Model Training Script for SmartRail Waitlist Prediction.

Trains an ensemble of:
  1. Gradient Boosting (sklearn GradientBoostingClassifier)
  2. Random Forest
  3. Logistic Regression (calibrated)

Stacks them with a meta-learner (Logistic Regression).
Saves the trained pipeline to ml/model/waitlist_model.pkl

Run from backend/ directory:
    python -m ml.train_model
"""

import os
import pickle
import logging
import numpy as np
from datetime import datetime

from sklearn.ensemble import (
    GradientBoostingClassifier,
    RandomForestClassifier,
    StackingClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, log_loss, brier_score_loss,
)

from ml.dataset import generate_dataset
from ml.features import FEATURE_NAMES

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)

MODEL_DIR  = os.path.join(os.path.dirname(__file__), 'model')
MODEL_PATH = os.path.join(MODEL_DIR, 'waitlist_model.pkl')
META_PATH  = os.path.join(MODEL_DIR, 'model_meta.pkl')


def build_model():
    """
    Build a stacking ensemble:
      Base learners: GradientBoosting + RandomForest + LogisticRegression
      Meta learner:  LogisticRegression (with probability calibration)
    """
    gb = GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=5,
        min_samples_leaf=20,
        subsample=0.8,
        random_state=42,
    )

    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_leaf=10,
        max_features='sqrt',
        random_state=42,
        n_jobs=-1,
    )

    lr = LogisticRegression(
        C=1.0,
        max_iter=500,
        random_state=42,
    )

    # Stacking ensemble
    stacking = StackingClassifier(
        estimators=[
            ('gb', gb),
            ('rf', rf),
            ('lr', lr),
        ],
        final_estimator=LogisticRegression(C=0.5, max_iter=300),
        cv=5,
        passthrough=False,
        n_jobs=-1,
    )

    # Wrap in a pipeline with scaling (helps LR base learner)
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('model',  stacking),
    ])

    return pipeline


def evaluate(model, X_test, y_test, label='Test'):
    """Print evaluation metrics."""
    y_pred  = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    acc  = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec  = recall_score(y_test, y_pred, zero_division=0)
    f1   = f1_score(y_test, y_pred, zero_division=0)
    auc  = roc_auc_score(y_test, y_proba)
    ll   = log_loss(y_test, y_proba)
    bs   = brier_score_loss(y_test, y_proba)

    log.info(f"── {label} Metrics ──────────────────────────")
    log.info(f"  Accuracy  : {acc:.4f}")
    log.info(f"  Precision : {prec:.4f}")
    log.info(f"  Recall    : {rec:.4f}")
    log.info(f"  F1 Score  : {f1:.4f}")
    log.info(f"  ROC-AUC   : {auc:.4f}")
    log.info(f"  Log Loss  : {ll:.4f}")
    log.info(f"  Brier     : {bs:.4f}")

    return {
        'accuracy': round(acc, 4),
        'precision': round(prec, 4),
        'recall': round(rec, 4),
        'f1': round(f1, 4),
        'roc_auc': round(auc, 4),
        'log_loss': round(ll, 4),
        'brier_score': round(bs, 4),
    }


def get_feature_importances(model, feature_names):
    """Extract feature importances from the GradientBoosting base learner."""
    try:
        scaler = model.named_steps['scaler']
        stacking = model.named_steps['model']
        gb = stacking.named_estimators_['gb']
        importances = gb.feature_importances_
        pairs = sorted(zip(feature_names, importances), key=lambda x: -x[1])
        return pairs
    except Exception:
        return []


def train(n_samples: int = 25000):
    """Full training pipeline."""
    log.info(f"Generating {n_samples} synthetic training samples...")
    X_raw, y, _ = generate_dataset(n_samples=n_samples, seed=42)

    X = np.array(X_raw, dtype=np.float32)
    y = np.array(y, dtype=np.int32)

    log.info(f"Dataset: {len(X)} samples, {X.shape[1]} features")
    log.info(f"Class balance: {y.mean():.2%} confirmed")

    # Train/val/test split (70/15/15)
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.30, stratify=y, random_state=42
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, stratify=y_temp, random_state=42
    )

    log.info(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")

    # Build and train model
    log.info("Building stacking ensemble...")
    model = build_model()

    log.info("Training... (this may take 1–3 minutes)")
    model.fit(X_train, y_train)
    log.info("Training complete.")

    # Evaluate
    val_metrics  = evaluate(model, X_val,  y_val,  label='Validation')
    test_metrics = evaluate(model, X_test, y_test, label='Test')

    # Cross-validation on full training set
    log.info("Running 5-fold cross-validation on training set...")
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(model, X_train, y_train, cv=cv, scoring='roc_auc', n_jobs=-1)
    log.info(f"  CV ROC-AUC: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    # Feature importances
    importances = get_feature_importances(model, FEATURE_NAMES)
    if importances:
        log.info("Top 10 feature importances:")
        for name, imp in importances[:10]:
            log.info(f"  {name:<30} {imp:.4f}")

    # Save model
    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(model, f)
    log.info(f"Model saved to {MODEL_PATH}")

    # Save metadata
    meta = {
        'trained_at': datetime.now().isoformat(),
        'n_samples': n_samples,
        'feature_names': FEATURE_NAMES,
        'val_metrics': val_metrics,
        'test_metrics': test_metrics,
        'cv_roc_auc_mean': round(float(cv_scores.mean()), 4),
        'cv_roc_auc_std':  round(float(cv_scores.std()), 4),
        'feature_importances': importances[:20] if importances else [],
    }
    with open(META_PATH, 'wb') as f:
        pickle.dump(meta, f)
    log.info(f"Metadata saved to {META_PATH}")

    return model, meta


if __name__ == '__main__':
    model, meta = train(n_samples=25000)
    print("\n✅ Training complete.")
    print(f"   Test Accuracy : {meta['test_metrics']['accuracy']:.4f}")
    print(f"   Test ROC-AUC  : {meta['test_metrics']['roc_auc']:.4f}")
    print(f"   CV ROC-AUC    : {meta['cv_roc_auc_mean']:.4f} ± {meta['cv_roc_auc_std']:.4f}")
