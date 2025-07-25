// English (EN) – fallback language.
const EN = {
  criteria: {
    "Clarity":               "Clarity",
    "Organization":          "Organization",
    "Supporting evidence":   "Supporting evidence",
    "Grammar and Mechanics": "Grammar and Mechanics",
    "Creativity and Style":  "Creativity and Style"
  },
  descriptions: {
    "Clarity": { 1: "Argument is unclear and difficult to follow.",
                 2: "Argument is somewhat clear but contains occasional ambiguity.",
                 3: "Argument is clear and concise, with minimal ambiguity.",
                 4: "Argument is exceptionally clear and concise, with no ambiguity." },
    "Organization": { 1: "Poorly organized structure.",
                      2: "Some organization but lacking overall flow.",
                      3: "Well-organized with minor issues.",
                      4: "Exceptionally organized with clear flow." },
    "Supporting evidence": { 1: "Little to no supporting evidence.",
                             2: "Some evidence, but non-conclusive.",
                             3: "Adequate supporting evidence.",
                             4: "Abundant and pertinent supporting evidence." },
    "Grammar and Mechanics": { 1: "Frequent grammatical errors; hard to understand.",
                               2: "Several grammatical mistakes impacting clarity.",
                               3: "Minor grammatical errors; meaning is clear.",
                               4: "Error-free writing demonstrating mastery." },
    "Creativity and Style": { 1: "Lacks creativity and an engaging style.",
                              2: "Some creative elements but inconsistent.",
                              3: "Creative and stylistically solid.",
                              4: "Highly creative and engaging style." }
  },
  captions: {
    rubricFor:           "Rubric for",
    difficultyLabel:     "Difficulty",
    descriptionSeparator:" - "
  }
};

// Spanish (ES)
const ES = {
  criteria: {
    "Clarity":               "Claridad",
    "Organization":          "Organización",
    "Supporting evidence":   "Evidencia de apoyo",
    "Grammar and Mechanics": "Gramática y mecánica",
    "Creativity and Style":  "Creatividad y estilo"
  },
  descriptions: {
    "Clarity": { 1: "El argumento es poco claro y difícil de seguir.",
                 2: "El argumento es algo claro, pero tiene ambigüedades ocasionales.",
                 3: "El argumento es claro y conciso, con mínima ambigüedad.",
                 4: "El argumento es excepcionalmente claro y conciso, sin ambigüedad." },
    // … fill in the rest as needed …
  },
  captions: {
    rubricFor:           "Rúbrica para",
    difficultyLabel:     "Dificultad",
    descriptionSeparator:" - "
  }
};

// (Define FR, DE, ZH, JA, AR, PT, RU, HI similarly)

// Master lookup
const i18n = {
  English:    EN,
  Spanish:    ES,
  // French: FR,
  // German: DE,
  // Chinese: ZH,
  // Japanese: JA,
  // Arabic: AR,
  // Portuguese: PT,
  // Russian: RU,
  // Hindi: HI
};

// Helper translation functions
function tCrit(name, lang) {
  return i18n[lang]?.criteria[name] || EN.criteria[name];
}

function tDesc(name, lvl, lang) {
  return i18n[lang]?.descriptions[name]?.[lvl] || EN.descriptions[name][lvl];
}

function tCap(key, lang) {
  return i18n[lang]?.captions[key] || EN.captions[key];
}