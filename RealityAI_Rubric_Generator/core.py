# core.py
import logging
from typing import Dict, Any
from .tools import parse_input, generate_rubric

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def executor(
    language: str,
    grade_level: str,
    point_scale: int,
    description: str,
    customization: str = ""  # Additional customization (optional)
) -> str:
    """
    Executes the rubric generation process.

    Parameters:
      language (str): The user's language (optional).
      grade_level (str): The selected grade level.
      point_scale (int): The scoring scale (e.g. 4).
      description (str): The assignment description.
      customization (str): Additional customization (optional).

    Returns:
      str: The generated rubric as an HTML string.
    """
    try:
        inputs: Dict[str, Any] = {
            "language": language,
            "grade_level": grade_level,
            "point_scale": point_scale,
            "description": description,
            "customization": customization
        }
        validated_inputs = parse_input(inputs)
        output = generate_rubric(validated_inputs)
        logger.info("Rubric generated successfully.")
        return output

    except Exception as e:
        logger.exception("Error generating rubric: %s", e)
        raise