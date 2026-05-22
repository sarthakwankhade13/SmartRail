from flask import Blueprint
from controllers.exchange_controller import (
    request_exchange,
    get_matches,
    accept_exchange,
    get_history
)

exchange_bp = Blueprint('exchange', __name__)

exchange_bp.route('/request', methods=['POST'])(request_exchange)
exchange_bp.route('/matches/<int:request_id>', methods=['GET'])(get_matches)
exchange_bp.route('/accept', methods=['POST'])(accept_exchange)
exchange_bp.route('/history/<pnr_number>', methods=['GET'])(get_history)
