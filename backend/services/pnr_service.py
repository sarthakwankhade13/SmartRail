"""
PNR Service — fetches live PNR status.

Strategy (in order):
  1. RapidAPI IRCTC (if key is subscribed)
  2. Official Indian Railways enquiry page (scrape fallback)
  3. Return error with clear message

Reads credentials from .env via python-dotenv.
"""
import os
import re
import logging
import requests
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

RAPID_API_KEY  = os.getenv('RAPID_API_KEY', '')
RAPID_API_HOST = os.getenv('RAPID_API_HOST', 'irctc1.p.rapidapi.com')
RAPID_API_URL  = f"https://{RAPID_API_HOST}/api/v1/getPNRStatus"

REQUEST_TIMEOUT = 12


# ── 1. RapidAPI attempt ────────────────────────────────────────────────────────

def _try_rapidapi(pnr_number: str) -> dict | None:
    """
    Try RapidAPI. Returns normalized dict on success, None on any failure.
    """
    if not RAPID_API_KEY or len(RAPID_API_KEY) < 20:
        return None

    try:
        r = requests.get(
            RAPID_API_URL,
            headers={
                'x-rapidapi-key':  RAPID_API_KEY,
                'x-rapidapi-host': RAPID_API_HOST,
            },
            params={'pnrNumber': pnr_number},
            timeout=REQUEST_TIMEOUT,
        )

        if r.status_code == 403:
            log.warning("RapidAPI key not subscribed to IRCTC API")
            return None
        if r.status_code == 429:
            log.warning("RapidAPI rate limit hit")
            return None
        if r.status_code != 200:
            log.warning("RapidAPI returned %s", r.status_code)
            return None

        data = r.json()
        # RapidAPI IRCTC1 wraps response in 'body'
        body = data.get('body', data)
        return normalize_rapidapi(body)

    except Exception as e:
        log.warning("RapidAPI call failed: %s", e)
        return None


def normalize_rapidapi(body: dict) -> dict:
    """Normalize RapidAPI IRCTC1 response shape."""
    passengers = []
    for p in body.get('passengerList', body.get('PassengerStatus', [])):
        status = p.get('currentStatusCode', p.get('CurrentStatus', ''))
        coach  = p.get('currentCoachId',   p.get('CurrentCoach', ''))
        berth  = str(p.get('currentBerthNo', p.get('CurrentBerth', '')))
        passengers.append({
            'number':        p.get('passengerSerialNumber', p.get('Number', '')),
            'bookingStatus': p.get('bookingStatusCode', p.get('BookingStatus', '')),
            'currentStatus': status,
            'currentCoach':  coach,
            'currentBerth':  berth,
            'seatNumber':    f"{coach}/{berth}" if coach and berth else status,
            'isConfirmed':   status.upper() in ('CNF', 'CONFIRMED'),
        })

    overall = _overall_status(passengers)

    return {
        'pnrNumber':          body.get('pnrNumber',    body.get('Pnr', '')),
        'trainNumber':        body.get('trainNumber',  body.get('TrainNo', '')),
        'trainName':          body.get('trainName',    body.get('TrainName', '')),
        'travelDate':         body.get('dateOfJourney',body.get('Doj', '')),
        'sourceStation':      body.get('boardingPoint',body.get('From', '')),
        'destinationStation': body.get('reservationUpto', body.get('To', '')),
        'boardingPoint':      body.get('boardingPoint',body.get('BoardingPoint', '')),
        'classType':          body.get('journeyClass', body.get('Class', '')),
        'chartPrepared':      body.get('chartPrepared',body.get('ChartPrepared', False)),
        'bookingStatus':      overall,
        'passengerCount':     len(passengers),
        'passengers':         passengers,
        'source':             'live',
    }


# ── 2. Official Indian Railways scrape fallback ────────────────────────────────

def _try_indianrail_scrape(pnr_number: str) -> dict | None:
    """
    Scrape the official Indian Railways PNR enquiry page.
    Returns normalized dict on success, None on failure.
    """
    try:
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
        })

        # Step 1: GET the page to get any session cookies
        base_url = 'https://www.indianrail.gov.in/enquiry/PNR/PnrEnquiry.jsp'
        session.get(base_url, timeout=REQUEST_TIMEOUT)

        # Step 2: POST with PNR
        post_url = 'https://www.indianrail.gov.in/enquiry/PNR/PnrEnquiry.jsp'
        payload = {
            'inputPNRNo': pnr_number,
            'currentBoardingInputInIndianRail': '',
            'action': '',
        }
        r = session.post(post_url, data=payload, timeout=REQUEST_TIMEOUT)

        if r.status_code != 200:
            return None

        html = r.text
        return _parse_indianrail_html(html, pnr_number)

    except Exception as e:
        log.warning("Indian Railways scrape failed: %s", e)
        return None


