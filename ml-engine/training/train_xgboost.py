import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, log_loss, confusion_matrix, classification_report
import pickle
import os
import sys
import logging

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from preprocessing.features import FeatureEngineer

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def train_model():
    logger.info("Loading dataset...")
    data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'historical_bookings.csv')
    if not os.path.exists(data_path):
        logger.error("Dataset not found! Run data_generator.py first.")
        return

    df = pd.read_csv(data_path)
    logger.info(f"Dataset shape: {df.shape}")

    # 1. Feature Engineering
    logger.info("Applying Advanced Feature Engineering...")
    fe = FeatureEngineer()
    df_processed = fe.fit_transform(df)
    
    feature_cols = fe.get_feature_names()
    X = df_processed[feature_cols]
    
    # 2. Define Targets
    # Binary: CONFIRMED or RAC = 1, WL = 0
    y_binary = df_processed['final_status'].apply(lambda x: 1 if x in ['CONFIRMED', 'RAC'] else 0)
    # Continuous: actual probability
    y_prob = df['confirmation_probability']
    # RAC binary
    y_rac = df_processed['final_status'].apply(lambda x: 1 if x == 'RAC' else 0)

    # 3. Data Splitting (70/15/15)
    X_temp, X_test, y_temp, y_test = train_test_split(X, y_binary, test_size=0.15, random_state=42, stratify=y_binary)
    X_train, X_val, y_train, y_val = train_test_split(X_temp, y_temp, test_size=0.1765, random_state=42, stratify=y_temp) # 0.15/0.85 = ~0.1765
    
    logger.info(f"Train/Val/Test Split: {X_train.shape[0]} / {X_val.shape[0]} / {X_test.shape[0]}")
    logger.info(f"Class Distribution (Test): \n{y_test.value_counts(normalize=True)}")

    # 4. Train Confirmation Classifier
    logger.info("Training XGBoost Binary Confirmation Model...")
    model_conf = xgb.XGBClassifier(
        n_estimators=500,
        max_depth=8,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        gamma=0.1,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        eval_metric='logloss',
        early_stopping_rounds=30
    )
    
    model_conf.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=50)

    # 5. Evaluate
    logger.info("Evaluating Model...")
    y_pred = model_conf.predict(X_test)
    y_pred_prob = model_conf.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    logger.info(f"Accuracy:  {acc:.4f}")
    logger.info(f"Precision: {precision_score(y_test, y_pred):.4f}")
    logger.info(f"Recall:    {recall_score(y_test, y_pred):.4f}")
    logger.info(f"F1 Score:  {f1_score(y_test, y_pred):.4f}")
    logger.info(f"ROC-AUC:   {roc_auc_score(y_test, y_pred_prob):.4f}")
    logger.info(f"Log Loss:  {log_loss(y_test, y_pred_prob):.4f}")
    
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    # 6. Feature Importance
    print("\nTop 20 Important Features:")
    importance = model_conf.feature_importances_
    feat_imp = pd.DataFrame({'Feature': feature_cols, 'Importance': importance})
    print(feat_imp.sort_values(by='Importance', ascending=False).head(20).to_string(index=False))

    # 7. K-Fold Cross Validation (Demonstration)
    logger.info("Running 5-Fold Stratified CV...")
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = []
    # Using smaller estimators for quick CV
    cv_model = xgb.XGBClassifier(n_estimators=100, max_depth=6, random_state=42)
    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y_binary)):
        cv_model.fit(X.iloc[train_idx], y_binary.iloc[train_idx])
        score = accuracy_score(y_binary.iloc[val_idx], cv_model.predict(X.iloc[val_idx]))
        cv_scores.append(score)
    logger.info(f"CV Accuracy: {np.mean(cv_scores):.4f} +/- {np.std(cv_scores):.4f}")

    # 8. Train Continuous Regressor & RAC Models
    logger.info("Training Continuous Probability Regressor...")
    model_prob = xgb.XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42)
    model_prob.fit(X_train, y_prob.iloc[X_train.index])

    logger.info("Training RAC Classifier...")
    model_rac = xgb.XGBClassifier(n_estimators=150, max_depth=5, learning_rate=0.1, random_state=42)
    model_rac.fit(X_train, y_rac.iloc[X_train.index])

    # 9. Save Models
    models_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
    os.makedirs(models_dir, exist_ok=True)
    
    model_conf.save_model(os.path.join(models_dir, 'xgboost_conf.json'))
    model_prob.save_model(os.path.join(models_dir, 'xgboost_prob.json'))
    model_rac.save_model(os.path.join(models_dir, 'xgboost_rac.json'))
    
    with open(os.path.join(models_dir, 'fe_pipeline.pkl'), 'wb') as f:
        pickle.dump(fe, f)
    with open(os.path.join(models_dir, 'feature_cols.pkl'), 'wb') as f:
        pickle.dump(feature_cols, f)
        
    logger.info("✅ All Models and Pipelines saved successfully in ml-engine/models/")

if __name__ == "__main__":
    train_model()
