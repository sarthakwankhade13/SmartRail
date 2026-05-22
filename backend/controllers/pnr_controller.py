"""
PNR Controller — validates input, calls service, returns JSON.
"""
import re
import logging
from flask import jsonify
from services.pnr_service import fetch_live_pnr

log = logging.getLogger(__name__)

PNR_REGEX = re.compile(r'^\d{10}$')


def get_live_pnr_status(pnr_number: str):
    """
    Controller for GET /api/pnr/live/<pnr_number>
    """
    if not pnr_number:
        return jsonify({'success': False, 'error': 'PNR number is required'}), 400

    pnr_clean = pnr_number.strip()
    if not PNR_REGEX.match(pnr_clean):
        return jsonify({
            'success': False,
            'error': 'Invalid PNR format. PNR must be exactly 10 digits.',
        }), 400

    result = fetch_live_pnr(pnr_clean)

    if not result['success']:
        return jsonify({
            'success':   False,
            'error':     result['error'],
            'pnrNumber': pnr_clean,
        }), 503

    # Data is already normalized — return directly
    return jsonify({
        'success':   True,
        'pnrNumber': pnr_clean,
        **result['data'],
    }), 200
