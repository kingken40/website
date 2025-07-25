# Lesson Plan Generator

A web-based application that uses AI to generate comprehensive lesson plans for educators.

## Overview

The Lesson Plan Generator helps teachers create structured lesson plans by providing:
- Grade level selection
- Topic specification
- Standards/objectives input
- Customization options
- Multiple language support
- Export to PDF and DOCX formats

## How It Works

1. Teachers input lesson details through a user-friendly form
2. The application processes these inputs using AI technology
3. A comprehensive lesson plan is generated based on educational best practices
4. Teachers can view, edit, and export the lesson plan in their preferred format

## Files and Structure

- `public/`: Contains HTML files and public-facing resources
  - `lesson_planner_p1.html`: Input form for lesson details
  - `lesson_planner_p2.html`: Displays the generated lesson plan
  - `app.py`: Flask server for backend operations
- `src/`: Contains JavaScript files for application logic
  - `lesson_planner_p1.js`: Handles form submission and validation
  - `lesson_planner_p2.js`: Handles lesson plan display and export
- `styles/`: Contains CSS files for styling
- `prompt/`: Contains AI prompt templates
  - `lesson_plan_prompt.txt`: Template for generating lesson plans
- `metadata.json`: Configuration file with input/output parameters

## Technologies Used

- Frontend: HTML, CSS, JavaScript
- Backend: Flask (Python)
- Document Generation: docx.js library
- AI: Integrated with Marvel AI services

## Usage

1. Open the application in a web browser
2. Fill in the required fields (grade level, topic, etc.)
3. Click "Generate" to create your lesson plan
4. View, edit, and export the generated plan as needed