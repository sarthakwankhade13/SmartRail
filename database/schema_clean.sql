CREATE DATABASE IF NOT EXISTS railai;
USE railai;

CREATE TABLE Users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(15),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email)
);

CREATE TABLE Stations (
  station_id INT PRIMARY KEY AUTO_INCREMENT,
  station_code VARCHAR(10) UNIQUE NOT NULL,
  station_name VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  state VARCHAR(100),
  INDEX idx_code (station_code),
  INDEX idx_name (station_name)
);

CREATE TABLE Trains (
  train_id INT PRIMARY KEY AUTO_INCREMENT,
  train_number VARCHAR(10) UNIQUE NOT NULL,
  train_name VARCHAR(255) NOT NULL,
  train_type VARCHAR(50),
  INDEX idx_number (train_number)
);

CREATE TABLE Train_Schedules (
  schedule_id INT PRIMARY KEY AUTO_INCREMENT,
  train_id INT NOT NULL,
  station_id INT NOT NULL,
  arrival_time TIME,
  departure_time TIME,
  stop_number INT NOT NULL,
  distance_km INT,
  day_offset INT DEFAULT 0,
  FOREIGN KEY (train_id) REFERENCES Trains(train_id),
  FOREIGN KEY (station_id) REFERENCES Stations(station_id),
  INDEX idx_train (train_id),
  INDEX idx_station (station_id)
);

CREATE TABLE Seat_Availability (
  availability_id INT PRIMARY KEY AUTO_INCREMENT,
  train_id INT NOT NULL,
  travel_date DATE NOT NULL,
  class_type VARCHAR(10) NOT NULL,
  available_seats INT NOT NULL,
  total_seats INT NOT NULL,
  base_fare DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (train_id) REFERENCES Trains(train_id),
  INDEX idx_train_date (train_id, travel_date),
  UNIQUE KEY unique_train_date_class (train_id, travel_date, class_type)
);

CREATE TABLE Bookings (
  booking_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  train_id INT NOT NULL,
  pnr_number VARCHAR(10) UNIQUE NOT NULL,
  source_station_id INT NOT NULL,
  destination_station_id INT NOT NULL,
  travel_date DATE NOT NULL,
  class_type VARCHAR(10) NOT NULL,
  total_fare DECIMAL(10,2) NOT NULL,
  booking_status VARCHAR(20) DEFAULT 'CONFIRMED',
  booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(user_id),
  FOREIGN KEY (train_id) REFERENCES Trains(train_id),
  FOREIGN KEY (source_station_id) REFERENCES Stations(station_id),
  FOREIGN KEY (destination_station_id) REFERENCES Stations(station_id),
  INDEX idx_user (user_id),
  INDEX idx_pnr (pnr_number)
);

CREATE TABLE Passengers (
  passenger_id INT PRIMARY KEY AUTO_INCREMENT,
  booking_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  age INT NOT NULL,
  gender VARCHAR(10) NOT NULL,
  seat_number VARCHAR(10),
  berth_preference VARCHAR(20),
  FOREIGN KEY (booking_id) REFERENCES Bookings(booking_id) ON DELETE CASCADE,
  INDEX idx_booking (booking_id)
);

CREATE TABLE Seat_Swap_Requests (
  swap_id INT PRIMARY KEY AUTO_INCREMENT,
  requester_passenger_id INT NOT NULL,
  current_seat VARCHAR(10) NOT NULL,
  desired_seat_type VARCHAR(20) NOT NULL,
  train_id INT NOT NULL,
  travel_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requester_passenger_id) REFERENCES Passengers(passenger_id),
  FOREIGN KEY (train_id) REFERENCES Trains(train_id),
  INDEX idx_train_date (train_id, travel_date)
);

CREATE TABLE Prediction_Logs (
  log_id INT PRIMARY KEY AUTO_INCREMENT,
  train_id INT NOT NULL,
  travel_date DATE NOT NULL,
  waitlist_position INT,
  prediction_type VARCHAR(50) NOT NULL,
  prediction_result JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (train_id) REFERENCES Trains(train_id),
  INDEX idx_train_date (train_id, travel_date)
);
