"""
Controller for the Journey Planner feature.
Handles request parsing, delegates to journey_service, and returns JSON responses.
"""
from flask import jsonify, request
from services.journey_service import (
    get_all_journey_trains,
    get_journey_train_by_number,
    search_journey_trains,
)


def list_trains():
    """GET /api/journey/trains — Return all trains."""
    try:
        limit = request.args.get('limit', 50, type=int)
        trains = get_all_journey_trains(limit=limit)
        return jsonify({'success': True, 'count': len(trains), 'data': trains}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def get_train(train_number):
    """GET /api/journey/trains/<train_number> — Return a single train with stops."""
    try:
        train = get_journey_train_by_number(str(train_number))
        if not train:
            return jsonify({'success': False, 'error': 'Train not found'}), 404
        return jsonify({'success': True, 'data': train}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def search():
    """POST /api/journey/search — Search trains by source and destination."""
    try:
        body = request.get_json(silent=True) or {}
        source = body.get('source', '').strip()
        destination = body.get('destination', '').strip()
        date = body.get('date', '')

        if not source or not destination:
            return jsonify({
                'success': False,
                'error': 'Both source and destination are required'
            }), 400

        results = search_journey_trains(source, destination, date)
        return jsonify({'success': True, 'count': len(results), 'data': results}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
