"""
Flask Blueprint for the Journey Planner feature.
Uses the existing JSON data files (station.json, trains.json, schedules.json).

Routes:
    GET  /api/journey/trains              — List all trains
    GET  /api/journey/trains/<number>     — Get train details + stops
    POST /api/journey/search              — Search trains by source/destination
"""
from flask import Blueprint
from controllers.journey_controller import list_trains, get_train, search

journey_bp = Blueprint('journey', __name__)

journey_bp.route('/trains', methods=['GET'])(list_trains)
journey_bp.route('/trains/<train_number>', methods=['GET'])(get_train)
journey_bp.route('/search', methods=['POST'])(search)
