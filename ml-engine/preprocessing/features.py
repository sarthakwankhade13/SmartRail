import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class FeatureEngineer:
    """
    Comprehensive Feature Engineering Pipeline for Train Waitlist Predictions.
    Implements: Date Features, Demand Features, Statistical Features, 
    Historical Probability Features, Time-Series Features, and Interaction Features.
    """
    def __init__(self):
        self.label_encoders = {}
        self.scaler = StandardScaler()
        self.num_cols = []
        self.cat_cols = ['class_type', 'booking_quota', 'age_group', 'season', 
                         'time_slot', 'weather', 'route_demand_trend', 'seat_movement_pattern']
        self.feature_names = []
        
    def _create_features(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        
        # 1. Date Features
        df['journey_date'] = pd.to_datetime(df['journey_date'])
        df['booking_date'] = pd.to_datetime(df['booking_date'])
        
        df['day_of_week'] = df['journey_date'].dt.dayofweek
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        df['month'] = df['journey_date'].dt.month
        df['quarter'] = df['journey_date'].dt.quarter
        df['day_of_month'] = df['journey_date'].dt.day
        df['week_of_year'] = df['journey_date'].dt.isocalendar().week.astype(int)
        
        # Holiday & Festival logic
        df['is_holiday_season'] = df['month'].isin([5, 6, 10, 11, 12]).astype(int)
        df['is_festival_week'] = df['is_festival']  # Already 0/1 from generator
        df['is_peak_season'] = df['month'].isin([5, 6, 10, 11, 12]).astype(int)
        
        # 2. Demand Features
        df['route_demand_index'] = (df['route_popularity_score'] * df['peak_demand_score']) / 100.0
        df['booking_pressure'] = df['current_waitlist_number'] / df['total_seats'].replace(0, 1)
        df['seat_utilization_rate'] = 1 - (df['dynamic_seat_availability'] / df['total_seats'].replace(0, 1))
        df['cancellation_frequency'] = df['cancellation_ratio'] * df['booking_trend_30d']
        
        quota_map = {'GNWL': 0.3, 'PQWL': 0.5, 'RLWL': 0.6, 'TQWL': 0.8}
        df['quota_pressure'] = df['booking_quota'].map(quota_map).fillna(0.5)
        
        # 3. Statistical Features
        df['rolling_avg_occupancy'] = df['historical_occupancy'] # Simplification for row-wise
        df['rolling_cancellation_rate'] = df['cancellation_trend_90d']
        
        trend_map = {'Rising': 1, 'Stable': 0, 'Declining': -1}
        df['trend_slope'] = df['route_demand_trend'].map(trend_map).fillna(0)
        df['demand_volatility'] = np.abs(df['peak_demand_score'] - df['route_popularity_score']) / 100.0
        
        # 4. Historical Probability Features
        df['hist_confirmation_pct'] = df['historical_confirmation_rate'] * 100
        df['hist_rac_conversion_pct'] = (df['rac_count'] / df['total_seats'].replace(0, 1)) * 100
        df['similar_train_score'] = (df['route_popularity_score'] + df['historical_confirmation_rate'] * 100) / 2
        
        # 5. Time-Series Features
        df['daily_booking_velocity'] = df['booking_trend_30d'] / 30.0
        seat_speed_map = {'Fast': 3, 'Moderate': 2, 'Slow': 1}
        df['seat_movement_speed'] = df['seat_movement_pattern'].map(seat_speed_map).fillna(2)
        df['trend_momentum'] = df['trend_slope'] * df['daily_booking_velocity']
        
        # 6. Interaction Features
        df['wl_to_seats_ratio'] = df['current_waitlist_number'] / df['total_seats'].replace(0, 1)
        df['days_x_cancellation'] = df['days_before_journey'] * df['cancellation_ratio']
        df['demand_x_season'] = df['route_demand_index'] * df['is_peak_season']
        
        return df

    def fit_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Fitting FeatureEngineer pipeline...")
        df_feats = self._create_features(df)
        
        # Encode Categoricals
        for col in self.cat_cols:
            if col in df_feats:
                le = LabelEncoder()
                df_feats[col] = le.fit_transform(df_feats[col].astype(str))
                self.label_encoders[col] = le
                
        # Identify Numerical Columns (exclude ID/Target columns)
        exclude = ['train_number', 'train_name', 'source_station', 'destination_station', 
                   'boarding_station', 'journey_date', 'booking_date', 'journey_day', 
                   'festival_name', 'final_status', 'confirmation_probability', 
                   'rac_probability', 'expected_wl_movement', 'target', 'is_rac']
                   
        self.num_cols = [c for c in df_feats.columns if c not in exclude and c not in self.cat_cols]
        self.feature_names = self.cat_cols + self.num_cols
        
        # Scale Numericals
        df_feats[self.num_cols] = self.scaler.fit_transform(df_feats[self.num_cols])
        
        logger.info(f"Generated {len(self.feature_names)} features.")
        return df_feats

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        df_feats = self._create_features(df)
        
        # Apply fitted encoders
        for col in self.cat_cols:
            if col in df_feats and col in self.label_encoders:
                le = self.label_encoders[col]
                # Handle unseen labels by mapping to a default/mode class, simplified here to 0
                df_feats[col] = df_feats[col].apply(lambda x: x if x in le.classes_ else le.classes_[0])
                df_feats[col] = le.transform(df_feats[col].astype(str))
                
        # Apply fitted scaler
        df_feats[self.num_cols] = self.scaler.transform(df_feats[self.num_cols])
        
        return df_feats
        
    def get_feature_names(self):
        return self.feature_names
