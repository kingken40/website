# Flask server for the Lesson Plan Generator application - handles backend operations and file serving
from flask import Flask

# PDF_FILE_PATH = 'C:\\Users\\offda\\OneDrive\\Documents\\apps\\features\\lesson_plan_generator\\public\\lesson_plan_p2.pdf'
DOCX_FILE_PATH = 'C:\\Users\\offda\\OneDrive\\Documents\\apps\\features\\lesson_plan_generator\\public\\lesson_plan_p2.docx'
app = Flask(__name__)  # This creates the Flask app instance

@app.route('/')
def home():
    return "Hello World!"  

if __name__ == '__main__': 
    app.run(port=5000, debug=True)  

print("1 - Script started")  # Should appear immediately when running

app = Flask(__name__)
print("2 - Flask app created")  # Check if this prints

@app.route('/')
def home():
    print("3 - Route accessed")  # Will show when http://127.0.0.1:5000 is visited
    return "Hello World!"

if __name__ == '__main__':
    print("4 - About to start server")  # Last message before server starts
    app.run(port=5000, debug=True)