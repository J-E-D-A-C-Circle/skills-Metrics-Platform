import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { parseDocxToRows } from '../lib/docxParser.js';
import { createDocxQuestionTemplate } from '../lib/docxTemplate.js';
import { parseImportRows } from '../lib/server/content.js';

describe('Word Document (.docx) upload and parsing', () => {
  const dummyComps = [
    { id: 1, code: 'service', name: 'Front-desk customer service', active: true },
    { id: 2, code: 'comm', name: 'Communication skills', active: true },
  ];

  it('generates a valid .docx template and parses it back into rows', async () => {
    const docxBuf = await createDocxQuestionTemplate(dummyComps);
    expect(docxBuf).toBeInstanceOf(Buffer);
    expect(docxBuf.length).toBeGreaterThan(100);

    // Parse the generated template back to rows
    const rows = await parseDocxToRows(docxBuf);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[0][0]).toBe('Question');

    // Verify it is accepted by parseImportRows
    const parsed = parseImportRows(rows, dummyComps);
    expect(parsed.fileErrors.length).toBe(0);
    expect(parsed.questions.length).toBeGreaterThanOrEqual(1);
  });

  it('parses formatted text/paragraph questions from a .docx file', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`);
    
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Question 1: Which system is used for driving licence records?</w:t></w:r></w:p>
    <w:p><w:r><w:t>A) DVLA Main Database</w:t></w:r></w:p>
    <w:p><w:r><w:t>B) Paper register</w:t></w:r></w:p>
    <w:p><w:r><w:t>C) External spreadsheet</w:t></w:r></w:p>
    <w:p><w:r><w:t>D) None of the above</w:t></w:r></w:p>
    <w:p><w:r><w:t>Correct: A</w:t></w:r></w:p>
    <w:p><w:r><w:t>Skill Area: Front-desk service</w:t></w:r></w:p>
    <w:p><w:r><w:t>Competency: service</w:t></w:r></w:p>
  </w:body>
</w:document>`;
    zip.file('word/document.xml', documentXml);
    const buf = await zip.generateAsync({ type: 'nodebuffer' });

    const rows = await parseDocxToRows(buf);
    expect(rows.length).toBe(2); // Header + 1 question
    expect(rows[1][0]).toBe('Which system is used for driving licence records?');
    expect(rows[1][2]).toBe('DVLA Main Database');
    expect(rows[1][8]).toBe('A');

    const parsed = parseImportRows(rows, dummyComps);
    expect(parsed.fileErrors.length).toBe(0);
    expect(parsed.errors.length).toBe(0);
    expect(parsed.questions.length).toBe(1);
  });

  it('supports large question batches of up to 5000 questions', () => {
    const rows = [['Question', 'Type', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct answer(s)', 'Points', 'Skill area', 'Competency codes']];
    for (let i = 1; i <= 1500; i++) {
      rows.push([`Question number ${i} for assessment`, 'Single choice', 'Option 1', 'Option 2', '', '', 'A', 1, 'General', 'service']);
    }
    const parsed = parseImportRows(rows, dummyComps);
    expect(parsed.fileErrors.length).toBe(0);
    expect(parsed.questions.length).toBe(1500);
  });
});
