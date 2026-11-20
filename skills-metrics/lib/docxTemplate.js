// =============================================================================
// docxTemplate.js · Generate a downloadable Word Document (.docx) question template
// =============================================================================
import JSZip from 'jszip';
import { TEMPLATE_HEADERS, TEMPLATE_EXAMPLES, TEMPLATE_NOTES } from '@/lib/server/content';

/**
 * Escape text for XML
 */
function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Creates a valid .docx document buffer containing questions table and instructions
 * @param {Array<{ code: string, name: string }>} competencies
 * @returns {Promise<Buffer>}
 */
export async function createDocxQuestionTemplate(competencies = []) {
  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  // 3. word/document.xml
  let tableRowsXml = '';

  // Header row
  tableRowsXml += '<w:tr><w:trPr><w:tblHeader/></w:trPr>';
  for (const h of TEMPLATE_HEADERS) {
    tableRowsXml += `<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:sz w:val="18"/></w:rPr><w:t>${escapeXml(h)}</w:t></w:r></w:p></w:tc>`;
  }
  tableRowsXml += '</w:tr>';

  // Example rows
  for (const row of TEMPLATE_EXAMPLES) {
    tableRowsXml += '<w:tr>';
    for (let i = 0; i < TEMPLATE_HEADERS.length; i++) {
      const val = row[i] != null ? row[i] : '';
      tableRowsXml += `<w:tc><w:p><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>${escapeXml(val)}</w:t></w:r></w:p></w:tc>`;
    }
    tableRowsXml += '</w:tr>';
  }

  // Blank template rows for author
  for (let r = 0; r < 5; r++) {
    tableRowsXml += '<w:tr>';
    for (let i = 0; i < TEMPLATE_HEADERS.length; i++) {
      tableRowsXml += `<w:tc><w:p><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t></w:t></w:r></w:p></w:tc>`;
    }
    tableRowsXml += '</w:tr>';
  }

  // Notes XML
  let notesXml = '';
  for (const n of TEMPLATE_NOTES) {
    notesXml += `<w:p><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="4A5568"/></w:rPr><w:t>• ${escapeXml(n[0])}</w:t></w:r></w:p>`;
  }

  // Competency references XML
  let compsXml = '';
  if (competencies.length) {
    compsXml += `<w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>Available Competency Codes Reference:</w:t></w:r></w:p>`;
    for (const c of competencies) {
      compsXml += `<w:p><w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="1A365D"/></w:rPr><w:t>${escapeXml(c.code)}</w:t></w:r><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="4A5568"/></w:rPr><w:t>: ${escapeXml(c.name)}</w:t></w:r></w:p>`;
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="15803D"/></w:rPr><w:t>DVLA Skills Assessment Question Upload Template (.docx)</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:i/><w:sz w:val="20"/><w:color w:val="718096"/></w:rPr><w:t>Fill out the question table below, or write questions in formatted text blocks (Question 1, Options A-D, Answer key).</w:t></w:r></w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E0"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E0"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E0"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E0"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        </w:tblBorders>
      </w:tblPr>
      ${tableRowsXml}
    </w:tbl>
    <w:p/>
    <w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>Instructions &amp; Template Rules:</w:t></w:r></w:p>
    ${notesXml}
    <w:p/>
    ${compsXml}
  </w:body>
</w:document>`;

  zip.file('word/document.xml', documentXml);

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}
