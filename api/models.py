import json
import os
import requests
from http.server import BaseHTTPRequestHandler

MODELS_API_URL = 'https://api.perplexity.ai/router/v1/models'


def _send_json(handler, status, payload):
    body = json.dumps(payload).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json')
    handler.send_header('Content-Length', str(len(body)))
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.end_headers()
    handler.wfile.write(body)


def _error_payload(response):
    try:
        payload = response.json()
        if isinstance(payload, dict) and isinstance(payload.get('error'), dict):
            return {'error': payload['error']}
        return payload
    except ValueError:
        return {'error': {'message': response.text or response.reason or 'Unknown provider error'}}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        api_key = os.getenv('PERPLEXITY_API_KEY')
        if not api_key:
            _send_json(self, 503, {'error': 'Perplexity Router is not configured. Set PERPLEXITY_API_KEY in the server environment.'})
            return
        try:
            response = requests.get(
                MODELS_API_URL,
                headers={'Authorization': f'Bearer {api_key}', 'Accept': 'application/json'},
                timeout=15,
            )
            payload = response.json() if response.ok else _error_payload(response)
            _send_json(self, response.status_code, payload)
        except requests.Timeout:
            _send_json(self, 504, {'error': 'Perplexity Router model request timed out.'})
        except requests.RequestException as error:
            _send_json(self, 502, {'error': str(error)})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        pass
