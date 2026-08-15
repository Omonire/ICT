import { parse } from 'csv-parse/sync';
import { AppDataSource } from '../config/data-source';
import { CareerGroup } from '../entities/CareerGroup';
import { Candidate } from '../entities/Candidate';
import { AppError } from '../utils/errors';
import { genUuid, nextCandidateId } from '../utils/ids';
import { importCandidateRow } from '../schemas';

export const REQUIRED_COLUMNS = ['name', 'email', 'careerGroup'] as const;

export interface ImportRow {
  name: string;
  email: string;
  matricNo: string | null;
  careerGroup: string;
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

export function parseCandidateCsv(
  buffer: Buffer,
  fileName: string
): ImportPreviewResult {
  let rawRows: Record<string, string>[];
  try {
    rawRows = parse(buffer, {
      columns: (header: string[]) =>
        header.map((h) => normalizeHeader(h)),
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as Record<string, string>[];
  } catch (err) {
    throw AppError.badRequest(
      'The uploaded file could not be parsed as CSV. Save it as a .csv file and try again.'
    );
  }

  if (rawRows.length === 0) {
    throw AppError.badRequest('The CSV file contains no data rows.');
  }

  const columns = Object.keys(rawRows[0]);
  const missingColumns = REQUIRED_COLUMNS.filter((col) => !columns.includes(col));

  if (missingColumns.length > 0) {
    throw AppError.badRequest(
      `Required column(s) missing: ${missingColumns.join(', ')}. Your CSV needs: ${REQUIRED_COLUMNS.join(', ')}`,
      { missingColumns, columns }
    );
  }

  const errors: ImportErrorRow[] = [];
  const valid: ImportRow[] = [];
  const seenEmails = new Set<string>();
  const duplicates: string[] = [];

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2; // +1 for header
    const parsed = importCandidateRow.safeParse({
      name: raw.name,
      email: (raw.email ?? '').toLowerCase().trim(),
      matricNo: raw.matricNo || raw.matric || raw.regNo || null,
      careerGroup: raw.careerGroup,
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
    });
    imported.push(candidate);
    existingEmails.add(row.email);
    nextId = nextCandidateId([nextId]);
    group.candidateCount += 1;
  }

  await candidateRepo.save(imported);
  await groupRepo.save(groups);
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
