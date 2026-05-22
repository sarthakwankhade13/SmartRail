"""
Smart Seat Selection API routes.

GET  /api/seats/<train_number>/coaches          — list all coaches
GET  /api/seats/<train_number>/<coach_name>     — full seat map for one coach
POST /api/seats/recommend                       — smart seat recommendation
POST /api/seats/book                            — book selected seats
"""
from flask import Blueprint, request, jsonify
from services.seat_service import get_coaches, get_coach_seats, recommend_seats, book_seats

seats_bp = Blueprint('seats', __name__)


@seats_bp.route('/<train_number>/coaches', methods=['GET'])
def list_coaches(train_number):
    """Return all coaches for a train."""
    try:
        coaches = get_coaches(train_number)
        return jsonify({'success': True, 'coaches': coaches}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@seats_bp.route('/<train_number>/<coach_name>', methods=['GET'])
def coach_seats(train_number, coach_name):
    """Return full seat map for one coach."""
    try:
        data = get_coach_seats(train_number, coach_name.upper())
        if not data:
            return jsonify({'success': False, 'error': 'Coach not found'}), 404
        return jsonify({'success': True, **data}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@seats_bp.route('/recommend', methods=['POST'])
def recommend():
    """
    Body: { trainNumber, coachName, passengerCount, preferences[] }
    preferences: ['window','lower','upper','exit','quiet','group','side_lower']
    """
    body = request.get_json(silent=True) or {}
    train_number    = body.get('trainNumber', '')
    coach_name      = body.get('coachName', '').upper()
    passenger_count = int(body.get('passengerCount', 1))
    preferences     = body.get('preferences', [])

    if not train_number or not coach_name:
        return jsonify({'success': False, 'error': 'trainNumber and coachName are required'}), 400

    try:
        result = recommend_seats(train_number, coach_name, passenger_count, preferences)
        if 'error' in result:
            return jsonify({'success': False, **result}), 400
        return jsonify({'success': True, **result}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@seats_bp.route('/book', methods=['POST'])
def book():
    """
    Body: { trainNumber, coachName, seatIds[] }
    """
    body = request.get_json(silent=True) or {}
    train_number = body.get('trainNumber', '')
    coach_name   = body.get('coachName', '').upper()
    seat_ids     = body.get('seatIds', [])

    if not train_number or not coach_name or not seat_ids:
        return jsonify({'success': False, 'error': 'trainNumber, coachName and seatIds are required'}), 400

    try:
        result = book_seats(train_number, coach_name, seat_ids)
        if 'error' in result:
            return jsonify({'success': False, **result}), 400
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
