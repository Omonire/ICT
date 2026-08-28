import bcrypt from 'bcryptjs';
import * as path from 'path';
import { AppDataSource, initDatabase } from '../config/data-source';
import { User, UserRole } from '../entities/User';
import { CareerGroup } from '../entities/CareerGroup';
import { Hall } from '../entities/Hall';
import { Seat } from '../entities/Seat';
import { Session } from '../entities/Session';
import { Candidate } from '../entities/Candidate';
import { SchedulingConfig, DEFAULT_SCHEDULING_RULES } from '../entities/SchedulingConfig';
import { genUuid, nextCandidateId } from '../utils/ids';
import { seatLabel } from './scheduler';
import { logActivity } from './activity-log';
import { parseExcelCandidates, generateExcelCandidates } from './excel-import';

const CAREER_GROUPS: Array<{
  name: string;
  description: string;
  subjects: string[];
  firstChoice?: string;
}> = [
  { name: 'Management Sciences', description: 'Business, Accounting & Finance programmes', subjects: ['Financial Accounting', 'Business Law', 'Management Principles', 'Quantitative Methods'], firstChoice: 'Business Administration' },
  { name: 'Engineering', description: 'Civil, Mechanical & Electrical engineering programmes', subjects: ['Engineering Mathematics', 'Thermodynamics', 'Circuit Theory', 'Fluid Mechanics'], firstChoice: 'Computer Engineering' },
  { name: 'Arts & Humanities', description: 'Languages, History & Liberal arts programmes', subjects: ['Literary Appreciation', 'African History', 'Philosophy of Science', 'French'], firstChoice: 'B.A. Mass Communication' },
  { name: 'Natural Sciences', description: 'Physics, Chemistry, Biology & Computer Science', subjects: ['General Physics', 'Organic Chemistry', 'Cell Biology', 'Programming Concepts'], firstChoice: 'Physics' },
  { name: 'Social Sciences', description: 'Economics, Political Science & Sociology programmes', subjects: ['Microeconomics', 'Comparative Politics', 'Research Methods', 'Statistics'], firstChoice: 'Economics' },
];

const HALLS = [
  { name: 'Hall A', capacity: 120 },
  { name: 'Hall B', capacity: 120 },
  { name: 'Hall C', capacity: 100 },
  { name: 'Hall D', capacity: 100 },
  { name: 'Hall E', capacity: 80 },
];

function nextMonday(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day; // next Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function buildSessions(): Array<{ name: string; examDate: string; startTime: string; endTime: string }> {
  const start = nextMonday();
  const days = [0, 1, 2, 3, 4, 6]; // Mon–Fri + next Mon
  const slots = [
    { name: 'Morning', startTime: '09:00', endTime: '11:00' },
    { name: 'Afternoon', startTime: '13:00', endTime: '15:00' },
  ];
  const sessions: Array<{ name: string; examDate: string; startTime: string; endTime: string }> = [];
  for (const dayOffset of days) {
    const d = new Date(start);
    d.setDate(d.getDate() + dayOffset);
    const examDate = d.toISOString().slice(0, 10);
    for (const slot of slots) {
      sessions.push({ name: slot.name, examDate, startTime: slot.startTime, endTime: slot.endTime });
    }
  }
  return sessions;
}

async function isSeeded(ds: typeof AppDataSource): Promise<boolean> {
  const count = await ds.getRepository(Candidate).count();
  return count > 0;
}

