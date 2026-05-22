-- ============================================================================
--  Enterprise Railway Waitlist Prediction System — MySQL Schema
--  Includes: trains, booking_history, prediction_logs, historical_trends,
--            seasonal_analytics, seat_movement_logs
-- ============================================================================

CREATE DATABASE IF NOT EXISTS railway_ml;
USE railway_ml;

-- ── 1. Trains Master ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trains (
    train_number       VARCHAR(10)  PRIMARY KEY,
    train_name         VARCHAR(100) NOT NULL,
    source_station     VARCHAR(10)  NOT NULL,
    destination_station VARCHAR(10) NOT NULL,
    distance_km        INT          NOT NULL,
    total_seats_sl     INT DEFAULT 500,
    total_seats_3a     INT DEFAULT 200,
    total_seats_2a     INT DEFAULT 150,
    total_seats_1a     INT DEFAULT 50,
    total_seats_cc     INT DEFAULT 70,
    coach_count        INT DEFAULT 20,
    avg_delay_minutes  FLOAT DEFAULT 0,
    route_popularity   INT DEFAULT 50,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_source (source_station),
    INDEX idx_dest (destination_station)
);

-- ── 2. Booking History ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_history (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    train_number        VARCHAR(10) NOT NULL,
    journey_date        DATE NOT NULL,
    booking_date        DATE NOT NULL,
    class_type          VARCHAR(5)  NOT NULL,
    quota               VARCHAR(10) NOT NULL,
    waitlist_position   INT NOT NULL,
    rac_count           INT DEFAULT 0,
    passenger_count     INT DEFAULT 1,
    age_group           VARCHAR(10),
    final_status        VARCHAR(15) NOT NULL,
    confirmation_probability FLOAT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (train_number) REFERENCES trains(train_number),
    INDEX idx_bh_train (train_number),
    INDEX idx_bh_journey (journey_date),
    INDEX idx_bh_class (class_type),
    INDEX idx_bh_status (final_status)
);

-- ── 3. Prediction Logs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prediction_logs (
    id                       INT AUTO_INCREMENT PRIMARY KEY,
    train_number             VARCHAR(10) NOT NULL,
    journey_date             DATE,
    class_type               VARCHAR(5),
    quota                    VARCHAR(10),
    waitlist_position        INT,
    predicted_probability    FLOAT NOT NULL,
    predicted_rac_probability FLOAT,
    predicted_risk_level     VARCHAR(10),
    confidence_score         FLOAT,
    model_version            VARCHAR(50) DEFAULT 'v1.0',
    shap_top_feature         VARCHAR(100),
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pl_train (train_number),
    INDEX idx_pl_date (journey_date),
    INDEX idx_pl_created (created_at)
);

-- ── 4. Historical Trends ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS historical_trends (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    train_number      VARCHAR(10) NOT NULL,
    record_date       DATE NOT NULL,
    occupancy_rate    FLOAT,
    cancellation_rate FLOAT,
    booking_velocity  FLOAT,
    demand_index      FLOAT,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (train_number) REFERENCES trains(train_number),
    INDEX idx_ht_train (train_number),
    INDEX idx_ht_date (record_date)
);

-- ── 5. Seasonal Analytics ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seasonal_analytics (
    id                     INT AUTO_INCREMENT PRIMARY KEY,
    season                 VARCHAR(15) NOT NULL,
    month                  INT NOT NULL,
    is_festival            TINYINT DEFAULT 0,
    is_holiday             TINYINT DEFAULT 0,
    avg_occupancy          FLOAT,
    avg_cancellation       FLOAT,
    avg_confirmation_rate  FLOAT,
    peak_demand_score      FLOAT,
    INDEX idx_sa_season (season),
    INDEX idx_sa_month (month)
);

-- ── 6. Seat Movement Logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seat_movement_logs (
    id                     INT AUTO_INCREMENT PRIMARY KEY,
    train_number           VARCHAR(10) NOT NULL,
    journey_date           DATE NOT NULL,
    class_type             VARCHAR(5) NOT NULL,
    hours_before_departure INT NOT NULL,
    waitlist_count         INT DEFAULT 0,
    rac_count              INT DEFAULT 0,
    confirmed_count        INT DEFAULT 0,
    recorded_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (train_number) REFERENCES trains(train_number),
    INDEX idx_sm_train (train_number),
    INDEX idx_sm_date (journey_date)
);

-- ── Sample Train Data ───────────────────────────────────────────────────
INSERT INTO trains (train_number, train_name, source_station, destination_station, distance_km, route_popularity)
VALUES
    ('12951', 'Mumbai Rajdhani',   'NDLS', 'BCT',  1384, 95),
    ('12301', 'Howrah Rajdhani',   'NDLS', 'HWH',  1447, 92),
    ('12621', 'Tamil Nadu Express','NDLS', 'MAS',  2175, 88),
    ('12953', 'August Kranti',     'BCT',  'NDLS', 1384, 85),
    ('12559', 'Shiv Ganga Exp',    'NDLS', 'BSB',   764, 78)
ON DUPLICATE KEY UPDATE train_name = VALUES(train_name);
