import json
import os
import re
import requests
from http.server import BaseHTTPRequestHandler
from urllib.parse import quote

OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
OPENROUTER_DEFAULT_MODEL = 'openai/gpt-4o-mini'

OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
OPENAI_DEFAULT_MODEL = 'gpt-4o-mini'
JINA_FETCH_PREFIX = 'https://r.jina.ai/'
JINA_SEARCH_PREFIX = 'https://s.jina.ai/'
JINA_HEADERS = {
    'Accept': 'text/plain',
    'X-Return-Format': 'markdown'
}


def _normalize_model_for_provider(model_name, api_url, default_model):
    requested = str(model_name or '').strip()
    if not requested:
        return default_model

    # OpenRouter model ids often look like "provider/model". Those are not valid
    # when the proxy falls back to OpenAI's native API.
    if api_url == OPENAI_API_URL and '/' in requested:
        return default_model

    return requested


def _merge_sources(*lists):
    merged = []
    seen = set()
    for source_list in lists:
        if not isinstance(source_list, list):
            continue
        for item in source_list:
            if not isinstance(item, dict):
                continue
            url = str(item.get('url') or '').strip()
            title = str(item.get('title') or '').strip()
            if not url or url in seen:
                continue
            seen.add(url)
            merged.append({
                'title': title or url,
                'url': url
            })
    return merged[:12]


def _extract_last_user_index(messages):
    if not isinstance(messages, list):
        return None
    for index in range(len(messages) - 1, -1, -1):
        if isinstance(messages[index], dict) and messages[index].get('role') == 'user':
            return index
    return None


def _extract_web_query(message_text):
    text = str(message_text or '')
    return text.split('WEB SEARCH TASK:', 1)[0].strip()


def _extract_urls(text):
    return re.findall(r'https?://[^\s<>"{}|\\^`\[\]]+', str(text or ''))


def _fetch_jina_markdown(url):
    response = requests.get(f'{JINA_FETCH_PREFIX}{url}', headers=JINA_HEADERS, timeout=20)
    response.raise_for_status()
    return response.text[:9000]


def _search_jina_markdown(query):
    response = requests.get(f'{JINA_SEARCH_PREFIX}{quote(query)}', headers=JINA_HEADERS, timeout=20)
    response.raise_for_status()
    return response.text[:9000]


def _build_server_web_context(message_text):
    text = str(message_text or '')
    if 'WEB SEARCH TASK:' not in text or '=== LIVE ' in text:
        return text, []

    try:
        urls = _extract_urls(text)
        if urls:
            blocks = []
            sources = []
            for url in urls[:2]:
                content = _fetch_jina_markdown(url)
                blocks.append(f'=== LIVE PAGE CONTENT: {url} ===\n{content}\n=== END PAGE CONTENT ===')
                sources.append({'title': url, 'url': url})
            if not blocks:
                return text, []
            return f'{text}\n\n' + '\n\n'.join(blocks), sources

        query = _extract_web_query(text)
        if not query:
            return text, []

        content = _search_jina_markdown(query)
        return (
            f'{text}\n\n=== LIVE WEB SEARCH RESULTS ===\n{content}\n=== END SEARCH RESULTS ===',
            [{'title': query, 'url': f'{JINA_SEARCH_PREFIX}{quote(query)}'}]
        )
    except Exception:
        return text, []

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

            fallback_sources = []
            if api_url == OPENAI_API_URL:
                last_user_index = _extract_last_user_index(data.get('messages'))
                if last_user_index is not None:
                    original_content = data['messages'][last_user_index].get('content', '')
                    enriched_content, fallback_sources = _build_server_web_context(original_content)
                    data['messages'][last_user_index]['content'] = enriched_content

            data['model'] = _normalize_model_for_provider(
                data.get('model'),
                api_url,
                default_model
            )

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
            if fallback_sources:
                try:
                    payload = response.json()
                    payload['sources'] = _merge_sources(payload.get('sources'), fallback_sources)
                    body = json.dumps(payload).encode('utf-8')
                except ValueError:
                    pass
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
