import json
import re
from http.server import BaseHTTPRequestHandler

import requests


QUEUE_URL = 'https://queue.fal.run/fal-ai/wan'
MODEL_URL = QUEUE_URL + '/v2.2-a14b/text-to-video'
LONG_QUEUE_URL = 'https://queue.fal.run/fal-ai/ltx-2.3'
LONG_MODEL_URL = LONG_QUEUE_URL + '/text-to-video/fast'
REQUEST_ID = re.compile(r'^[a-fA-F0-9-]{36}$')


def send_json(handler, status, payload):
    body = json.dumps(payload).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json')
    handler.send_header('Content-Length', str(len(body)))
    handler.send_header('Cache-Control', 'no-store')
    handler.end_headers()
    handler.wfile.write(body)


def provider_error_message(response, key, action):
    message = f'Video provider returned HTTP {response.status_code}.'
    try:
        payload = response.json()
    except ValueError:
        payload = None

    def find_detail(value):
        if isinstance(value, str):
            return value
        if isinstance(value, dict):
            for name in ('detail', 'message', 'error', 'msg'):
                detail = find_detail(value.get(name))
                if detail:
                    return detail
        if isinstance(value, list):
            for item in value:
                detail = find_detail(item)
                if detail:
                    return detail
        return None

    detail = find_detail(payload)
    if detail:
        detail = re.sub(re.escape(key), '[redacted]', detail, flags=re.IGNORECASE)
        for secret in key.split(':'):
            if len(secret) >= 4:
                detail = re.sub(re.escape(secret), '[redacted]', detail, flags=re.IGNORECASE)
        detail = ' '.join(detail.split())[:500]
        if detail:
            message += f' fal.ai: {detail}'
    else:
        message += ' Check your key, credits, and model access.'
    if action == 'create' and response.status_code >= 500:
        message += ' The job may have been submitted; check fal.ai before retrying.'
    return message


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        key = self.headers.get('X-Video-Key', '').strip()
        if not key or len(key) > 512 or '\n' in key or '\r' in key:
            send_json(self, 400, {'error': 'Add a fal.ai video API key in Settings.'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 16000:
                send_json(self, 400, {'error': 'Invalid video request size.'})
                return
            data = json.loads(self.rfile.read(length).decode('utf-8'))
            if not isinstance(data, dict):
                raise ValueError('Invalid request')
            action = data.get('action')
            headers = {'Authorization': f'Key {key}'}
            model = data.get('model', 'wan')
            if model not in ('wan', 'ltx'):
                send_json(self, 400, {'error': 'Invalid video model.'})
                return
            if action == 'create':
                prompt = data.get('prompt')
                if not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 12000:
                    send_json(self, 400, {'error': 'Provide a video prompt under 12,000 characters.'})
                    return
                if model == 'ltx':
                    duration = data.get('duration')
                    if type(duration) is not int or duration not in (12, 14, 16, 18, 20):
                        send_json(self, 400, {'error': 'Long video duration must be 12, 14, 16, 18, or 20 seconds.'})
                        return
                    model_url = LONG_MODEL_URL
                    model_input = {'prompt': prompt.strip(), 'duration': duration, 'fps': 25,
                                   'resolution': '1080p', 'generate_audio': False}
                else:
                    num_frames = data.get('num_frames', 81)
                    if type(num_frames) is not int or num_frames not in range(81, 162, 16):
                        send_json(self, 400, {'error': 'Short video length must be between 5 and 10 seconds.'})
                        return
                    model_url = MODEL_URL
                    model_input = {'prompt': prompt.strip(), 'num_frames': num_frames, 'frames_per_second': 16}
                response = requests.post(model_url, headers=headers, json=model_input, timeout=30)
            elif action in ('status', 'result'):
                request_id = data.get('request_id')
                if not isinstance(request_id, str) or not REQUEST_ID.fullmatch(request_id):
                    send_json(self, 400, {'error': 'Invalid video request ID.'})
                    return
                suffix = '/status' if action == 'status' else ''
                queue_url = LONG_QUEUE_URL if model == 'ltx' else QUEUE_URL
                response = requests.get(f'{queue_url}/requests/{request_id}{suffix}', headers=headers, timeout=30)
            else:
                send_json(self, 400, {'error': 'Invalid video request action.'})
                return
            if not response.ok:
                send_json(self, response.status_code, {'error': provider_error_message(response, key, action)})
                return
            try:
                payload = response.json()
            except ValueError:
                send_json(self, 502, {'error': 'Video provider returned invalid JSON. The job may have been submitted; check fal.ai before retrying.'})
                return
            if not isinstance(payload, dict):
                send_json(self, 502, {'error': 'Video provider returned an invalid response. The job may have been submitted; check fal.ai before retrying.'})
                return
            send_json(self, 200, payload)
        except (ValueError, UnicodeDecodeError):
            send_json(self, 400, {'error': 'Invalid video request.'})
        except requests.Timeout:
            send_json(self, 504, {'error': 'Video provider timed out. Check the request status before retrying.'})
        except requests.RequestException:
            send_json(self, 502, {'error': 'Video provider is unavailable. Check the request status before retrying.'})

    def log_message(self, format, *args):
        pass
