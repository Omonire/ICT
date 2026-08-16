import bcrypt from 'bcryptjs';
import { AppDataSource, initDatabase } from '../config/data-source';
import { User, UserRole } from '../entities/User';
import { CareerGroup } from '../entities/CareerGroup';
import { Hall } from '../entities/Hall';
import { Seat } from '../entities/Seat';
import { Session } from '../entities/Session';
import { Candidate } from '../entities/Candidate';
import { CandidateAssignment } from '../entities/CandidateAssignment';
import { ScheduleMeta, ScheduleState } from '../entities/ScheduleMeta';
import { genUuid, nextCandidateId } from '../utils/ids';
import { seatLabel } from './scheduler';
import { logActivity } from './activity-log';

const CAREER_GROUPS: Array<{
  name: string;
  description: string;
  subjects: string[];
}> = [
  { name: 'Management Sciences', description: 'Business, Accounting & Finance programmes', subjects: ['Financial Accounting', 'Business Law', 'Management Principles', 'Quantitative Methods'] },
  { name: 'Engineering', description: 'Civil, Mechanical & Electrical engineering programmes', subjects: ['Engineering Mathematics', 'Thermodynamics', 'Circuit Theory', 'Fluid Mechanics'] },
  { name: 'Arts & Humanities', description: 'Languages, History & Liberal arts programmes', subjects: ['Literary Appreciation', 'African History', 'Philosophy of Science', 'French'] },
  { name: 'Natural Sciences', description: 'Physics, Chemistry, Biology & Computer Science', subjects: ['General Physics', 'Organic Chemistry', 'Cell Biology', 'Programming Concepts'] },
  { name: 'Social Sciences', description: 'Economics, Political Science & Sociology programmes', subjects: ['Microeconomics', 'Comparative Politics', 'Research Methods', 'Statistics'] },
];

const HALLS = [
  { name: 'Hall A', capacity: 120 },
  { name: 'Hall B', capacity: 120 },
  { name: 'Hall C', capacity: 100 },
  { name: 'Hall D', capacity: 100 },
  { name: 'Hall E', capacity: 80 },
];

const FIRST_NAMES = [
  'Adaeze', 'Babatunde', 'Chioma', 'Damilola', 'Efe', 'Funmilayo', 'Gbenga',
  'Hauwa', 'Ibrahim', 'Jummai', 'Kelechi', 'Lola', 'Musa', 'Ngozi', 'Obinna',
  'Precious', 'Quadri', 'Ruth', 'Sade', 'Tunde', 'Uche', 'Victoria', 'Wale',
  'Yemi', 'Zainab', 'Ayobami', 'Blessing', 'Chinedu', 'Deborah', 'Emeka',
  'Fatima', 'Gloria', 'Hassan', 'Ifeoma', 'Joy', 'Kunle', 'Linda', 'Maryam',
  'Nneka', 'Olamide', 'Peter', 'Queen', 'Richard', 'Sandra', 'Tobi', 'Usman',
  'Veronica', 'Wumi', 'Yusuf', 'Amara',
];

const LAST_NAMES = [
  'Adeyemi', 'Bello', 'Chukwu', 'Dada', 'Eze', 'Fagbemi', 'Garba',
  'Hassan', 'Ibekwe', 'Johnson', 'Kalu', 'Lawal', 'Mensah', 'Nwachukwu',
  'Okafor', 'Ogunleye', 'Popoola', 'Quadri', 'Rabiu', 'Salami', 'Temitope',
  'Umar', 'Vivian', 'Williams', 'Yakubu', 'Zubair', 'Adebayo', 'Bamidele',
  'Chukwuma', 'Dare', 'Ekwere', 'Femi', 'Ganiyu', 'Idowu', 'Jibril',
  'Kayode', 'Lamidi', 'Mohammed', 'Nwosu', 'Olawale', 'Osman', 'Pepple',
  'Raji', 'Sunday', 'Taiwo', 'Ugwu', 'Waziri', 'Yusuf', 'Abubakar', 'Zakari',
];

