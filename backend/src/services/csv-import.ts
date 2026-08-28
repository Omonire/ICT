import * as XLSX from 'xlsx';
import { AppDataSource } from '../config/data-source';
import { CareerGroup } from '../entities/CareerGroup';
import { Candidate } from '../entities/Candidate';
import { AppError } from '../utils/errors';
import { genUuid, nextCandidateId } from '../utils/ids';
import { importCandidateRow } from '../schemas';
import { mapProgramToCareerGroup } from './excel-import';

/** Sanitize a name segment for use in an email address: remove non-alphanumeric chars */
function sanitizeForEmail(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40) || 'x';
}

const REQUIRED_COLUMNS = ['name', 'email', 'careerGroup'] as const;

export interface ImportRow {
  name: string;
  email: string;
  matricNo: string | null;
  careerGroup: string;
  jambSubjects: string[] | null;
  firstChoice: string | null;
}

export interface ImportErrorRow {
  row: number;
  field?: string;
  message: string;
  raw: Record<string, string>;
}

export interface ImportPreviewResult {
  importId: string;
  fileName: string;
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  errorCount: number;
  errors: ImportErrorRow[];
  duplicates: string[];
  preview: Array<ImportRow & { id: string }>;
  columns: string[];
  missingColumns: string[];
}

interface StoredImport {
  fileName: string;
  rows: ImportRow[];
  createdAt: number;
}

const pendingImports = new Map<string, StoredImport>();

const IMPORT_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Parse XLSX file and extract candidate data
 * Supports both standard format (name, email, careerGroup, matricNo)
 * and exam format (First Name, Last Name, First Choice program, Exam No)
 */
export function parseCandidateCsv(
  buffer: Buffer,
  fileName: string
): ImportPreviewResult {
  let rawRows: Record<string, any>[];
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
  } catch (err) {
    throw AppError.badRequest(
      'The uploaded file could not be parsed as Excel. Ensure it is a valid .xlsx file.'
    );
  }

  if (rawRows.length === 0) {
    throw AppError.badRequest('The Excel file contains no data rows.');
  }

  const columns = Object.keys(rawRows[0]);
  
  // Check if it's exam format or standard format
  const isExamFormat = columns.some(col => col.includes('First Name') || col.includes('Last Name') || col.includes('Exam No'));
  
  const missingColumns = REQUIRED_COLUMNS.filter((col) => !columns.includes(col) && !isExamFormat);

  if (missingColumns.length > 0 && !isExamFormat) {
    throw AppError.badRequest(
      `Required column(s) missing: ${missingColumns.join(', ')}. Your file needs: ${REQUIRED_COLUMNS.join(', ')} OR the exam format columns.`,
      { missingColumns, columns }
    );
  }

  const errors: ImportErrorRow[] = [];
  const valid: ImportRow[] = [];
  const seenEmails = new Set<string>();
  const duplicates: string[] = [];

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2; // +1 for header
    
    // Handle exam format
    let processedRow: any = raw;
    if (isExamFormat && raw['First Name'] && raw['Last Name']) {
      const firstName = String(raw['First Name']).trim();
      const lastName = String(raw['Last Name']).trim();
      const examNo = raw['Exam No'] ? String(raw['Exam No']).padStart(8, '0') : '';
      const program = raw['First Choice'] || '';
      
      const jambSubjects = [
        raw['Jamb Subject1'],
        raw['Jamb Subject2'],
        raw['Jamb Subject3'],
        raw['Jamb Subject4'],
      ].filter(Boolean).map((s: string) => String(s).trim().toLowerCase());

      processedRow = {
        name: `${firstName} ${lastName}`,
        email: `${sanitizeForEmail(firstName)}.${sanitizeForEmail(lastName)}.${examNo}@student.fut.edu.ng`,
        matricNo: examNo ? `FUT/2024/${examNo}` : null,
        careerGroup: mapProgramToCareerGroup(program),
        jambSubjects: jambSubjects.length > 0 ? jambSubjects : null,
        firstChoice: raw['First Choice']?.trim() || null,
      };
    }
    
    const parsed = importCandidateRow.safeParse({
      name: processedRow.name || raw.name,
      email: ((processedRow.email || raw.email) ?? '').toLowerCase().trim(),
      matricNo: processedRow.matricNo || raw.matricNo || raw.matric || raw.regNo || null,
      careerGroup: processedRow.careerGroup || raw.careerGroup,
      jambSubjects: processedRow.jambSubjects || null,
      firstChoice: processedRow.firstChoice || null,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({
          row: rowNumber,
          field: issue.path[0] as string,
          message: issue.message,
          raw,
        });
      }
      return;
    }

    const email = parsed.data.email;
    if (seenEmails.has(email)) {
      duplicates.push(email);
      errors.push({
        row: rowNumber,
        field: 'email',
        message: 'Duplicate email within the file',
        raw,
      });
      return;
    }
    seenEmails.add(email);
    valid.push({
      name: parsed.data.name,
      email,
      matricNo: parsed.data.matricNo ?? null,
      careerGroup: parsed.data.careerGroup,
      jambSubjects: parsed.data.jambSubjects ?? null,
      firstChoice: parsed.data.firstChoice ?? null,
    });
  });

  const importId = genUuid();
  pendingImports.set(importId, {
    fileName,
    rows: valid,
    createdAt: Date.now(),
  });

  return {
    importId,
    fileName,
    totalRows: rawRows.length,
    validCount: valid.length,
    duplicateCount: duplicates.length,
    errorCount: errors.length,
    errors,
    duplicates,
    preview: valid.slice(0, 10).map((row, i) => ({ ...row, id: `CAN-${String(i + 1).padStart(5, '0')}` })),
    columns,
    missingColumns: [],
  };
}

