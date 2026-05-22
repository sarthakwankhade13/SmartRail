import requests, re

session = requests.Session()
session.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
session.get('https://www.indianrail.gov.in/enquiry/PNR/PnrEnquiry.jsp', timeout=12)
r = session.post('https://www.indianrail.gov.in/enquiry/PNR/PnrEnquiry.jsp',
    data={'inputPNRNo': '8248553234', 'currentBoardingInputInIndianRail': '', 'action': ''},
    timeout=12)

html = r.text
start = html.find('8248553234')
if start > 0:
    snippet = html[max(0, start-300):start+3000]
    print(snippet)
else:
    print("PNR not found in HTML")
    print(html[:2000])
