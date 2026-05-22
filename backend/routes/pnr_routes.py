"""
PNR Routes — live IRCTC PNR status via RapidAPI.

GET /api/pnr/live/<pnr_number>
"""
from flask import Blueprint
from controllers.pnr_controller import get_live_pnr_status

pnr_bp = Blueprint('pnr', __name__)


@pnr_bp.route('/live/<pnr_number>', methods=['GET'])
def live_pnr(pnr_number):
    """
    Fetch real-time PNR status from IRCTC via RapidAPI.

    Example:
        GET /api/pnr/live/1234567890
    """
    return get_live_pnr_status(pnr_number)
