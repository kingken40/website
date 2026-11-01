import json
import urllib.request
from http.server import BaseHTTPRequestHandler

FORM_ENDPOINT = 'https://formsubmit.co/ajax/805b320faf399a3d82df58510491be73'
SITE_ORIGIN = 'https://website-zg7c.vercel.app'


class handler(BaseHTTPRequestHandler):
    def _send(self, status, body):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(body).encode('utf-8'))

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
            payload = json.loads(self.rfile.read(length).decode('utf-8') or '{}')
            project = str(payload.get('project') or 'General')[:200]
            email = str(payload.get('email') or '')[:200]
            data = {
                'name': str(payload.get('name') or 'Anonymous')[:200],
                'email': email,
                'message': str(payload.get('message') or '')[:5000],
                'project': project,
                '_subject': 'Website feedback: ' + project,
                '_replyto': email,
                '_template': 'table',
                '_captcha': 'false',
            }
            req = urllib.request.Request(
                FORM_ENDPOINT,
                data=json.dumps(data).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Origin': SITE_ORIGIN,
                    'Referer': SITE_ORIGIN + '/Projects.html',
                    'User-Agent': 'Mozilla/5.0',
                },
                method='POST',
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                result = json.loads(resp.read().decode('utf-8') or '{}')
            if str(result.get('success')) == 'true':
                self._send(200, {'success': True})
            else:
                self._send(502, {'success': False, 'error': result.get('message', 'Mail service rejected the message.')})
        except Exception as exc:
            self._send(500, {'success': False, 'error': str(exc)})

    def do_OPTIONS(self):
        self._send(200, {})

    def log_message(self, format, *args):
        return
