import PDFDocument from 'pdfkit';
import { AppDataSource } from '../config/data-source';
import { SchedulingRun } from '../entities/SchedulingRun';
import { CandidateAssignment } from '../entities/CandidateAssignment';
import { Session } from '../entities/Session';
import { Hall } from '../entities/Hall';
import { Candidate } from '../entities/Candidate';
import { ScheduleConflict, ConflictStatus } from '../entities/ScheduleConflict';

interface SessionSummary {
  session: { id: string; name: string; examDate: string; startTime: string; endTime: string };
  hallSummaries: Array<{
    hall: { id: string; name: string; capacity: number };
    assigned: number;
    utilization: number;
  }>;
  totalAssigned: number;
  totalCapacity: number;
  utilization: number;
}

export async function generateScheduleReport(runId: string): Promise<Buffer> {
  const ds = AppDataSource;

  const run = await ds.getRepository(SchedulingRun).findOne({ where: { id: runId } });
  if (!run) throw new Error('Scheduling run not found');

  const sessions = await ds.getRepository(Session).find({ order: { examDate: 'ASC', startTime: 'ASC' } });
  const halls = await ds.getRepository(Hall).find();

  // Get assignments grouped by session+hall
  const assignments = await ds.getRepository(CandidateAssignment)
    .createQueryBuilder('a')
    .innerJoinAndSelect('a.session', 's')
    .innerJoinAndSelect('a.hall', 'h')
    .orderBy('s.examDate', 'ASC')
    .addOrderBy('s.startTime', 'ASC')
    .addOrderBy('h.name', 'ASC')
    .getMany();

  // Get conflict count
  const openConflictCount = await ds.getRepository(ScheduleConflict).count({
    where: { schedulingRunId: runId, status: ConflictStatus.OPEN },
  });

  // Build session summaries
  const sessionMap = new Map<string, SessionSummary>();
  for (const session of sessions) {
    sessionMap.set(session.id, {
      session: {
        id: session.id,
        name: session.name,
        examDate: session.examDate,
        startTime: session.startTime,
        endTime: session.endTime,
      },
      hallSummaries: [],
      totalAssigned: 0,
      totalCapacity: 0,
      utilization: 0,
    });
  }

  // Aggregate assignments
  const hallAssignmentCounts = new Map<string, Map<string, number>>();
  for (const a of assignments) {
    if (!sessionMap.has(a.sessionId)) continue;
    let hallMap = hallAssignmentCounts.get(a.sessionId);
    if (!hallMap) {
      hallMap = new Map();
      hallAssignmentCounts.set(a.sessionId, hallMap);
    }
    hallMap.set(a.hallId, (hallMap.get(a.hallId) ?? 0) + 1);
  }

  const hallById = new Map(halls.map((h) => [h.id, h]));
  for (const [sessionId, summary] of sessionMap) {
    const hallCounts = hallAssignmentCounts.get(sessionId);
    let totalAssigned = 0;
    let totalCapacity = 0;

    for (const hall of halls) {
      const assigned = hallCounts?.get(hall.id) ?? 0;
      const cap = hall.capacity;
      totalAssigned += assigned;
      totalCapacity += cap;
      summary.hallSummaries.push({
        hall: { id: hall.id, name: hall.name, capacity: cap },
        assigned,
        utilization: cap > 0 ? Math.round((assigned / cap) * 100) : 0,
      });
    }

    summary.totalAssigned = totalAssigned;
    summary.totalCapacity = totalCapacity;
    summary.utilization = totalCapacity > 0 ? Math.round((totalAssigned / totalCapacity) * 100) : 0;
  }

  // Generate PDF
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40,
      bufferPages: true,
      info: {
        Title: `ExamFlow Schedule Report — ${run.subjectCombination}`,
        Author: 'ExamFlow',
        Subject: 'Schedule Report',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc.fontSize(20).font('Helvetica-Bold').text('ExamFlow Schedule Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text(`Subject Combination: ${run.subjectCombination}`, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1);

    // Summary stats
    doc.fontSize(14).font('Helvetica-Bold').text('Summary Statistics');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica');

    const summaryData = [
      `Total Candidates: ${run.candidateCount}`,
      `Scheduled: ${run.scheduledCount}`,
      `Overflow: ${run.overflowCount}`,
      `Open Conflicts: ${openConflictCount}`,
      `Status: ${run.status}`,
      `Sessions Used: ${run.sessionIds?.length ?? sessions.length}`,
    ];

    for (const line of summaryData) {
      doc.text(line, { indent: 20 });
    }
    doc.moveDown(1);

    // Sessions table
    doc.fontSize(14).font('Helvetica-Bold').text('Session Details');
    doc.moveDown(0.3);

    // Table header
    const tableTop = doc.y;
    const colWidths = [120, 90, 80, 80, 80, 100, 80, 80];
    const headers = ['Session', 'Date', 'Start', 'End', 'Hall', 'Assigned', 'Capacity', 'Utilization'];

    let y = tableTop;
    doc.fontSize(9).font('Helvetica-Bold');
    let x = 40;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x, y, { width: colWidths[i], align: 'left' });
      x += colWidths[i];
    }
    y += 15;

    // Draw header line
    doc.moveTo(40, y).lineTo(40 + colWidths.reduce((a, b) => a + b), y).stroke();
    y += 5;

    // Table rows
    doc.font('Helvetica').fontSize(9);
    const sortedSessions = [...sessionMap.values()].sort(
      (a, b) =>
        a.session.examDate.localeCompare(b.session.examDate) ||
        a.session.startTime.localeCompare(b.session.startTime)
    );

    for (const summary of sortedSessions) {
      if (y > 520) {
        doc.addPage();
        y = 40;
      }

      let x = 40;
      const row = [
        summary.session.name,
        summary.session.examDate,
        summary.session.startTime,
        summary.session.endTime,
        '',
        String(summary.totalAssigned),
        String(summary.totalCapacity),
        `${summary.utilization}%`,
      ];

      for (let i = 0; i < row.length; i++) {
        doc.text(row[i], x, y, { width: colWidths[i], align: 'left' });
        x += colWidths[i];
      }
      y += 13;

      // Hall sub-rows
      for (const hs of summary.hallSummaries) {
        if (hs.assigned > 0 || hs.hall.capacity > 0) {
          x = 40 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
          const hallRow = [
            `  ${hs.hall.name}`,
            String(hs.assigned),
            String(hs.hall.capacity),
            `${hs.utilization}%`,
          ];
          doc.fontSize(8).font('Helvetica');
          for (let i = 0; i < hallRow.length; i++) {
            doc.text(hallRow[i], x, y, { width: colWidths[4 + i], align: 'left' });
            x += colWidths[4 + i];
          }
          y += 11;
        }
      }

      y += 3;
    }

    doc.end();
  });
}

