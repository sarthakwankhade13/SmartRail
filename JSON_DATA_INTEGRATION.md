# JSON Data Integration Guide

## Overview
The backend has been updated to fetch station, train, and schedule data from JSON files instead of the MySQL database. This provides better performance and easier data management.

## Files Modified

### 1. New Data Service (`backend/services/dataService.js`)
- Loads and caches data from JSON files
- Provides helper functions to query stations and trains
- Functions:
  - `getStations()` - Returns all stations from station.json
  - `getTrains()` - Returns all trains from trains.json
  - `getSchedules()` - Returns schedules from schedules.json
  - `findStationByCode(code)` - Find station by station code
  - `findTrainByNumber(trainNumber)` - Find train by train number
  - `searchTrains(sourceCode, destCode)` - Search trains between stations

### 2. Updated Routes

#### `backend/routes/trains.js`
- **GET /api/stations** - Fetches stations from station.json
- **GET /api/trains** - Fetches all trains from trains.json
- **GET /api/trains/search** - Searches trains between source and destination
- **GET /api/train/:trainNumber/schedule** - Gets train schedule

#### `backend/routes/bookings.js`
- **POST /api/book-ticket** - Validates stations and trains from JSON before booking
- Still uses database for storing booking records

#### `backend/routes/ai.js`
- **POST /api/ai/waitlist-predict** - Uses JSON data to verify train exists
- **POST /api/ai/seat-swap** - Uses JSON data to verify train exists
- **POST /api/ai/journey-plan** - Uses JSON data to search and recommend routes

## JSON File Structure

### station.json
```json
{
  "stations": [
    {
      "stnCode": "AHA",
      "stnName": "Abhaipur",
      "stnCity": "Abhaipur"
    }
  ]
}
```

### trains.json
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "geometry": {
        "type": "LineString",
        "coordinates": [[lon, lat], ...]
      },
      "properties": {
        "number": "04601",
        "name": "Train Name",
        "from_station_code": "JAT",
        "from_station_name": "JAMMU TAWI",
        "to_station_code": "UHP",
        "to_station_name": "UDHAMPUR",
        "departure": "10:40:00",
        "arrival": "12:15:00",
        "duration_h": 1,
        "duration_m": 35,
        "distance": 53,
        "type": "DEMU",
        "zone": "NR"
      }
    }
  ]
}
```

### schedules.json
Note: This file is very large (>50MB). The current implementation generates basic schedules from train coordinates. For detailed schedules, you may need to implement streaming or chunked reading.

## Benefits

1. **Performance**: Data is cached in memory, reducing database queries
2. **Flexibility**: Easy to update data by modifying JSON files
3. **Scalability**: Can handle large datasets efficiently
4. **Offline Capability**: Works without database connection for read operations

## Database Usage

The following operations still use the database:
- User authentication and registration
- Booking creation and management
- Passenger information storage
- PNR status tracking

## Testing

To test the integration:

1. Start the backend server:
```bash
cd backend
npm start
```

2. Test endpoints:
```bash
# Get all stations
curl http://localhost:5000/api/stations

# Get all trains
curl http://localhost:5000/api/trains

# Search trains
curl "http://localhost:5000/api/trains/search?source=JAT&destination=UHP"

# Get train schedule
curl http://localhost:5000/api/train/04601/schedule
```

## Future Enhancements

1. Implement streaming for large schedules.json file
2. Add data validation and error handling
3. Create data update mechanism
4. Add search indexing for faster queries
5. Implement caching strategies for frequently accessed data
