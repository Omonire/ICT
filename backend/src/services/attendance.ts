import PDFDocument from 'pdfkit';
import { AppDataSource } from '../config/data-source';
import { CandidateAssignment } from '../entities/CandidateAssignment';
import { Candidate } from '../entities/Candidate';
import { Hall } from '../entities/Hall';
import { Session } from '../entities/Session';
import { CareerGroup } from '../entities/CareerGroup';
import { AppError } from '../utils/errors';
import { hallCode } from './scheduler';

export interface AttendanceSheetRow {
  index: number;
  candidateId: string;
  name: string;
  careerGroup: string;
  seatNumber: string;
}

export interface AttendanceSheetData {
  session: Session;
  hall: Hall;
  rows: AttendanceSheetRow[];
  total: number;
  generatedAt: string;
}

export async function buildAttendanceSheet(
  sessionId: string,
  hallId: string
): Promise<AttendanceSheetData> {
  const ds = AppDataSource;
  const session = await ds.getRepository(Session).findOne({ where: { id: sessionId } });
  if (!session) throw AppError.notFound('Session not found');

  const hall = await ds.getRepository(Hall).findOne({ where: { id: hallId } });
  if (!hall) throw AppError.notFound('Hall not found');

  const assignments = await ds.getRepository(CandidateAssignment).find({
    where: { sessionId, hallId },
    order: { seatNumber: 'ASC' },
  });

  const candidateIds = assignments.map((a) => a.candidateId);
  let candidates: Candidate[] = [];
  if (candidateIds.length > 0) {
    candidates = await ds.getRepository(Candidate).find({
      where: candidateIds.map((id) => ({ id })),
      relations: { careerGroup: true },
    });
  }
  const candidateById = new Map(candidates.map((c) => [c.id, c]));

  const rows: AttendanceSheetRow[] = assignments.map((a, index) => {
    const c = candidateById.get(a.candidateId);
    return {
      index: index + 1,
      candidateId: a.candidateId,
      name: c?.name ?? '(candidate removed)',
      careerGroup: (c?.careerGroup as CareerGroup | undefined)?.name ?? '—',
      seatNumber: a.seatNumber,
    };
  });

  return {
    session,
    hall,
    rows,
    total: rows.length,
    generatedAt: new Date().toISOString(),
  };
}