export async function generateAttendanceSheet(sessionId: string, hallId: string): Promise<Buffer> {
  const ds = AppDataSource;

  const session = await ds.getRepository(Session).findOne({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');

  const hall = await ds.getRepository(Hall).findOne({ where: { id: hallId } });
  if (!hall) throw new Error('Hall not found');

  const assignments = await ds.getRepository(CandidateAssignment)
    .createQueryBuilder('a')
    .innerJoinAndSelect('a.candidate', 'c')
    .where('a.sessionId = :sessionId AND a.hallId = :hallId', { sessionId, hallId })
    .orderBy('a.seatNumber', 'ASC')
    .getMany();

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
      info: {
        Title: `Attendance Sheet — ${hall.name} — ${session.examDate}`,
        Author: 'ExamFlow',
        Subject: 'Attendance Sheet',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('Attendance Sheet', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica');

    doc.text(`Session: ${session.name}`, { align: 'center' });
    doc.text(`Date: ${session.examDate}  |  Time: ${session.startTime} – ${session.endTime}`, { align: 'center' });
    doc.text(`Hall: ${hall.name}  |  Capacity: ${hall.capacity}`, { align: 'center' });
    doc.text(`Total Candidates: ${assignments.length}`, { align: 'center' });
    doc.moveDown(0.5);

    // Table header
    const tableTop = doc.y;
    const colWidths = [50, 130, 100, 100, 80, 140];
    const headers = ['#', 'Seat No.', 'Candidate Name', 'Email', 'Status', 'Signature'];

    let y = tableTop;
    doc.fontSize(10).font('Helvetica-Bold');
    let x = 40;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x, y, { width: colWidths[i], align: 'left' });
      x += colWidths[i];
    }
    y += 15;
    doc.moveTo(40, y).lineTo(40 + colWidths.reduce((a, b) => a + b), y).stroke();
    y += 5;

    // Candidate rows
    doc.font('Helvetica').fontSize(9);
    for (let i = 0; i < assignments.length; i++) {
      if (y > 720) {
        // Add signature footer before new page
        addSignatureFooter(doc);
        doc.addPage();
        y = 40;

        // Repeat table header
        doc.fontSize(10).font('Helvetica-Bold');
        let hx = 40;
        for (let j = 0; j < headers.length; j++) {
          doc.text(headers[j], hx, y, { width: colWidths[j], align: 'left' });
          hx += colWidths[j];
        }
        y += 15;
        doc.moveTo(40, y).lineTo(40 + colWidths.reduce((a, b) => a + b), y).stroke();
        y += 5;
        doc.font('Helvetica').fontSize(9);
      }

      const a = assignments[i];
      const candidate = a.candidate;
      x = 40;
      const row = [
        String(i + 1),
        a.seatNumber,
        candidate?.name ?? 'Unknown',
        candidate?.email ?? '',
        'Absent',
        '',
      ];

      // Alternate row background
      if (i % 2 === 0) {
        doc.save();
        doc.rect(40, y - 2, colWidths.reduce((a, b) => a + b), 15).fill('#f5f5f5');
        doc.restore();
      }

      for (let j = 0; j < row.length; j++) {
        doc.text(row[j], x, y, { width: colWidths[j], align: 'left' });
        x += colWidths[j];
      }
      y += 15;
    }

    // Footer
    addSignatureFooter(doc);

    doc.end();
  });
}

function addSignatureFooter(doc: PDFKit.PDFDocument): void {
  doc.fontSize(10).font('Helvetica');
  doc.moveDown(2);
  doc.text('____________________________                    ____________________________');
  doc.text('Invigilator Signature                              Date');
}
