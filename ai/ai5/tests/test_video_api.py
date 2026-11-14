import io
import json
import threading
import unittest
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from urllib.request import Request as HttpRequest, urlopen

import requests

from api.video import handler
from dev_server import DevHandler


class Request:
    def __init__(self, data, key='test-key'):
        body = json.dumps(data).encode()
        self.headers = {'Content-Length': str(len(body)), 'X-Video-Key': key}
        self.rfile = io.BytesIO(body)
        self.wfile = io.BytesIO()
        self.status = None

    def send_response(self, status):
        self.status = status

    def send_header(self, *args):
        pass

    def end_headers(self):
        pass


class Response:
    ok = True
    status_code = 200

    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload


class VideoApiTests(unittest.TestCase):
    def test_dev_server_routes_video_requests_to_provider(self):
        request_id = '764cabcf-b745-4b3e-ae38-1200304cf45b'
        server = ThreadingHTTPServer(('127.0.0.1', 0), DevHandler)
        thread = threading.Thread(target=server.serve_forever)
        thread.start()
        try:
            with patch('api.video.requests.post', return_value=Response({'request_id': request_id})) as post, \
                    patch('api.video.requests.get', side_effect=[
                        Response({'status': 'COMPLETED'}),
                        Response({'video': {'url': 'https://storage.example/video.mp4'}}),
                    ]) as get:
                def call(data):
                    request = HttpRequest(
                        f'http://127.0.0.1:{server.server_port}/api/video',
                        data=json.dumps(data).encode(),
                        headers={'Content-Type': 'application/json', 'X-Video-Key': 'test-key'},
                    )
                    with urlopen(request, timeout=5) as response:
                        self.assertEqual(response.status, 200)
                        return json.load(response)

                self.assertEqual(call({'action': 'create', 'prompt': 'a funny video'})['request_id'], request_id)
                self.assertEqual(call({'action': 'status', 'request_id': request_id})['status'], 'COMPLETED')
                self.assertEqual(call({'action': 'result', 'request_id': request_id})['video']['url'],
                                 'https://storage.example/video.mp4')
                post.assert_called_once()
                self.assertEqual(get.call_count, 2)
        finally:
            server.shutdown()
            thread.join()
            server.server_close()

    def test_submit_and_poll_use_fixed_provider_endpoints(self):
        request_id = '764cabcf-b745-4b3e-ae38-1200304cf45b'
        with patch('api.video.requests.post', return_value=Response({'request_id': request_id})) as post:
            request = Request({'action': 'create', 'prompt': 'A moonlit sea'})
            handler.do_POST(request)
            self.assertEqual(request.status, 200)
            self.assertEqual(post.call_args.args[0], 'https://queue.fal.run/fal-ai/wan/v2.2-a14b/text-to-video')
            self.assertEqual(post.call_args.kwargs['json']['prompt'], 'A moonlit sea')
            self.assertEqual(post.call_args.kwargs['json']['num_frames'], 81)
        with patch('api.video.requests.get', return_value=Response({'status': 'COMPLETED'})) as get:
            request = Request({'action': 'status', 'request_id': request_id})
            handler.do_POST(request)
            self.assertEqual(request.status, 200)
            self.assertEqual(get.call_args.args[0], f'https://queue.fal.run/fal-ai/wan/requests/{request_id}/status')
        with patch('api.video.requests.get', return_value=Response({'video': {'url': 'https://storage.example/video.mp4'}})) as get:
            request = Request({'action': 'result', 'request_id': request_id})
            handler.do_POST(request)
            self.assertEqual(request.status, 200)
            self.assertEqual(get.call_args.args[0], f'https://queue.fal.run/fal-ai/wan/requests/{request_id}')
            self.assertEqual(json.loads(request.wfile.getvalue())['video']['url'], 'https://storage.example/video.mp4')

    def test_long_video_frame_count_and_invalid_values(self):
        with patch('api.video.requests.post', return_value=Response({'request_id': '764cabcf-b745-4b3e-ae38-1200304cf45b'})) as post:
            request = Request({'action': 'create', 'prompt': 'test', 'num_frames': 161})
            handler.do_POST(request)
            self.assertEqual(request.status, 200)
            self.assertEqual(post.call_args.kwargs['json']['num_frames'], 161)
        for value in (True, 80, 162, '161', None):
            with self.subTest(value=value), patch('api.video.requests.post') as post:
                request = Request({'action': 'create', 'prompt': 'test', 'num_frames': value})
                handler.do_POST(request)
                self.assertEqual(request.status, 400)
                post.assert_not_called()

    def test_long_model_submission_and_polling(self):
        request_id = '764cabcf-b745-4b3e-ae38-1200304cf45b'
        with patch('api.video.requests.post', return_value=Response({'request_id': request_id})) as post:
            request = Request({'action': 'create', 'prompt': 'Earth', 'model': 'ltx', 'duration': 20})
            handler.do_POST(request)
            self.assertEqual(request.status, 200)
            self.assertEqual(post.call_args.args[0], 'https://queue.fal.run/fal-ai/ltx-2.3/text-to-video/fast')
            self.assertEqual(post.call_args.kwargs['json'], {'prompt': 'Earth', 'duration': 20, 'fps': 25,
                                                            'resolution': '1080p', 'generate_audio': False})
        for action, suffix in [('status', '/status'), ('result', '')]:
            with patch('api.video.requests.get', return_value=Response({'status': 'COMPLETED'})) as get:
                request = Request({'action': action, 'model': 'ltx', 'request_id': request_id})
                handler.do_POST(request)
                self.assertEqual(get.call_args.args[0], f'https://queue.fal.run/fal-ai/ltx-2.3/requests/{request_id}{suffix}')
        for model, duration in [('ltx', 21), ('ltx', 15), ('unknown', 20)]:
            with patch('api.video.requests.post') as post:
                request = Request({'action': 'create', 'prompt': 'Earth', 'model': model, 'duration': duration})
                handler.do_POST(request)
                self.assertEqual(request.status, 400)
                post.assert_not_called()

    def test_missing_key_and_invalid_job_do_not_contact_provider(self):
        with patch('api.video.requests.get') as get:
            request = Request({'action': 'status', 'request_id': '../../other'}, key='test-key')
            handler.do_POST(request)
            self.assertEqual(request.status, 400)
            get.assert_not_called()
        request = Request({'action': 'create', 'prompt': 'test'}, key='')
        handler.do_POST(request)
        self.assertEqual(request.status, 400)

    def test_provider_failures_are_reported(self):
        response = Response({})
        response.ok = False
        response.status_code = 402
        with patch('api.video.requests.post', return_value=response):
            request = Request({'action': 'create', 'prompt': 'test'})
            handler.do_POST(request)
            self.assertEqual(request.status, 402)
            self.assertIn('credits', json.loads(request.wfile.getvalue())['error'])

    def test_provider_error_detail_is_reported_without_key(self):
        response = Response({'detail': 'User is locked. Reason: Exhausted balance. Key: key-id:secret-value'})
        response.ok = False
        response.status_code = 403
        with patch('api.video.requests.post', return_value=response):
            request = Request({'action': 'create', 'prompt': 'test'}, key='key-id:secret-value')
            handler.do_POST(request)
            error = json.loads(request.wfile.getvalue())['error']
            self.assertEqual(request.status, 403)
            self.assertIn('Exhausted balance', error)
            self.assertNotIn('key-id', error)
            self.assertNotIn('secret-value', error)

    def test_nested_provider_errors_and_ambiguous_server_error(self):
        response = Response({'error': {'detail': [{'msg': 'Model access denied'}]}})
        response.ok = False
        response.status_code = 503
        with patch('api.video.requests.post', return_value=response):
            request = Request({'action': 'create', 'prompt': 'test'})
            handler.do_POST(request)
            error = json.loads(request.wfile.getvalue())['error']
            self.assertIn('Model access denied', error)
            self.assertIn('check fal.ai before retrying', error)

    def test_non_json_provider_failure_has_fallback(self):
        response = Response(None)
        response.ok = False
        response.status_code = 403
        response.json = lambda: (_ for _ in ()).throw(ValueError('invalid JSON'))
        with patch('api.video.requests.post', return_value=response):
            request = Request({'action': 'create', 'prompt': 'test'})
            handler.do_POST(request)
            self.assertIn('Check your key, credits, and model access', json.loads(request.wfile.getvalue())['error'])

    def test_invalid_provider_response_and_timeout_are_not_client_errors(self):
        for response in (Response([]), Response(None)):
            with self.subTest(payload=response.payload), patch('api.video.requests.post', return_value=response):
                request = Request({'action': 'create', 'prompt': 'test'})
                handler.do_POST(request)
                self.assertEqual(request.status, 502)
                self.assertIn('check fal.ai before retrying', json.loads(request.wfile.getvalue())['error'])
        with patch('api.video.requests.post', side_effect=requests.Timeout):
            request = Request({'action': 'create', 'prompt': 'test'})
            handler.do_POST(request)
            self.assertEqual(request.status, 504)
            self.assertIn('before retrying', json.loads(request.wfile.getvalue())['error'])

    def test_invalid_provider_json_is_reported_as_bad_gateway(self):
        response = Response(None)
        response.json = lambda: (_ for _ in ()).throw(ValueError('invalid JSON'))
        with patch('api.video.requests.post', return_value=response):
            request = Request({'action': 'create', 'prompt': 'test'})
            handler.do_POST(request)
            self.assertEqual(request.status, 502)
            self.assertIn('invalid JSON', json.loads(request.wfile.getvalue())['error'])


if __name__ == '__main__':
    unittest.main()
