from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from datetime import timedelta
import os

load_dotenv()

app = Flask(__name__)
CORS(app)

jwt_secret = os.getenv('JWT_SECRET')
if not jwt_secret:
    raise ValueError("JWT_SECRET environment variable must be set")
app.config['JWT_SECRET_KEY'] = jwt_secret
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)

jwt = JWTManager(app)

from routes.auth import auth_bp
from routes.trains import trains_bp
from routes.bookings import bookings_bp
from routes.ai import ai_bp
from routes.realtime import realtime_bp

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(trains_bp, url_prefix='/api')
app.register_blueprint(bookings_bp, url_prefix='/api')
app.register_blueprint(ai_bp, url_prefix='/api/ai')
app.register_blueprint(realtime_bp, url_prefix='/api/realtime')


@app.route('/api/health')
def health():
    return jsonify({"status": "ok", "message": "RailAI API is running"})


# Pre-warm all data indexes on startup (runs in background thread)
import threading
def _warm_cache():
    try:
        from services.data_service import _get_schedule_index, _get_trains_by_number, _get_station_trains_index, _get_station_name_to_code
        print("Warming schedule index...")
        _get_schedule_index()
        _get_trains_by_number()
        _get_station_trains_index()
        _get_station_name_to_code()
        print("Cache warm — ready.")
    except Exception as e:
        print(f"Cache warm failed: {e}")

threading.Thread(target=_warm_cache, daemon=True).start()


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
