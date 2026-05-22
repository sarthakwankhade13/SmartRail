from flask import request, jsonify
from services.exchange_service import (
    get_or_create_passenger,
    create_exchange_request,
    find_matches_for_request,
    accept_match,
    get_passenger_requests,
    seed_dummy_requests_for_train
)

def request_exchange():
    """POST /api/exchange/request"""
    try:
        data = request.json
        pnr = data.get('pnr_number')
        train = data.get('train_number')
        coach = data.get('coach_number')
        seat = data.get('seat_number')
        name = data.get('name', 'Passenger')
        age = data.get('age', 30)
        gender = data.get('gender', 'M')
        
        cur_type = data.get('current_seat_type')
        req_type = data.get('requested_seat_type')
        
        if not all([pnr, train, coach, seat, cur_type, req_type]):
            return jsonify({'success': False, 'error': 'Missing required fields'}), 400
            
        # Seed dummies for demo
        seed_dummy_requests_for_train(train, coach)
        
        passenger = get_or_create_passenger(pnr, name, age, gender, train, coach, seat)
        req = create_exchange_request(passenger.id, cur_type, req_type)
        
        return jsonify({
            'success': True,
            'message': 'Exchange request created',
            'request_id': req.id
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

def get_matches(request_id):
    """GET /api/exchange/matches/<request_id>"""
    try:
        matches = find_matches_for_request(request_id)
        return jsonify({
            'success': True,
            'matches': matches
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

def accept_exchange():
    """POST /api/exchange/accept"""
    try:
        data = request.json
        req1_id = data.get('my_request_id')
        req2_id = data.get('target_request_id')
        
        if not req1_id or not req2_id:
            return jsonify({'success': False, 'error': 'Missing request IDs'}), 400
            
        accept_match(req1_id, req2_id)
        
        return jsonify({
            'success': True,
            'message': 'Exchange approved successfully'
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

def get_history(pnr_number):
    """GET /api/exchange/history/<pnr_number>"""
    try:
        reqs = get_passenger_requests(pnr_number)
        return jsonify({
            'success': True,
            'requests': reqs
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