export async function runSeed(): Promise<{ candidateCount: number; message: string }> {
  if (!AppDataSource.isInitialized) await initDatabase();
  const ds = AppDataSource;
  const started = Date.now();

  // Ensure a superadmin always exists even if the DB is already seeded.
  const userRepo = ds.getRepository(User);
  const existingSuperadmin = await userRepo.findOne({ where: { role: UserRole.SUPERADMIN } });
  if (!existingSuperadmin) {
    const sa = userRepo.create({
      id: genUuid(),
      email: 'superadmin@examflow.edu.ng',
      password: await bcrypt.hash('SuperAdmin123!', 10),
      role: UserRole.SUPERADMIN,
      name: 'Super Administrator',
    });
    await userRepo.save(sa);
  }

  if (await isSeeded(ds)) {
    return {
      candidateCount: await ds.getRepository(Candidate).count(),
      message: 'Database already contains data — skipping seed.',
    };
  }

  let admin = await userRepo.findOne({ where: { email: 'admin@examflow.edu.ng' } });
  if (!admin) {
    admin = userRepo.create({
      id: genUuid(),
      email: 'admin@examflow.edu.ng',
      password: await bcrypt.hash('Admin123!', 10),
      role: UserRole.ADMIN,
      name: 'System Administrator',
    });
    await userRepo.save(admin);
  }
  let operator = await userRepo.findOne({ where: { email: 'operator@examflow.edu.ng' } });
  if (!operator) {
    operator = userRepo.create({
      id: genUuid(),
      email: 'operator@examflow.edu.ng',
      password: await bcrypt.hash('Operator123!', 10),
      role: UserRole.OPERATOR,
      name: 'Operations Team',
    });
    await userRepo.save(operator);
  }

  const BATCH = 500;

  const groupRepo = ds.getRepository(CareerGroup);
  let groups = await groupRepo.find();
  if (groups.length === 0) {
    groups = await groupRepo.save(
      CAREER_GROUPS.map((g) =>
        groupRepo.create({ id: genUuid(), name: g.name, description: g.description, subjects: g.subjects })
      )
    );
  }

  const hallRepo = ds.getRepository(Hall);
  const seatRepo = ds.getRepository(Seat);
  let halls = await hallRepo.find();
  if (halls.length === 0) {
    halls = await hallRepo.save(
      HALLS.map((h) => hallRepo.create({ id: genUuid(), ...h }))
    );
    const seatRows: Seat[] = [];
    for (const hall of halls) {
      for (let n = 1; n <= hall.capacity; n++) {
        seatRows.push(
          seatRepo.create({
            id: genUuid(),
            hallId: hall.id,
            seatNumber: seatLabel(hall.name, n),
            status: 'available',
          })
        );
      }
    }
    for (let i = 0; i < seatRows.length; i += BATCH) {
      await seatRepo.save(seatRows.slice(i, i + BATCH));
    }
  }

  const sessionRepo = ds.getRepository(Session);
  let sessions = await sessionRepo.find();
  if (sessions.length === 0) {
    sessions = await sessionRepo.save(
      buildSessions().map((s) => sessionRepo.create({ id: genUuid(), ...s }))
    );
  }

  // Seed default scheduling config if none exists
  const configRepo = ds.getRepository(SchedulingConfig);
  const existingConfig = await configRepo.findOne({ where: { name: 'Default Configuration' } });
  if (!existingConfig) {
    await configRepo.save(
      configRepo.create({
        id: genUuid(),
        name: 'Default Configuration',
        description: 'Default scheduling rules for ExamFlow',
        rules: DEFAULT_SCHEDULING_RULES,
        isActive: true,
      })
    );
  }

  const candidateRepo = ds.getRepository(Candidate);
  
  // Load candidates from Excel file (try multiple paths)
  let candidates: Candidate[] = [];
  try {
    // Try to find Excel file in these locations (in order):
    // 1. public/ (Vercel deployment)
    // 2. backend/data/ (local development)
    const excelFileName = 'Exam_Schedulling_4_Python_1.xls';
    const possiblePaths = [
      path.join(__dirname, '../../public', excelFileName), // Vercel
      path.join(__dirname, '../../data', excelFileName),   // Local dev
      path.join(__dirname, '../../../public', excelFileName), // Alternative Vercel path
      path.join(__dirname, '../../../data', excelFileName),   // Alternative local path
    ];
    
    let excelFilePath: string | null = null;
    const fs = await import('fs');
    for (const candidatePath of possiblePaths) {
      try {
        if (fs.existsSync(candidatePath)) {
          excelFilePath = candidatePath;
          break;
        }
      } catch {
        continue;
      }
    }
    
    if (!excelFilePath) {
      throw new Error(`Excel file not found in any expected location: ${possiblePaths.join(', ')}`);
    }
    
    console.log(`✓ Found Excel file at: ${excelFilePath}`);
    const excelRows = parseExcelCandidates(excelFilePath);
    const candidateData = generateExcelCandidates(excelRows, groups);
    let id = nextCandidateId([]);
    
    candidates = candidateData.map((data) => {
      const candidate = candidateRepo.create({
        id,
        ...data,
      });
      id = nextCandidateId([id]);
      return candidate;
    });
    
    const total = candidates.length;
    console.log(`✓ Loaded ${total} candidates from Excel file (PRIORITY DATA SOURCE)`);
  } catch (err) {
    throw new Error(
      `Seed requires the real Excel candidate source. No candidate data was generated: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  
  for (let i = 0; i < candidates.length; i += BATCH) {
    await candidateRepo.save(candidates.slice(i, i + BATCH));
    console.log(`  → saved ${Math.min(i + BATCH, candidates.length)}/${candidates.length} candidates`);
  }
  await groupRepo.save(
    groups.map((g) => {
      g.candidateCount = candidates.filter((c) => c.careerGroupId === g.id).length;
      return g;
    })
  );

  await logActivity({
    action: 'seeded',
    userId: admin.id,
    entityType: 'system',
    details: { candidates: candidates.length, halls: halls.length, sessions: sessions.length, ms: Date.now() - started },
  });

  return {
    candidateCount: candidates.length,
    message: `Imported ${candidates.length} candidates in ${Date.now() - started}ms. Candidates remain unscheduled until a schedule is generated.`,
  };
}

// Allows `tsx src/services/seeding.ts` to run the seed standalone.
if (require.main === module) {
  runSeed()
    .then((r) => {
      console.log(r.message);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[seed] failed', err);
      process.exit(1);
    });
}
