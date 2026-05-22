import pandas as pd
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, BatchNormalization, Dropout
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, classification_report
import os
import sys
import pickle
import logging

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from preprocessing.features import FeatureEngineer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def train_tf_model():
    data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'historical_bookings.csv')
    if not os.path.exists(data_path):
        logger.error("Dataset not found!")
        return

    df = pd.read_csv(data_path)
    
    fe_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'fe_pipeline.pkl')
    if os.path.exists(fe_path):
        logger.info("Loading existing FeatureEngineer pipeline...")
        with open(fe_path, 'rb') as f:
            fe = pickle.load(f)
        df_processed = fe.transform(df)
        feature_cols = fe.get_feature_names()
    else:
        logger.info("Fitting new FeatureEngineer pipeline...")
        fe = FeatureEngineer()
        df_processed = fe.fit_transform(df)
        feature_cols = fe.get_feature_names()
        os.makedirs(os.path.dirname(fe_path), exist_ok=True)
        with open(fe_path, 'wb') as f:
            pickle.dump(fe, f)
            
    X = df_processed[feature_cols].values
    y = df_processed['final_status'].apply(lambda x: 1 if x in ['CONFIRMED', 'RAC'] else 0).values

    # 70/15/15 Split
    X_temp, X_test, y_temp, y_test = train_test_split(X, y, test_size=0.15, random_state=42, stratify=y)
    X_train, X_val, y_train, y_val = train_test_split(X_temp, y_temp, test_size=0.1765, random_state=42, stratify=y_temp)

    logger.info(f"Input features: {X.shape[1]}")
    
    # DL Architecture
    model = Sequential([
        Dense(256, activation='relu', input_shape=(X.shape[1],)),
        BatchNormalization(),
        Dropout(0.3),
        Dense(128, activation='relu'),
        BatchNormalization(),
        Dropout(0.25),
        Dense(64, activation='relu'),
        BatchNormalization(),
        Dropout(0.2),
        Dense(32, activation='relu'),
        Dropout(0.15),
        Dense(1, activation='sigmoid')
    ])
    
    optimizer = tf.keras.optimizers.Adam(learning_rate=0.001)
    model.compile(optimizer=optimizer, loss='binary_crossentropy', metrics=['accuracy', tf.keras.metrics.AUC(name='auc')])
    
    callbacks = [
        EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True),
        ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=5, min_lr=1e-6)
    ]
    
    logger.info("Starting TensorFlow Training...")
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        batch_size=256,
        epochs=100,
        callbacks=callbacks,
        verbose=1
    )
    
    # Evaluation
    logger.info("Evaluating TF Model...")
    y_pred_prob = model.predict(X_test).ravel()
    y_pred = (y_pred_prob > 0.5).astype(int)
    
    logger.info(f"Accuracy:  {accuracy_score(y_test, y_pred):.4f}")
    logger.info(f"Precision: {precision_score(y_test, y_pred):.4f}")
    logger.info(f"Recall:    {recall_score(y_test, y_pred):.4f}")
    logger.info(f"F1 Score:  {f1_score(y_test, y_pred):.4f}")
    logger.info(f"ROC-AUC:   {roc_auc_score(y_test, y_pred_prob):.4f}")
    
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
    # Save
    models_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
    os.makedirs(models_dir, exist_ok=True)
    model.save(os.path.join(models_dir, 'tf_model.keras'))
    logger.info("✅ TensorFlow Model saved to tf_model.keras")

if __name__ == "__main__":
    train_tf_model()
