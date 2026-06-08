import json
import os
import requests
from http.server import BaseHTTPRequestHandler

OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
OPENROUTER_DEFAULT_MODEL = 'openai/gpt-4o-mini'

OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
OPENAI_DEFAULT_MODEL = 'gpt-4o-mini'

def _send_json(handler, status, payload):
    body = json.dumps(payload).encode()
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json')
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.end_headers()
    handler.wfile.write(body)

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
        OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

        # Prefer OpenRouter, fall back to OpenAI direct
        if OPENROUTER_API_KEY:
            api_key = OPENROUTER_API_KEY
            api_url = OPENROUTER_API_URL
            default_model = OPENROUTER_DEFAULT_MODEL
            extra_headers = {
                'HTTP-Referer': 'https://kingken40.vercel.app',
                'X-Title': 'N.O.V.A AI Assistant'
            }
        elif OPENAI_API_KEY:
            api_key = OPENAI_API_KEY
            api_url = OPENAI_API_URL
            default_model = OPENAI_DEFAULT_MODEL
            extra_headers = {}
        else:
            _send_json(self, 503, {'error': 'No AI API key configured on server. Set OPENROUTER_API_KEY or OPENAI_API_KEY in Vercel environment variables.'})
            return

        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            # Use the provider's default model if the request doesn't specify one
            # or if the model is provider-specific (e.g. OpenRouter models)
            if 'model' not in data or not data['model']:
                data['model'] = default_model

            response = requests.post(
                api_url,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {api_key}',
                    **extra_headers
                },
                json=data,
                timeout=30
            )

            body = response.content
            self.send_response(response.status_code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)

        except requests.Timeout:
            _send_json(self, 504, {'error': 'Request timeout'})

        except Exception as e:
            _send_json(self, 500, {'error': str(e)})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        pass  # Suppress default request logging
