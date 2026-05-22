import shap
import pandas as pd
import numpy as np

class SHAPExplainer:
    """
    Explainable AI (XAI) using SHAP (SHapley Additive exPlanations)
    for XGBoost models.
    """
    def __init__(self, model, feature_cols):
        self.model = model
        self.feature_cols = feature_cols
        # TreeExplainer is highly optimized for XGBoost
        self.explainer = shap.TreeExplainer(self.model)
        
    def explain_prediction(self, X_instance_df: pd.DataFrame):
        """
        Takes a single-row DataFrame (preprocessed) and returns human-readable insights.
        """
        shap_values = self.explainer.shap_values(X_instance_df)
        
        # Depending on objective (binary/multi), shap_values shape can vary.
        if isinstance(shap_values, list):
            shap_values = shap_values[1]
            
        shap_vals = shap_values[0] if len(shap_values.shape) > 1 else shap_values
        
        df_imp = pd.DataFrame({
            'feature': self.feature_cols,
            'shap_value': shap_vals
        })
        
        df_imp['abs_shap'] = np.abs(df_imp['shap_value'])
        df_imp = df_imp.sort_values(by='abs_shap', ascending=False)
        
        feature_map = {
            'current_waitlist_number': 'Waitlist Position',
            'days_before_journey': 'Days Before Travel',
            'cancellation_ratio': 'Historical Cancellation Rate',
            'is_peak_season': 'Peak Season Travel',
            'route_demand_index': 'Route Demand',
            'booking_pressure': 'Booking Pressure',
            'seat_utilization_rate': 'Seat Occupancy',
            'historical_confirmation_rate': 'Historical Confirmation Rate',
            'tatkal_booking_pressure': 'Tatkal Pressure',
            'wl_to_seats_ratio': 'WL-to-Seats Ratio',
            'days_x_cancellation': 'Time × Cancellation Factor',
            'cancellation_frequency': 'Recent Cancellation Frequency',
            'class_type': 'Travel Class',
            'booking_quota': 'Booking Quota',
            'is_holiday_season': 'Holiday Season',
            'is_weekend': 'Weekend Travel'
        }
        
        explanations = []
        raw_dict = {}
        
        for idx, row in df_imp.head(5).iterrows():
            feat = row['feature']
            val = row['shap_value']
            abs_val = row['abs_shap']
            
            raw_dict[feat] = val
            
            direction = "increased" if val > 0 else "decreased"
            
            if abs_val > 1.5:
                impact = "High"
            elif abs_val > 0.5:
                impact = "Moderate"
            else:
                impact = "Low"
                
            clean_name = feature_map.get(feat, feat.replace('_', ' ').title())
            explanations.append(f"{impact} impact: {clean_name} {direction} the confirmation probability.")
            
        return explanations, raw_dict
