interface BuildArgs {
  gradeLevel: string;
  pointScale: number;
  standardText: string;
  describeText: string;
  customText?: string;
}

export function buildRubric({
  gradeLevel,
  pointScale,
  standardText,
  describeText,
  customText = '',
}: BuildArgs): HTMLElement {

  // Step 1 – choose categories (expand&mldr;)
  const categories = customText
    ? customText.split(',').map(c => c.trim()).filter(Boolean)
    : ['Clarity', 'Structure', 'Evidence', 'Conventions'];

  // Step 2 – create table skeleton
  const table = document.createElement('table');
  table.className = 'w-full text-sm border-collapse';
  table.innerHTML = `
    <caption class="text-lg font-semibold my-2">
      ${standardText || 'Rubric'} – ${gradeLevel}
    </caption>
    <thead>
      <tr>
        <th class="border p-2">Criteria</th>
        ${Array.from({ length: pointScale }, (_, i) => (
          `<th class="border p-2">Level ${pointScale - i}</th>`
        )).join('')}
      </tr>
    </thead>
    <tbody></tbody>
  `;

  // Step 3 – populate rows
  const tbody = table.querySelector('tbody')!;
  categories.forEach(cat => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="border p-2 font-semibold">${cat}</td>
      ${Array.from({ length: pointScale }, (_, idx) => {
        const level = pointScale - idx;
        const text = level === pointScale
          ? `Exceeds expectations in ${cat.toLowerCase()}`
          : level === 1
            ? `Needs improvement in ${cat.toLowerCase()}`
            : `${cat} meets level ${level}`;
        return `<td class="border p-2">${text}</td>`;
      }).join('')}
    `;
    tbody.appendChild(row);
  });

  // Step 4 – attach descriptor of assignment
  if (describeText) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td colspan="${pointScale + 1}" class="border p-2 italic bg-gray-50">
        <strong>Assignment:</strong> ${describeText}
      </td>`;
    tbody.appendChild(row);
  }
  return table;
}