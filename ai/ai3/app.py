from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
import requests

load_dotenv()

app = Flask(__name__)
CORS(app)

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

@app.route('/api/chat', methods=['POST'])
def chat():
    if not OPENAI_API_KEY:
        return jsonify({'error': 'OpenAI API key not configured'}), 500
    
    try:
        data = request.json
        
        response = requests.post(
            OPENAI_API_URL,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {OPENAI_API_KEY}'
            },
            json=data,
            timeout=30
        )
        
        return jsonify(response.json()), response.status_code
    
    except requests.Timeout:
        return jsonify({'error': 'Request timeout'}), 504
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