export function getPendingImport(importId: string): StoredImport | null {
  const entry = pendingImports.get(importId);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > IMPORT_TTL_MS) {
    pendingImports.delete(importId);
    return null;
  }
  return entry;
}

export interface ImportCommitResult {
  imported: number;
  skipped: number;
  errors: Array<{ email: string; reason: string }>;
  startedAt: string;
  finishedAt: string;
}

export async function commitImport(importId: string): Promise<ImportCommitResult> {
  const entry = getPendingImport(importId);
  if (!entry) {
    throw AppError.notFound('Import preview has expired. Upload the file again.');
  }

  const ds = AppDataSource;
  const candidateRepo = ds.getRepository(Candidate);
  const groupRepo = ds.getRepository(CareerGroup);

  const groups = await groupRepo.find();
  const groupByName = new Map(groups.map((g) => [g.name.toLowerCase(), g]));

  const existing = await candidateRepo.find({ select: ['id', 'email'] });
  const existingEmails = new Set(existing.map((c) => c.email.toLowerCase()));

  let nextId = nextCandidateId(existing.map((c) => c.id));

  const imported: Candidate[] = [];
  const errors: Array<{ email: string; reason: string }> = [];
  const modifiedGroups = new Set<string>();

  for (const row of entry.rows) {
    if (existingEmails.has(row.email)) {
      errors.push({ email: row.email, reason: 'Already registered' });
      continue;
    }
    const group = groupByName.get(row.careerGroup.toLowerCase());
    if (!group) {
      errors.push({ email: row.email, reason: `Unknown career group: ${row.careerGroup}` });
      continue;
    }

    const candidate = candidateRepo.create({
      id: nextId,
      name: row.name,
      email: row.email,
      matricNo: row.matricNo,
      careerGroupId: group.id,
      status: 'unscheduled',
      jambSubjects: row.jambSubjects || null,
      firstChoice: row.firstChoice || null,
    });
    imported.push(candidate);
    existingEmails.add(row.email);
    nextId = nextCandidateId([nextId]);
    group.candidateCount += 1;
    modifiedGroups.add(group.id);
  }

  // Insert in chunks of 500 to avoid timeouts on large imports
  const CHUNK = 500;
  for (let i = 0; i < imported.length; i += CHUNK) {
    await candidateRepo.save(imported.slice(i, i + CHUNK));
  }

  // Only save the career groups that were actually modified
  const groupsToSave = groups.filter((g) => modifiedGroups.has(g.id));
  if (groupsToSave.length > 0) {
    await groupRepo.save(groupsToSave);
  }

  pendingImports.delete(importId);

  return {
    imported: imported.length,
    skipped: errors.length,
    errors,
    startedAt: new Date(entry.createdAt).toISOString(),
    finishedAt: new Date().toISOString(),
  };
}

function normalizeHeader(header: string): string {
  return header.replace(/[\uFEFF\s_\-()]/g, '').toLowerCase();
}
