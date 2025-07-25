import React, { useState } from 'react';

import { parseUpload } from '../logic/parseUpload';
import { fetchUrlText } from '../logic/fetchurlText';
import { buildRubric } from '../logic/buildRubric';
import { toPdf } from '../export/toPdf';
import { toDocx } from '../export/toDocsx';

export const RubricForm = () => {
  const [gradeLevel, setGradeLevel] = useState('');
  const [pointScale, setPointScale] = useState(4);
  const [describeMode,  setDescribeMode]  = useState<'text' | 'file' | 'url'>('text');
  const [customMode,    setCustomMode]    = useState<'text' | 'file' | 'url'>('text');
  const [describeVal,   setDescribeVal]   = useState<string | File>('');
  const [customVal,     setCustomVal]     = useState<string | File>('');
  const [rubricTable,   setRubricTable]   = useState<HTMLElement | null>(null);

  async function normalizeInput(
    mode: 'text' | 'file' | 'url',
    value: string | File,
  ): Promise<string> {
    if (mode === 'text')   return value as string;
    if (mode === 'file')   return await parseUpload(value as File);
    /* mode === 'url' */   return await fetchUrlText(value as string);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const describeText  = await normalizeInput(describeMode, describeVal);
    const customText    = customMode === 'text' && !customVal ? '' :
                          await normalizeInput(customMode, customVal);

    const rubricHtml = buildRubric({
      gradeLevel,
      pointScale,
      standardText: '',
      describeText,
      customText,
    });

    setRubricTable(rubricHtml);
  };

  async function downloadPdf()  { if (rubricTable) await toPdf(rubricTable); }
  async function downloadDoc() {
  if (rubricTable) {
    try {
      const url = await toDocx(rubricTable);
      if (!url) throw new Error("No URL returned from toDocx");

      const a = document.createElement("a");
      a.href = url;
      a.download = "rubric.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert("Failed to generate DOCX file. Falling back to HTML export.");
      console.error("DOCX generation error:", error);
      if (rubricTable) {
        const htmlContent = rubricTable.outerHTML;
        const blob = new Blob([htmlContent], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
        const fallbackUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = fallbackUrl;
        a.download = "rubric-fallback.docx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(fallbackUrl);
      }
    }
  }
}


  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        

        {/* Grade level */}
        <div>
          <label>Grade level</label>
          <select
            value={gradeLevel}
            required
            onChange={e => setGradeLevel(e.target.value)}
            className="border rounded p-2 w-full"
          >
            <option value="" disabled>Select…</option>
            <option>K-2</option><option>3-5</option>
            <option>6-8</option><option>9-12</option>
            <option>Higher Ed</option>
          </select>
        </div>

        {/* Point scale */}
        <div>
          <label>Point scale</label>
          <input
            type="number"
            min={2}
            max={10}
            value={pointScale}
            required
            onChange={e => setPointScale(+e.target.value)}
            className="border rounded p-2 w-24"
          />
        </div>

        {/* Assignment description prompt */}
        <PromptBlock
          title="Assignment Description"
          mode={describeMode}
          setMode={setDescribeMode}
          value={describeVal}
          setValue={setDescribeVal}
          required
        />

        {/* Customization prompt (optional) */}
        <PromptBlock
          title="Additional Customization (optional)"
          mode={customMode}
          setMode={setCustomMode}
          value={customVal}
          setValue={setCustomVal}
          required={false}
        />

        <button className="bg-blue-600 text-white px-4 py-2 rounded">
          Generate Rubric
        </button>
      </form>

      {/* Render table + download buttons */}
      {rubricTable && (
        <div className="space-y-4">
          <div dangerouslySetInnerHTML={{ __html: rubricTable.outerHTML }} />
          <div className="flex gap-4">
            <button onClick={downloadPdf}  className="btn">Download PDF</button>
            <button onClick={downloadDoc}  className="btn">Download DOCX</button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ────────────────────────────────────────── helper component ── */
interface PromptProps {
  title: string;
  mode: 'text' | 'file' | 'url';
  setMode: (m: 'text' | 'file' | 'url') => void;
  value: string | File;
  setValue: (v: any) => void;
  required?: boolean;
}

const PromptBlock = ({
  title, mode, setMode, value, setValue, required = false,
}: PromptProps) => (
  <fieldset className="border rounded p-4">
    <legend className="font-semibold">{title}</legend>

    <div className="flex gap-4 mb-2">
      {['text','file','url'].map(opt => (
        <label key={opt} className="flex gap-1 items-center">
          <input
            type="radio"
            name={title}
            checked={mode === opt}
            onChange={() => setMode(opt as any)}
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>

    {mode === 'text' && (
      <textarea
        className="border p-2 w-full"
        rows={4}
        required={required}
        value={typeof value === 'string' ? value : ''}
        onChange={e => setValue(e.target.value)}
      />
    )}
    {mode === 'file' && (
      <input
        type="file"
        required={required}
        accept=".csv,.pdf,.docx,.ppt,.pptx,.txt,text/plain,application/pdf"
        onChange={e => setValue(e.target.files?.[0] ?? '')}
      />
    )}
    {mode === 'url' && (
      <input
        type="url"
        required={required}
        placeholder="https://"
        className="border p-2 w-full"
        value={typeof value === 'string' ? value : ''}
        onChange={e => setValue(e.target.value)}
      />
    )}
  </fieldset>
);
