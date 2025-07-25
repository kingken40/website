// ----------------------------- utilities
function clonePrompt(id, labelText, namePrefix, required = false) {
  const tpl   = document.getElementById('richPrompt');
  const node  = tpl.content.cloneNode(true);
  const block = node.querySelector('div');

  // label
  block.querySelector('.prompt-label').textContent = labelText +
    (required ? ' *' : ' (optional)');

  // radio name group (text | file | url)
  block.querySelectorAll('.modeRadio').forEach(r => {
    r.name = `${namePrefix}-mode`;
    // default first radio checked already
  });

  // inputs get unique names so they post nicely
  block.querySelector('.prompt-text').name = `${namePrefix}Text`;
  block.querySelector('.prompt-file').name = `${namePrefix}File`;
  block.querySelector('.prompt-url').name  = `${namePrefix}Url`;

  // required flag only for the text input (other two modes
  // will be validated manually)
  if (required) block.querySelector('.prompt-text').required = true;

  return block;
}

function setMode(block, mode) {
  ['text','file','url'].forEach(k => {
    block.querySelector(`.prompt-${k}`).classList.toggle('hidden', k!==mode);
  });
}

// ----------------------------- mount three prompts
const standard = clonePrompt('richPrompt', 'Standard / Objective', 'standard', true);
const descr    = clonePrompt('richPrompt', 'Assignment Description', 'description', true);
const custom   = clonePrompt('richPrompt', 'Additional Customization', 'custom', false);

document.getElementById('standardPrompt').appendChild(standard);
document.getElementById('descriptionPrompt').appendChild(descr);
document.getElementById('customPrompt').appendChild(custom);

// ----------------------------- mode switcher handlers
document.querySelectorAll('.modeRadio').forEach(radio => {
  radio.addEventListener('change', e => {
    const blk  = e.target.closest('div');   // prompt wrapper
    const mode = e.target.value;
    setMode(blk, mode);
    // toggle required attribute
    const textInp = blk.querySelector('.prompt-text');
    textInp.required = (mode === 'text' && textInp.name.startsWith('standard') || 
                        mode === 'text' && textInp.name.startsWith('description'));
    // clear other inputs so only one value ever posts
    blk.querySelector('.prompt-file').value = '';
    blk.querySelector('.prompt-url').value  = '';
  });
});

// ----------------------------- submit
document.getElementById('rubricForm').addEventListener('submit', async e => {
  e.preventDefault();

  const fd = new FormData(e.target); // includes files automatically

  // client-side check: each prompt must have EXACTLY one value
  ['standard','description','custom'].forEach(prefix => {
    const text = fd.get(`${prefix}Text`);
    const file = fd.get(`${prefix}File`);
    const url  = fd.get(`${prefix}Url`);
    const valuesFilled = [text,file,url].filter(v => {
      if (v instanceof File) return v.size > 0;
      return v;
    });
    if (prefix !== 'custom' && valuesFilled.length === 0) {
      alert(`Please provide a ${prefix} via text, file, or URL.`);
      throw new Error('validation');
    }
    if (valuesFilled.length > 1) {
      alert(`Choose only ONE input type for ${prefix}.`);
      throw new Error('validation');
    }
  });

  // TODO: POST to your backend endpoint
  try {
    const res = await fetch('/api/generate-rubric', {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) throw new Error(await res.text());
    const { rubricUrl } = await res.json();
    window.location.href = rubricUrl; // or show success UI
  } catch (err) {
    console.error(err);
    alert('Failed to generate rubric. See console.');
  }
});