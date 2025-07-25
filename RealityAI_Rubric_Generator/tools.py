from typing import Dict, Any

def parse_input(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate and transform input parameters.
    Raises a ValueError if required data is missing or invalid.
    """
    try:
        # Strip and retrieve the required 'grade_level'
        grade_lvl = inputs["grade_level"].strip()
        if not grade_lvl:
            raise ValueError("grade_level is required and cannot be empty")
        
        validated = {
            "language": (inputs.get("language") or "").strip(),
            "grade_level": grade_lvl,
            "point_scale": int(inputs["point_scale"]),
            "description": (inputs.get("description") or "").strip(),
            "customization": (inputs.get("customization") or "").strip(),
        }
    except Exception as error:
        raise ValueError(f"Invalid input: {error}")
    return validated

def generate_rubric(data: Dict[str, Any]) -> str:
    """
    Generates a rubric as an HTML string based on the provided data.

    Expected keys in data:
      - grade_level: e.g., "9th Grade"
      - point_scale: e.g., 4
      - description: Assignment Description.
      - customization: Additional Customization (optional)
    
    The generated rubric uses:
      - The title: "Rubric for {grade_level}"
      - A paragraph for the assignment description.
      - A table where the default criteria are:
            ["Clarity", "Structure", "Argumentation"]
        and, if customization is provided, its text is appended as an extra criterion.
    """
    grade_level = data.get("grade_level", "Unknown")
    point_scale = data.get("point_scale", 4)
    assignment_description = data.get("description", "")
    customization = data.get("customization", "")

    title = f"Rubric for {grade_level}"

    default_criteria = ["Clarity", "Structure", "Argumentation"]
    if customization:
        criteria = default_criteria + [customization]
    else:
        criteria = default_criteria

    html = f"""
    <html>
      <head>
        <title>{title}</title>
        <style>
          table {{ border-collapse: collapse; width: 100%; }}
          th, td {{ border: 1px solid #ccc; padding: 8px; text-align: center; }}
          th {{ background-color: #4c51bf; color: #fff; }}
        </style>
      </head>
      <body>
        <h1>{title}</h1>
        <p>{assignment_description}</p>
        <table>
          <thead>
            <tr>
              <th>Criteria</th>
    """
    for level in range(1, point_scale + 1):
        html += f"<th>Level {level}</th>"
    html += "</tr></thead><tbody>"

    for crit in criteria:
        html += "<tr>"
        html += f"<td>{crit}</td>"
        for level in range(1, point_scale + 1):
            if level == point_scale:
                desc = f"Exceeds expectations in {crit.lower()}"
            elif level == 1:
                desc = f"Needs improvement in {crit.lower()}"
            else:
                desc = f"{crit} meets level {level}"
            html += f"<td>{desc}</td>"
        html += "</tr>"
    html += """
          </tbody>
        </table>
      </body>
    </html>
    """
    return html