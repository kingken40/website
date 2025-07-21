from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import os
import sys
from datetime import datetime

sys.path.append(os.path.join(os.path.dirname(__file__), '../src'))
from ToughLuckGameplay import start

app = Flask(__name__, template_folder='templates')
CORS(app, supports_credentials=True)

@app.route('/')
def index():
    return render_template('UserGUI.html')

@app.route('/UserGUI.html')
def user_gui_html():
    return render_template('UserGUI.html')

@app.route('/UserGameplay.html')
def user_gameplay_html():
    return render_template('UserGameplay.html')

@app.route('/UserStart.html')
def user_start_html():
    return render_template('UserStart.html')

@app.route('/UserResults.html')
def user_results_html():
    return render_template('UserResults.html')

@app.route('/start', methods=['POST'])
def start_route():
    try:
        data = request.get_json()
        # Extract values from frontend, provide defaults if missing
        moves = int(data.get('totalMoves', 3))
        dif = data.get('difficulty', 'e')
        path_list = data.get('pathList', [])
        current_position = int(data.get('currentPosition', 1))
        move = int(data.get('move', 0))
        points = int(data.get('points', 0))
        missed = int(data.get('missed', 0))
        chances = int(data.get('chances', 3))
        dupp = int(data.get('allowDuplicates', 1))
        attempts_for_current_position = int(data.get('attemptsForCurrentPosition', 0))

        result = start(
            moves, dif, path_list, current_position, move,
            points, missed, chances, dupp, attempts_for_current_position
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/submit_feedback', methods=['POST'])
def submit_feedback():
    data = request.get_json()
    name = data.get('name', '')
    email = data.get('email', '')
    message = data.get('message', '')
    project = data.get('project', '')
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    entry = (
        f"- Name Provided: {name if name else 'N/A'}\n"
        f"- Time: {timestamp}\n"
        f"- Email: {email if email else 'N/A'}\n"
        f"- Project: {project}\n"
        f"- Feedback Message: {message}\n"
        "-----------------------------\n"
    )
    with open('feedback.txt', 'a', encoding='utf-8') as f:
        f.write(entry)
    return {'success': True}

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)