const EMAIL_DOMAIN = 'student.fut.edu.ng';

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

  const groupRepo = ds.getRepository(CareerGroup);
  const groups = await groupRepo.save(
    CAREER_GROUPS.map((g) =>
      groupRepo.create({ id: genUuid(), ...g })
    )
  );

  const hallRepo = ds.getRepository(Hall);
  const seatRepo = ds.getRepository(Seat);
  const halls = await hallRepo.save(
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
  await seatRepo.save(seatRows);

  const sessionRepo = ds.getRepository(Session);
  const sessions = await sessionRepo.save(
    buildSessions().map((s) => sessionRepo.create({ id: genUuid(), ...s }))
  );

  const candidateRepo = ds.getRepository(Candidate);
  const total = 520;
  const groupSize = Math.ceil(total / groups.length);
  const candidates: Candidate[] = [];
  let id = nextCandidateId([]);
  for (let i = 0; i < total; i++) {
    const group = groups[Math.floor(i / groupSize) % groups.length];
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
    const suffix = String(i + 1).padStart(3, '0');
    candidates.push(
      candidateRepo.create({
        id,
        name: `${first} ${last}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}.${suffix}@${EMAIL_DOMAIN}`,
        matricNo: `FUT/${String(2024 + (i % 2))}/${String(100 + (i % 850)).padStart(3, '0')}`,
        careerGroupId: group.id,
        status: 'unscheduled',
      })
    );
    id = nextCandidateId([id]);
  }
  await candidateRepo.save(candidates);
  await groupRepo.save(
    groups.map((g) => {
      g.candidateCount = candidates.filter((c) => c.careerGroupId === g.id).length;
      return g;
    })
  );

  // Pre-assign roughly half of candidates across sessions (round-robin) so the
  // system shows populated halls, seat maps and attendance sheets immediately.
  const assignmentRepo = ds.getRepository(CandidateAssignment);
  const half = Math.floor(candidates.length / 2);
  const toAssign = candidates.slice(0, half);

  const usedSeats = new Set<string>();
  const assignments: CandidateAssignment[] = [];
  toAssign.forEach((candidate, index) => {
    const session = sessions[index % sessions.length];
    let placed = false;
    for (const hall of halls) {
      const occupied = usedCount(usedSeats, session.id, hall.id);
      if (occupied >= hall.capacity) continue;
      const seatNumber = seatLabel(hall.name, occupied + 1);
      const key = `${session.id}:${hall.id}:${seatNumber}`;
      if (usedSeats.has(key)) continue;
      usedSeats.add(key);
      assignments.push(
        assignmentRepo.create({
          id: `${candidate.id}:${session.id}`,
          candidateId: candidate.id,
          sessionId: session.id,
          hallId: hall.id,
          seatNumber,
        })
      );
      candidate.status = 'scheduled';
      candidate.assignedHallId = hall.id;
      candidate.assignedSeatNumber = seatNumber;
      candidate.assignedSessionId = session.id;
      candidate.assignedExamDate = session.examDate;
      placed = true;
      break;
    }
    if (!placed) candidate.status = 'unscheduled';
  });

  await assignmentRepo.save(assignments);
  await candidateRepo.save(toAssign);

  const latestByHall = new Map<string, string[]>();
  for (const a of assignments) {
    const arr = latestByHall.get(a.hallId) ?? [];
    arr.push(a.seatNumber);
    latestByHall.set(a.hallId, arr);
  }
  for (const [hallId, seatNums] of latestByHall) {
    const rows = await seatRepo.find({
      where: seatNums.map((n) => ({ hallId, seatNumber: n })),
    });
    const seatToCandidate = new Map(assignments.filter((a) => a.hallId === hallId).map((a) => [a.seatNumber, a.candidateId]));
    for (const seat of rows) {
      seat.status = 'occupied';
      seat.candidateId = seatToCandidate.get(seat.seatNumber) ?? null;
    }
    await seatRepo.save(rows);
  }

  await ds.getRepository(ScheduleMeta).save(
    ds.getRepository(ScheduleMeta).create({
      id: 'schedule',
      status: ScheduleState.CONFIRMED,
      sessionIds: sessions.map((s) => s.id),
      generatedAt: new Date(),
      confirmedAt: new Date(),
      confirmedBy: admin.id,
      summary: {
        totalCandidates: half,
        assignedCount: assignments.length,
        unassignedCount: half - assignments.length,
      },
    })
  );

  await logActivity({
    action: 'seeded',
    userId: admin.id,
    entityType: 'system',
    details: { candidates: total, halls: halls.length, sessions: sessions.length, ms: Date.now() - started },
  });

  return {
    candidateCount: total,
    message: `Seeded demo environment in ${Date.now() - started}ms: ${total} candidates, ${halls.length} halls, ${sessions.length} sessions, ${assignments.length} pre-assigned.`,
  };
}

function usedCount(used: Set<string>, sessionId: string, hallId: string): number {
  let count = 0;
  const prefix = `${sessionId}:${hallId}:`;
  for (const key of used) if (key.startsWith(prefix)) count++;
  return count;
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
