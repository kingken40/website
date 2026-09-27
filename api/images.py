import json
import os
from http.server import BaseHTTPRequestHandler

import requests


OPENROUTER_IMAGES_URL = 'https://openrouter.ai/api/v1/images'
OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations'
MAX_PROMPT_LENGTH = 12000


def _send_json(handler, status, payload):
    body = json.dumps(payload).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json')
    handler.send_header('Content-Length', str(len(body)))
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.end_headers()
    handler.wfile.write(body)


def _provider_error(response):
    try:
        payload = response.json()
        error = payload.get('error') if isinstance(payload, dict) else None
        if isinstance(error, dict):
            return {'error': {'message': error.get('message', 'Image provider request failed.')}}
        return payload
    except ValueError:
        return {'error': {'message': response.text or 'Image provider request failed.'}}


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', '0'))
            if content_length <= 0 or content_length > 200000:
                _send_json(self, 413, {'error': {'message': 'Image request is empty or too large.'}})
                return

            data = json.loads(self.rfile.read(content_length).decode('utf-8'))
            prompt = str(data.get('prompt') or '').strip()
            if not prompt or len(prompt) > MAX_PROMPT_LENGTH:
                _send_json(self, 400, {'error': {'message': 'Provide an image prompt under 12,000 characters.'}})
                return

            openrouter_key = os.getenv('OPENROUTER_API_KEY')
            openai_key = os.getenv('OPENAI_API_KEY')
            if openrouter_key:
                response = requests.post(
                    OPENROUTER_IMAGES_URL,
                    headers={
                        'Authorization': f'Bearer {openrouter_key}',
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://kingken40.vercel.app',
                        'X-Title': 'N.O.V.A AI Assistant',
                    },
                    json={
                        'model': 'google/gemini-2.5-flash-image',
                        'prompt': prompt,
                        'aspect_ratio': '1:1',
                        'n': 1,
                    },
                    timeout=150,
                )
            elif openai_key:
                response = requests.post(
                    OPENAI_IMAGES_URL,
                    headers={
                        'Authorization': f'Bearer {openai_key}',
                        'Content-Type': 'application/json',
                    },
                    json={
                        'model': 'gpt-image-1',
                        'prompt': prompt,
                        'size': '1024x1024',
                        'n': 1,
                    },
                    timeout=150,
                )
            else:
                _send_json(self, 503, {
                    'error': {
                        'message': 'Image generation is not configured. Add an OpenRouter or OpenAI API key in AI5 Settings or configure a server API key.'
                    }
                })
                return

            if response.ok:
                _send_json(self, response.status_code, response.json())
            else:
                _send_json(self, response.status_code, _provider_error(response))
        except requests.Timeout:
            _send_json(self, 504, {'error': {'message': 'Image generation timed out. Please try again.'}})
        except requests.RequestException as error:
            _send_json(self, 502, {'error': {'message': f'Image provider unavailable: {error}'}})
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
            _send_json(self, 400, {'error': {'message': 'Invalid image generation request.'}})

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        pass