def _parse_indianrail_html(html: str, pnr_number: str) -> dict | None:
    """Parse the Indian Railways PNR response HTML."""
    # Check for invalid PNR message
    if 'Invalid PNR' in html or 'PNR Number does not exist' in html:
        return {'_invalid': True}

    # Extract train number
    train_no_match = re.search(r'Train No\s*[:\-]?\s*(\d{4,5})', html, re.IGNORECASE)
    train_name_match = re.search(r'Train Name\s*[:\-]?\s*([A-Z\s]+?)(?:<|\n|&)', html, re.IGNORECASE)
    date_match = re.search(r'Date of Journey\s*[:\-]?\s*([\d\-/]+)', html, re.IGNORECASE)
    from_match = re.search(r'From\s*[:\-]?\s*([A-Z]{2,5})', html, re.IGNORECASE)
    to_match   = re.search(r'(?:To|Destination)\s*[:\-]?\s*([A-Z]{2,5})', html, re.IGNORECASE)
    class_match = re.search(r'Class\s*[:\-]?\s*([A-Z0-9]{2,3})', html, re.IGNORECASE)

    # Extract passenger rows — look for CNF/WL/RAC patterns
    pax_statuses = re.findall(
        r'(?:Passenger|Pax)\s*(\d+).*?(?:Booking Status|Booked)\s*[:\-]?\s*([A-Z0-9/]+).*?'
        r'(?:Current Status|Current)\s*[:\-]?\s*([A-Z0-9/]+)',
        html, re.IGNORECASE | re.DOTALL
    )

    # Simpler fallback: find all CNF/WL/RAC occurrences
    if not pax_statuses:
        status_hits = re.findall(r'\b(CNF|WL/\d+|RAC/?\d*|PQWL/\d+|GNWL/\d+)\b', html)
        pax_statuses = [(str(i+1), s, s) for i, s in enumerate(status_hits[:6])]

    passengers = []
    for num, booking_s, current_s in pax_statuses:
        passengers.append({
            'number':        num,
            'bookingStatus': booking_s.strip(),
            'currentStatus': current_s.strip(),
            'currentCoach':  '',
            'currentBerth':  '',
            'seatNumber':    current_s.strip(),
            'isConfirmed':   'CNF' in current_s.upper(),
        })

    if not passengers and not train_no_match:
        return None  # couldn't parse anything useful

    overall = _overall_status(passengers) if passengers else 'UNKNOWN'

    return {
        'pnrNumber':          pnr_number,
        'trainNumber':        train_no_match.group(1).strip()   if train_no_match  else '',
        'trainName':          train_name_match.group(1).strip() if train_name_match else '',
        'travelDate':         date_match.group(1).strip()       if date_match       else '',
        'sourceStation':      from_match.group(1).strip()       if from_match       else '',
        'destinationStation': to_match.group(1).strip()         if to_match         else '',
        'boardingPoint':      from_match.group(1).strip()       if from_match       else '',
        'classType':          class_match.group(1).strip()      if class_match      else '',
        'chartPrepared':      'Chart Prepared' in html,
        'bookingStatus':      overall,
        'passengerCount':     len(passengers),
        'passengers':         passengers,
        'source':             'live',
    }


# ── Helpers ────────────────────────────────────────────────────────────────────

def _overall_status(passengers: list) -> str:
    if not passengers:
        return 'UNKNOWN'
    all_cnf = all(p.get('isConfirmed') for p in passengers)
    any_rac  = any('RAC'  in str(p.get('currentStatus', '')).upper() for p in passengers)
    any_wl   = any('WL'   in str(p.get('currentStatus', '')).upper() for p in passengers)
    if all_cnf:
        return 'CONFIRMED'
    if any_rac:
        return 'RAC'
    if any_wl:
        return 'WAITLISTED'
    return passengers[0].get('currentStatus', 'UNKNOWN')


# ── Public API ─────────────────────────────────────────────────────────────────

def fetch_live_pnr(pnr_number: str) -> dict:
    """
    Fetch PNR status. Tries RapidAPI first, then official Indian Railways page.
    Saves result to local PnrLookups table.
    """
    import json

    # 1. RapidAPI
    result = _try_rapidapi(pnr_number)
    if result:
        _save_lookup(pnr_number, 'rapidapi', result)
        return {'success': True, 'data': result, 'source': 'rapidapi'}

    # 2. Official Indian Railways scrape
    result = _try_indianrail_scrape(pnr_number)
    if result:
        if result.get('_invalid'):
            return {
                'success': False,
                'error':   'PNR not found in IRCTC system. Please verify the PNR number.',
                'source':  'indianrail',
            }
        _save_lookup(pnr_number, 'indianrail', result)
        return {'success': True, 'data': result, 'source': 'indianrail'}

    return {
        'success': False,
        'error':   'Could not fetch PNR status. IRCTC service may be temporarily unavailable.',
        'source':  'none',
    }


def _save_lookup(pnr_number: str, source: str, data: dict):
    """Save PNR lookup result to local database."""
    import json
    try:
        from config.database import get_connection
        conn = get_connection()
        conn.execute(
            "INSERT INTO PnrLookups (pnr_number, source, result_json) VALUES (?, ?, ?)",
            (pnr_number, source, json.dumps(data))
        )
        conn.commit()
        conn.close()
    except Exception as e:
        log.debug("Could not save PNR lookup: %s", e)


def normalize_pnr_response(raw: dict) -> dict:
    """Pass-through — data is already normalized by fetch_live_pnr."""
    return raw
