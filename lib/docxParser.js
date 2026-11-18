// =============================================================================
// docxParser.js · Parse Word Documents (.docx) into Question Import Rows
// Supports both Word Table format and formatted Text / Paragraph format.
// =============================================================================
import JSZip from 'jszip';
import { TEMPLATE_HEADERS } from '@/lib/server/content';

/**
 * Extract text from XML nodes (<w:t>)
 */
function extractXmlText(xmlSnippet) {
  const matches = xmlSnippet.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  return matches.map(m => m.replace(/<w:t[^>]*>|<\/w:t>/g, '')).join('');
}

/**
 * Parse a .docx file buffer into 2D rows (array of array of strings)
 * @param {ArrayBuffer|Buffer} buffer
 * @returns {Promise<Array<Array<string>>>}
 */
export async function parseDocxToRows(buffer) {
  const zip = new JSZip();
  const loaded = await zip.loadAsync(buffer);
  const docXmlFile = loaded.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('Invalid Word document: word/document.xml not found.');
  }
  const xml = await docXmlFile.async('string');

  // Strategy 1: Check for Word Tables (<w:tbl>)
  const tableMatches = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/g) || [];
  if (tableMatches.length > 0) {
    const tableRows = [];
    for (const tableXml of tableMatches) {
      const trMatches = tableXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
      for (const trXml of trMatches) {
        const tcMatches = trXml.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
        const rowCells = tcMatches.map(tcXml => extractXmlText(tcXml).trim());
        if (rowCells.some(c => c.length > 0)) {
          tableRows.push(rowCells);
        }
      }
    }
    if (tableRows.length > 1) {
      // Check if first row has recognizable headers
      const firstRowStr = tableRows[0].join(' ').toLowerCase();
      if (firstRowStr.includes('question') || firstRowStr.includes('option') || firstRowStr.includes('answer')) {
        return tableRows;
      }
    }
  }

  // Strategy 2: Paragraph-based question blocks (<w:p>)
  const pMatches = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  const lines = pMatches.map(p => extractXmlText(p).trim()).filter(Boolean);

  const questions = [];
  let curQ = null;

  const pushCurrent = () => {
    if (curQ && curQ.text) {
      questions.push(curQ);
    }
    curQ = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect new question: e.g. "Question 1:", "Q1.", "1.", "1)"
    const qMatch = line.match(/^(?:question\s*\d+[:.]?|q\d+[:.]?|\d+[\.\)])\s*(.+)/i);
    if (qMatch) {
      pushCurrent();
      curQ = {
        text: qMatch[1].trim(),
        type: 'Single choice',
        options: {},
        correct: '',
        points: 1,
        skillArea: '',
        competencies: '',
      };
      continue;
    }

    // Detect options: e.g. "A)", "A.", "Option A:", "[A]"
    const optMatch = line.match(/^(?:option\s+)?([A-J])[\.\):]\s*(.+)/i);
    if (optMatch && curQ) {
      const letter = optMatch[1].toUpperCase();
      curQ.options[letter] = optMatch[2].trim();
      continue;
    }

    // Detect Correct answer: e.g. "Answer: A", "Correct: A, B", "Key: True"
    const ansMatch = line.match(/^(?:correct\s*answers?|correct|answer\s*key|answer)[:\s]+(.+)/i);
    if (ansMatch && curQ) {
      curQ.correct = ansMatch[1].trim();
      continue;
    }

    // Detect Skill Area: e.g. "Skill Area: Learning & Development"
    const skillMatch = line.match(/^(?:skill\s*area|skill)[:\s]+(.+)/i);
    if (skillMatch && curQ) {
      curQ.skillArea = skillMatch[1].trim();
      continue;
    }

    // Detect Competency: e.g. "Competency: HR-TA" or "Code: HR-TA"
    const compMatch = line.match(/^(?:competency\s*codes?|competency|code)[:\s]+(.+)/i);
    if (compMatch && curQ) {
      curQ.competencies = compMatch[1].trim();
      continue;
    }

    // Detect Points
    const ptMatch = line.match(/^(?:points|marks)[:\s]+(\d+(?:\.\d+)?)/i);
    if (ptMatch && curQ) {
      curQ.points = Number(ptMatch[1]);
      continue;
    }

    // Detect Question Type
    const typeMatch = line.match(/^(?:type|question\s*type)[:\s]+(.+)/i);
    if (typeMatch && curQ) {
      curQ.type = typeMatch[1].trim();
      continue;
    }

    // If curQ exists and no options yet, append to question text
    if (curQ && Object.keys(curQ.options).length === 0 && !curQ.correct) {
      curQ.text += ' ' + line;
    }
  }
  pushCurrent();

  if (questions.length === 0) {
    throw new Error('No questions found in this Word document. Make sure each question begins with "Question 1:", "1.", or use the table format.');
  }

  // Convert parsed questions into standard 2D table rows
  const rows = [TEMPLATE_HEADERS];
  for (const q of questions) {
    const isMulti = String(q.correct).includes(',') || String(q.correct).length > 1;
    const type = q.type || (isMulti ? 'Multiple choice' : 'Single choice');
    rows.push([
      q.text,
      type,
      q.options.A || '',
      q.options.B || '',
      q.options.C || '',
      q.options.D || '',
      q.options.E || '',
      q.options.F || '',
      q.correct || 'A',
      q.points || 1,
      q.skillArea || '',
      q.competencies || '',
    ]);
  }

  return rows;
}
