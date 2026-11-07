import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from api.chat import handler as chat_handler
from api.models import handler as models_handler

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.getenv('PORT', '3000'))


def load_environment():
    path = os.path.join(ROOT, '.env.local')
    if not os.path.isfile(path):
        return
    with open(path, encoding='utf-8') as env_file:
        for line in env_file:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                name, value = line.split('=', 1)
                os.environ.setdefault(name.strip(), value.strip().strip('"\''))


class DevHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/models':
            return models_handler.do_GET(self)
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path == '/api/chat':
            return chat_handler.do_POST(self)
        self.send_error(404)

    def do_OPTIONS(self):
        path = urlparse(self.path).path
        if path == '/api/chat':
            return chat_handler.do_OPTIONS(self)
        if path == '/api/models':
            return models_handler.do_OPTIONS(self)
        self.send_error(404)

    def log_message(self, format, *args):
        pass


if __name__ == '__main__':
    load_environment()
    print(f'AI5 dev server running at http://127.0.0.1:{PORT}')
    print('Perplexity Router key: ' + ('configured' if os.getenv('PERPLEXITY_API_KEY') else 'missing'))
    ThreadingHTTPServer(('127.0.0.1', PORT), DevHandler).serve_forever()
