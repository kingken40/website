import pytest
from RealityAI_Rubric_Generator.core import executor

def test_executor_valid_input():
    # Prepare valid inputs.
    language = "en"
    grade_level = "9th Grade"
    point_scale = 4
    description = "Write an essay on climate change."
    customization = "Creativity"
    
    html_output = executor(language, grade_level, point_scale, description, customization)
    
    # Check that output is a string and contains expected title.
    assert isinstance(html_output, str)
    expected_title = f"Rubric for {grade_level}"
    assert expected_title in html_output
    
    # Check that customization text (as an extra criterion) is appended.
    assert customization in html_output

def test_executor_missing_required_field():
    # Missing required grade_level should trigger a ValueError.
    language = "en"
    grade_level = ""  # Required field empty
    point_scale = 4
    description = "Write an essay on climate change."
    customization = ""
    
    with pytest.raises(ValueError):
        executor(language, grade_level, point_scale, description, customization)