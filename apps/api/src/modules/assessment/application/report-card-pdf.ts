/**
 * Minimal PDF 1.4 (Helvetica) for a single report card. Latin text only.
 */

function pdfEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function buildReportCardPdf(input: {
  readonly schoolName: string;
  readonly examName: string;
  readonly studentName: string;
  readonly className: string;
  readonly lines: ReadonlyArray<{
    readonly subject: string;
    readonly score: string;
    readonly max: string;
    readonly percent: string;
    readonly grade: string;
  }>;
  readonly averagePercent: string;
}): Buffer {
  const rows = [
    `${input.schoolName}`,
    'REPORT CARD',
    `Student: ${input.studentName}`,
    `Class: ${input.className}`,
    `Exam: ${input.examName}`,
    '',
    'Subject                         Score    Max    %    Grade',
    '--------------------------------------------------------------',
    ...input.lines.map(
      (line) =>
        `${line.subject.padEnd(28).slice(0, 28)} ${line.score.padStart(6)} ${line.max.padStart(6)} ${line.percent.padStart(6)} ${line.grade.padStart(6)}`,
    ),
    '--------------------------------------------------------------',
    `Average: ${input.averagePercent}%`,
    '',
    'Grading: A 80+  B 70-79  C 60-69  D 50-59  F below 50',
  ];

  const startY = 780;
  const leading = 16;
  const contentLines = rows
    .map((row, index) => {
      const y = startY - index * leading;
      return `BT /F1 11 Tf 48 ${String(y)} Td (${pdfEscape(row)}) Tj ET`;
    })
    .join('\n');

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${String(Buffer.byteLength(contentLines, 'utf8'))} >> stream\n${contentLines}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ];

  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += `${obj}\n`;
  }
  const xrefStart = Buffer.byteLength(body, 'utf8');
  body += `xref\n0 ${String(objects.length + 1)}\n`;
  body += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer << /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xrefStart)}\n%%EOF\n`;
  return Buffer.from(body, 'utf8');
}
