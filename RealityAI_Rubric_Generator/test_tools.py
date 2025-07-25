import pytest
from RealityAI_Rubric_Generator.tools import parse_input, generate_rubric
from RealityAI_Rubric_Generator.core import executor

# --- Tests for parse_input ---

def test_parse_input_valid():
    inputs = {
        "language": " en  ",
        "grade_level": "9th Grade",
        "point_scale": "4",  # as string; should be converted to int
        "description": " Write an essay on climate change. ",
        "customization": " Creativity "
    }
    validated = parse_input(inputs)
    assert validated["language"] == "en"
    assert validated["grade_level"] == "9th Grade"
    assert validated["point_scale"] == 4
    assert validated["description"] == "Write an essay on climate change."
    assert validated["customization"] == "Creativity"

def test_parse_input_missing_required():
    inputs = {
        "language": "en",
        # Missing "grade_level"
        "point_scale": "4",
        "description": "Climate change essay",
        "customization": ""
    }
    with pytest.raises(ValueError):
        parse_input(inputs)

def test_parse_input_invalid_point_scale():
    inputs = {
        "language": "en",
        "grade_level": "9th Grade",
        "point_scale": "not_an_int",
        "description": "Climate change essay",
        "customization": ""
    }
    with pytest.raises(ValueError):
        parse_input(inputs)

# --- Tests for generate_rubric ---

def test_generate_rubric_without_customization():
    data = {
        "grade_level": "9th Grade",
        "point_scale": 4,
        "description": "Climate change essay",
        "customization": ""
    }
    html_output = generate_rubric(data)
    expected_title = f"Rubric for {data['grade_level']}"
    assert expected_title in html_output
    # Default criteria in generate_rubric
    for crit in ["Clarity", "Structure", "Argumentation"]:
        assert crit in html_output

def test_executor_missing_required_field():
    # Missing required grade_level should trigger a ValueError.
    language = "en"
    grade_level = ""  # Required field empty
    point_scale = 4
    description = "Write an essay on climate change."
    customization = ""
    
    with pytest.raises(ValueError):
        executor(language, grade_level, point_scale, description, customization)
