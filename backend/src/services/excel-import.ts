import * as XLSX from 'xlsx';
import { Candidate } from '../entities/Candidate';
import { CareerGroup } from '../entities/CareerGroup';

export interface ExcelCandidateRow {
  'Exam No': number;
  'Last Name': string;
  'First Name': string;
  Gender: string;
  'Jamb Subject1': string;
  'Jamb Subject2': string;
  'Jamb Subject3': string;
  'Jamb Subject4': string;
  'First Choice': string;
  'Second Choice'?: string;
}

// Mapping of program names (from First Choice) to career groups
const PROGRAM_TO_CAREER_GROUP: Record<string, string> = {
  // Engineering Programs
  'Computer Engineering': 'Engineering',
  'BEng. MECHATRONICS': 'Engineering',
  'BENGMEE': 'Engineering',
  'BENGPEE': 'Engineering',
  'Civil Engineering': 'Engineering',
  'Electrical Engineering': 'Engineering',
  'Mechanical Engineering': 'Engineering',
  'Chemical Engineering': 'Engineering',
  'Agricultural Engineering': 'Engineering',

  // Medical/Health Sciences
  'MBBS Medicine & Surgery': 'Natural Sciences',
  'Doctor of Optometry': 'Natural Sciences',
  'Nursing/Nursing Science': 'Natural Sciences',
  'Bachelor of Nursing Sciences': 'Natural Sciences',
  'BSCPH': 'Natural Sciences',
  'MBBSMED': 'Natural Sciences',
  'Pharmacy': 'Natural Sciences',
  'Dentistry': 'Natural Sciences',

  // Social Sciences
  'B.Sc. Ed POLITICAL SCIENCE AND PUBLIC AD': 'Social Sciences',
  'B.A. Mass Communication': 'Social Sciences',
  'BARTISD': 'Social Sciences',
  'Economics': 'Social Sciences',
  'Political Science': 'Social Sciences',
  'Sociology': 'Social Sciences',
  'Anthropology': 'Social Sciences',

  // Management Sciences
  'B.A Ed Adult Education Professional': 'Management Sciences',
  'Business Administration': 'Management Sciences',
  'Accounting': 'Management Sciences',
  'Finance': 'Management Sciences',
  'Marketing': 'Management Sciences',

  // Natural Sciences & Arts
  'Physics': 'Natural Sciences',
  'Chemistry': 'Natural Sciences',
  'Biology': 'Natural Sciences',
  'Mathematics': 'Natural Sciences',
};

/** Sanitize a name segment for use in an email address: remove non-alphanumeric chars */
function sanitizeForEmail(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40) || 'x';
}

export function parseExcelCandidates(filePath: string): ExcelCandidateRow[] {
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<ExcelCandidateRow>(worksheet);
  return data;
}

export function mapProgramToCareerGroup(program: string): string {
  // Exact match first
  if (PROGRAM_TO_CAREER_GROUP[program]) {
    return PROGRAM_TO_CAREER_GROUP[program];
  }

  // Partial match
  const lowerProgram = program.toLowerCase();
  for (const [key, value] of Object.entries(PROGRAM_TO_CAREER_GROUP)) {
    if (lowerProgram.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerProgram)) {
      return value;
    }
  }

  // Default to Natural Sciences if no match found
  return 'Natural Sciences';
}

export function generateExcelCandidates(
  rows: ExcelCandidateRow[],
  careerGroups: CareerGroup[]
): Partial<Candidate>[] {
  const groupMap = new Map(careerGroups.map(g => [g.name, g.id]));

  return rows.map((row, index) => {
    const careerGroupName = mapProgramToCareerGroup(row['First Choice']);
    const careerGroupId = groupMap.get(careerGroupName);

    if (!careerGroupId) {
      console.warn(`Career group not found for: ${careerGroupName}`);
    }

    const firstName = row['First Name'].trim();
    const lastName = row['Last Name'].trim();
    const examNo = String(row['Exam No']).padStart(8, '0');

    const jambSubjects = [
      row['Jamb Subject1'],
      row['Jamb Subject2'],
      row['Jamb Subject3'],
      row['Jamb Subject4'],
    ].filter(Boolean).map((s: string) => String(s).trim());

    return {
      name: `${firstName} ${lastName}`,
      email: `${sanitizeForEmail(firstName)}.${sanitizeForEmail(lastName)}.${examNo}@student.fut.edu.ng`,
      matricNo: `FUT/2024/${examNo}`,
      careerGroupId: careerGroupId || undefined,
      status: 'unscheduled',
      jambSubjects: jambSubjects.length > 0 ? jambSubjects : null,
      firstChoice: row['First Choice']?.trim() || null,
    };
  });
}
