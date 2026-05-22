import os
import pickle
import logging
import xgboost as xgb
import pandas as pd
import numpy as np
from datetime import datetime
from .explainability import SHAPExplainer

logger = logging.getLogger(__name__)

class MLModelManager:
    """
    Manages loading ML models, feature engineering pipelines, and executing
    inference using Ensemble techniques (XGBoost + TF).
    """
    def __init__(self):
        self.models_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
        self.model_conf = None
        self.model_prob = None
        self.model_rac = None
        self.tf_model = None
        self.fe_pipeline = None
        self.feature_cols = None
        self.explainer = None
        
        self.reload_models()
        
    def reload_models(self):
        logger.info("[MLManager] Loading models from disk...")
        try:
            # Load XGBoost models
            if os.path.exists(os.path.join(self.models_dir, 'xgboost_conf.json')):
                self.model_conf = xgb.XGBClassifier()
                self.model_conf.load_model(os.path.join(self.models_dir, 'xgboost_conf.json'))
                
            if os.path.exists(os.path.join(self.models_dir, 'xgboost_prob.json')):
                self.model_prob = xgb.XGBRegressor()
                self.model_prob.load_model(os.path.join(self.models_dir, 'xgboost_prob.json'))
                
            if os.path.exists(os.path.join(self.models_dir, 'xgboost_rac.json')):
                self.model_rac = xgb.XGBClassifier()
                self.model_rac.load_model(os.path.join(self.models_dir, 'xgboost_rac.json'))
                
            # Load TF model
            tf_path = os.path.join(self.models_dir, 'tf_model.keras')
            if os.path.exists(tf_path):
                try:
                    import tensorflow as tf
                    self.tf_model = tf.keras.models.load_model(tf_path)
                except Exception as e:
                    logger.warning(f"Could not load TF model: {e}")
                    
            # Load Pipeline & Features
            fe_path = os.path.join(self.models_dir, 'fe_pipeline.pkl')
            cols_path = os.path.join(self.models_dir, 'feature_cols.pkl')
            
            if os.path.exists(fe_path) and os.path.exists(cols_path):
                with open(fe_path, 'rb') as f:
                    self.fe_pipeline = pickle.load(f)
                with open(cols_path, 'rb') as f:
                    self.feature_cols = pickle.load(f)
                    
                if self.model_conf:
                    self.explainer = SHAPExplainer(self.model_conf, self.feature_cols)
                    
            logger.info("[MLManager] Models loaded successfully.")
        except Exception as e:
            logger.error(f"[MLManager] Failed to load models: {e}")
            
    def predict(self, input_dict: dict) -> dict:
        if not self.model_conf or not self.fe_pipeline:
            return {"error": "Models not loaded. Train the models first."}
            
        # 1. Base Data prep
        df_input = pd.DataFrame([input_dict])
        
        # Operational Defaults (if missing)
        defaults = {
            'total_seats': 500 if input_dict.get('class_type') == 'SL' else 200,
            'dynamic_seat_availability': 0,
            'historical_occupancy': 0.85,
            'cancellation_ratio': 0.18,
            'train_delay_history': 15,
            'route_popularity_score': 65,
            'peak_demand_score': 70,
            'historical_confirmation_rate': 0.55,
            'tatkal_booking_pressure': 45,
            'rac_count': 0,
            'booking_trend_30d': 150,
            'cancellation_trend_90d': 0.18,
            'seat_movement_pattern': 'Moderate',
            'route_demand_trend': 'Stable',
            'weather': 'Clear',
            'festival_name': 'None'
        }
        for k, v in defaults.items():
            if k not in df_input:
                df_input[k] = v
                
        if 'booking_date' not in df_input:
            df_input['booking_date'] = datetime.now().strftime('%Y-%m-%d')
            
        j_date = pd.to_datetime(df_input['journey_date'][0])
        b_date = pd.to_datetime(df_input['booking_date'][0])
        df_input['days_before_journey'] = max(1, (j_date - b_date).days)
        
        # 2. Preprocess
        df_processed = self.fe_pipeline.transform(df_input)
        X = df_processed[self.feature_cols]
        
        # 3. Model Inference
        # XGB Binary
        prob_conf_binary = self.model_conf.predict_proba(X)[0][1] * 100
        # XGB Regressor
        if self.model_prob:
            prob_conf_reg = self.model_prob.predict(X)[0]
        else:
            prob_conf_reg = prob_conf_binary
            
        # Ensemble Average
        final_prob = (prob_conf_binary + prob_conf_reg) / 2
        
        # Add TF Ensemble if available
        if self.tf_model:
            tf_prob = self.tf_model.predict(X.values, verbose=0)[0][0] * 100
            final_prob = (final_prob * 0.6) + (tf_prob * 0.4) # Weighted ensemble
            
        # RAC Probability
        if self.model_rac:
            prob_rac = self.model_rac.predict_proba(X)[0][1] * 100
        else:
            prob_rac = 10.0
            
        # Calibrations
        final_prob = max(1.0, min(99.0, final_prob))
        prob_rac = max(1.0, min(99.0, prob_rac))
        
        # 4. Risk & Confidence
        if final_prob >= 75:
            risk = "Low"
        elif final_prob >= 40:
            risk = "Medium"
        else:
            risk = "High"
            
        confidence = min(99, int(75 + abs(final_prob - 50) * 0.4))
        
        # 5. Expected WL Movement
        current_wl = input_dict.get('current_waitlist_number', 50)
        days_left = df_input['days_before_journey'][0]
        cancel_ratio = df_input['cancellation_ratio'][0]
        exp_movement = int(current_wl * cancel_ratio * (days_left / 15.0))
        exp_movement = min(exp_movement, current_wl)
        
        # 6. SHAP Explanations
        insights = []
        shap_vals = {}
        if self.explainer:
            insights, shap_vals = self.explainer.explain_prediction(X)
            
        return {
            "train_no": input_dict.get('train_number', 'Unknown'),
            "class": input_dict.get('class_type', 'Unknown'),
            "quota": input_dict.get('booking_quota', 'Unknown'),
            "current_wl": current_wl,
            "confirmation_probability": round(final_prob, 1),
            "rac_probability": round(prob_rac, 1),
            "risk_level": risk,
            "expected_confirmation_time": f"{max(1, int(days_left * 0.6))} days",
            "confidence_score": confidence,
            "expected_wl_movement": exp_movement,
            "insights": insights,
            "shap_values": {k: float(v) for k, v in shap_vals.items()}
        }

ml_manager = MLModelManager()