export function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function buildSheetHtml(sheet: AttendanceSheetData): string {
  const rowsHtml = sheet.rows
    .map(
      (r) => `<tr>
      <td class="c">${r.index}</td>
      <td class="mono">${r.seatNumber}</td>
      <td class="mono">${r.candidateId}</td>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.careerGroup)}</td>
      <td class="c sign"></td>
    </tr>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Attendance Sheet — ${escapeHtml(sheet.hall.name)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; color: #0f172a; margin: 40px; font-size: 13px; }
  .mono { font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #5B2C6F; padding-bottom: 16px; margin-bottom: 20px; }
  .brand h1 { margin: 0; font-size: 20px; letter-spacing: 0.02em; color: #0f172a; }
  .brand p { margin: 2px 0 0; color: #64748b; font-size: 12px; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .meta div { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
  .meta .label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  .meta .value { font-weight: 600; margin-top: 2px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0f172a; color: #fff; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; padding: 8px 10px; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
  .c { text-align: center; }
  .sign { height: 26px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .summary { display: flex; justify-content: space-between; margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  .signature { width: 200px; }
  .signature .line { border-bottom: 1px solid #94a3b8; height: 36px; }
  .signature p { margin: 6px 0 0; font-size: 11px; color: #475569; text-align: center; }
  .footer { margin-top: 24px; text-align: center; color: #94a3b8; font-size: 11px; }
  @media print {
    body { margin: 16mm; }
    .signature .line { height: 44px; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <h1>Federal University of Technology</h1>
      <p>Examination &amp; Records Unit — CBT Attendance Sheet</p>
    </div>
    <div class="brand" style="text-align:right">
      <h1>${escapeHtml(sheet.hall.name)}</h1>
      <p>Hall code: <span class="mono">${escapeHtml(hallCode(sheet.hall.name))}</span></p>
    </div>
  </div>

  <div class="meta">
    <div><div class="label">Exam Date</div><div class="value">${escapeHtml(formatDate(sheet.session.examDate))}</div></div>
    <div><div class="label">Session</div><div class="value">${escapeHtml(sheet.session.name)}</div></div>
    <div><div class="label">Time</div><div class="value">${escapeHtml(sheet.session.startTime)} – ${escapeHtml(sheet.session.endTime)}</div></div>
    <div><div class="label">Candidates</div><div class="value">${sheet.total} / ${sheet.hall.capacity} seats</div></div>
  </div>

  <table>
    <thead>
      <tr><th style="width:40px" class="c">#</th><th>Seat</th><th>Candidate ID</th><th>Candidate Name</th><th>Programme</th><th style="width:110px">Signature</th></tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="6" class="c">No candidates assigned to this hall for this session.</td></tr>'}
    </tbody>
  </table>

  <div class="summary">
    <div class="signature"><div class="line"></div><p>Invigilator</p></div>
    <div class="signature"><div class="line"></div><p>Chief Invigilator</p></div>
    <div class="signature"><div class="line"></div><p>Exam Officer</p></div>
  </div>
  <div class="footer">ExamFlow • Generated ${escapeHtml(new Date(sheet.generatedAt).toLocaleString())}</div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function buildSheetPdf(sheet: AttendanceSheetData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const drawHeader = () => {
    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(15)
      .text('FEDERAL UNIVERSITY OF TECHNOLOGY', { align: 'center' })
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748b')
      .text('Examination & Records Unit — CBT Attendance Sheet', { align: 'center' })
      .moveDown(0.5);
    doc
      .strokeColor('#5B2C6F')
      .lineWidth(2)
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .stroke();
  };

  const drawMeta = () => {
    const y = doc.y + 14;
    const x = 40;
    const colW = (515 - 12 * 3) / 4;
    const items = [
      ['EXAM DATE', formatDate(sheet.session.examDate)],
      ['SESSION', sheet.session.name],
      ['TIME', `${sheet.session.startTime} – ${sheet.session.endTime}`],
      ['CANDIDATES', `${sheet.total} / ${sheet.hall.capacity} seats`],
    ];
    items.forEach(([label, value], i) => {
      doc
        .roundedRect(x + i * (colW + 12), y, colW, 46, 6)
        .fill('#f8fafc');
      doc
        .fillColor('#5B2C6F')
        .font('Helvetica-Bold')
        .fontSize(7)
        .text(label, x + i * (colW + 12) + 8, y + 8, { width: colW - 16 })
        .fillColor('#0f172a')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(value, x + i * (colW + 12) + 8, y + 20, { width: colW - 16 });
    });
    doc.y = y + 46 + 16;
  };

  drawHeader();
  drawMeta();

  const colWidths = { n: 26, seat: 62, id: 78, name: 190, group: 120, sign: 90 };
  const left = 40;
  const tableTop = doc.y;

  doc
    .fillColor('#0f172a')
    .rect(left, tableTop, 515, 20)
    .fill()
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(8);

  const headerLabels = ['#', 'SEAT', 'CANDIDATE ID', 'CANDIDATE NAME', 'PROGRAMME', 'SIGNATURE'];
  let cx = left;
  headerLabels.forEach((label, i) => {
    const widths = [colWidths.n, colWidths.seat, colWidths.id, colWidths.name, colWidths.group, colWidths.sign];
    doc.text(label, cx + 5, tableTop + 6, { width: widths[i] - 6 });
    cx += widths[i];
  });

  let y = tableTop + 24;
  const rowH = 18;

  sheet.rows.forEach((row, index) => {
    if (y > 760) {
      doc.addPage();
      drawHeader();
      y = doc.y;
    }
    if (index % 2 === 0) {
      doc.fillColor('#f8fafc').rect(left, y, 515, rowH).fill();
    }
    doc
      .fillColor('#0f172a')
      .font('Helvetica')
      .fontSize(8)
      .text(String(row.index), left + 5, y + 5, { width: colWidths.n - 6 })
      .font('Helvetica-Bold')
      .text(row.seatNumber, left + colWidths.n + 5, y + 5, { width: colWidths.seat - 6 })
      .font('Helvetica')
      .text(row.candidateId, left + colWidths.n + colWidths.seat + 5, y + 5, { width: colWidths.id - 6 })
      .text(truncate(row.name, 32), left + colWidths.n + colWidths.seat + colWidths.id + 5, y + 5, { width: colWidths.name - 6 })
      .text(truncate(row.careerGroup, 22), left + colWidths.n + colWidths.seat + colWidths.id + colWidths.name + 5, y + 5, { width: colWidths.group - 6 });
    doc
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .moveTo(left, y + rowH)
      .lineTo(left + 515, y + rowH)
      .stroke();
    y += rowH;
  });

  if (sheet.rows.length === 0) {
    doc
      .fillColor('#64748b')
      .font('Helvetica')
      .fontSize(9)
      .text('No candidates assigned to this hall for this session.', left + 5, y + 6);
    y += 22;
  }

  doc.y = Math.min(y + 24, 740);
  const sigY = doc.y;
  const sigW = 140;
  const sigX = [40, 40 + (140 + 18), 40 + 2 * (140 + 18), 40 + 3 * (140 + 18)];
  const sigLabels = ['INVIGILATOR', 'CHIEF INVIGILATOR', 'EXAM OFFICER'];
  sigLabels.forEach((label, i) => {
    doc
      .strokeColor('#94a3b8')
      .lineWidth(0.8)
      .moveTo(sigX[i], sigY)
      .lineTo(sigX[i] + sigW, sigY)
      .stroke();
    doc
      .fillColor('#475569')
      .font('Helvetica')
      .fontSize(8)
      .text(label, sigX[i] + sigW / 2 - doc.widthOfString(label) / 2, sigY + 6, {
        width: sigW,
        align: 'center',
      });
  });

  doc
    .fillColor('#94a3b8')
    .font('Helvetica')
    .fontSize(7)
    .text(
      `ExamFlow • Generated ${new Date(sheet.generatedAt).toLocaleString()} • ${sheet.hall.name} • ${sheet.session.name} • ${sheet.session.examDate}`,
      40,
      790,
      { align: 'center', width: 515 }
    );

  doc.end();
  return new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
