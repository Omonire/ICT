import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireRole } from '../middleware/role';
import { AppDataSource } from '../config/data-source';
import { User, UserRole } from '../entities/User';
import { Candidate } from '../entities/Candidate';
import { CareerGroup } from '../entities/CareerGroup';
import { Hall } from '../entities/Hall';
import { Seat } from '../entities/Seat';
import { Session } from '../entities/Session';
import { CandidateAssignment } from '../entities/CandidateAssignment';
import { ActivityLog } from '../entities/ActivityLog';
import { ScheduleMeta } from '../entities/ScheduleMeta';
import { setMaintenanceMode } from '../middleware/maintenance';
import { runSeed } from '../services/seeding';
import { AppError, asyncHandler as wrap } from '../utils/errors';
import { createUserSchema, seedForSessionSchema } from '../schemas';
import { validateBody } from '../middleware/validate';
import { genUuid } from '../utils/ids';
import { logActivity } from '../services/activity-log';

const router = Router();
const superadminOnly = requireRole('superadmin');

// ─── System purge ────────────────────────────────────────────────────────────
router.post(
  '/purge',
  superadminOnly,
  wrap(async (req, res) => {
    const ds = AppDataSource;
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query('PRAGMA foreign_keys = OFF');
      await qr.query(`DELETE FROM activity_log`);
      await qr.query(`DELETE FROM candidate_assignments`);
      await qr.query(`DELETE FROM seats`);
      await qr.query(`DELETE FROM candidates`);
      await qr.query(`DELETE FROM sessions`);
      await qr.query(`DELETE FROM halls`);
      await qr.query(`DELETE FROM career_groups`);
      await qr.query(`DELETE FROM schedule_meta`);
      await qr.query('PRAGMA foreign_keys = ON');
      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
    res.json({ message: 'System data purged. Users preserved.' });
  })
);

// ─── Re-seed ─────────────────────────────────────────────────────────────────
router.post(
  '/seed',
  superadminOnly,
  wrap(async (_req, res) => {
    const result = await runSeed();
    res.json(result);
  })
);

// ─── Maintenance toggle ──────────────────────────────────────────────────────
router.post(
  '/maintenance',
  superadminOnly,
  wrap(async (req, res) => {
    const { enabled } = req.body as { enabled?: boolean };
    if (typeof enabled !== 'boolean') {
      throw AppError.badRequest('`enabled` must be a boolean');
    }
    setMaintenanceMode(enabled);
    res.json({ maintenance: enabled });
  })
);

// ─── List users ──────────────────────────────────────────────────────────────
router.get(
  '/users',
  superadminOnly,
  wrap(async (_req, res) => {
    const users = await AppDataSource.getRepository(User).find({
      order: { createdAt: 'DESC' },
    });
    res.json(users.map((u) => u.toSafeJSON()));
  })
);

// ─── Create user ─────────────────────────────────────────────────────────────
router.post(
  '/users',
  superadminOnly,
  validateBody(createUserSchema),
  wrap(async (req, res) => {
    const { email, password, name, role } = req.body;
    const repo = AppDataSource.getRepository(User);
    const existing = await repo.findOne({ where: { email } });
    if (existing) throw AppError.conflict('A user with this email already exists');

    const user = repo.create({
      id: genUuid(),
      email,
      password: await bcrypt.hash(password, 10),
      name: name ?? null,
      role: role ?? UserRole.OPERATOR,
    });
    await repo.save(user);
    res.status(201).json(user.toSafeJSON());
  })
);

// ─── Update user ─────────────────────────────────────────────────────────────
router.put(
  '/users/:id',
  superadminOnly,
  wrap(async (req, res) => {
    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOne({ where: { id: req.params.id } });
    if (!user) throw AppError.notFound('User not found');

    const { email, password, name, role } = req.body as Record<string, any>;
    if (email) user.email = email;
    if (name !== undefined) user.name = name;
    if (role) user.role = role;
    if (password) user.password = await bcrypt.hash(password, 10);

    await repo.save(user);
    res.json(user.toSafeJSON());
  })
);

// ─── Delete user ─────────────────────────────────────────────────────────────
router.delete(
  '/users/:id',
  superadminOnly,
  wrap(async (req, res) => {
    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOne({ where: { id: req.params.id } });
    if (!user) throw AppError.notFound('User not found');

    const currentUser = req.user as User;
    if (user.id === currentUser.id) {
      throw AppError.badRequest('You cannot delete your own account');
    }
    if (user.role === UserRole.SUPERADMIN) {
      throw AppError.forbidden('Cannot delete another superadmin');
    }

    await repo.remove(user);
    res.json({ message: 'User deleted' });
  })
);

// ─── Purge sessions only (keep candidates, halls, users) ─────────────────────
router.post(
  '/purge-sessions',
  superadminOnly,
  wrap(async (_req, res) => {
    const ds = AppDataSource;

    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query('PRAGMA foreign_keys = OFF');
      await qr.query(`UPDATE candidates SET assigned_session_id = NULL, assigned_hall_id = NULL, assigned_seat_number = NULL, assigned_exam_date = NULL, status = 'unscheduled'`);
      await qr.query(`DELETE FROM candidate_assignments`);
      await qr.query(`DELETE FROM schedule_meta`);
      await qr.query(`DELETE FROM sessions`);
      await qr.query(`DELETE FROM seats`);
      await qr.query('PRAGMA foreign_keys = ON');
      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    const halls = await ds.getRepository(Hall).find();
    const seatRepo = ds.getRepository(Seat);
    const seatRows: Seat[] = [];
    for (const hall of halls) {
      for (let n = 1; n <= hall.capacity; n++) {
        seatRows.push(
          seatRepo.create({
            id: genUuid(),
            hallId: hall.id,
            seatNumber: `${hall.name.charAt(hall.name.length - 1)}-${String(n).padStart(3, '0')}`,
            status: 'available',
          })
        );
      }
    }
    await seatRepo.save(seatRows);

    await logActivity({
      action: 'admin.purge_sessions',
      userId: (_req as any).user?.id ?? null,
      entityType: 'system',
      details: { seatsReset: seatRows.length },
    });

    res.json({ message: 'Sessions cleared, seats reset, candidates reset to unscheduled.' });
  })
);

// ─── Seed candidates for a specific session ──────────────────────────────────
router.post(
  '/seed-for-session',
  superadminOnly,
  validateBody(seedForSessionSchema),
  wrap(async (req, res) => {
    const { sessionId, count } = req.body as { sessionId: string; count: number };
    const ds = AppDataSource;

    const session = await ds.getRepository(Session).findOne({ where: { id: sessionId } });
    if (!session) throw AppError.notFound('Session not found');

    const groups = await ds.getRepository(CareerGroup).find();
    if (groups.length === 0) throw AppError.badRequest('No career groups exist — seed the system first');

    const halls = await ds.getRepository(Hall).find();
    if (halls.length === 0) throw AppError.badRequest('No halls exist — create halls first');

    const FIRST = ['Adaeze','Babatunde','Chioma','Damilola','Efe','Funmilayo','Gbenga','Hauwa','Ibrahim','Jummai','Kelechi','Lola','Musa','Ngozi','Obinna','Precious','Quadri','Ruth','Sade','Tunde','Uche','Victoria','Wale','Yemi','Zainab','Ayobami','Blessing','Chinedu','Deborah','Emeka','Fatima','Gloria','Hassan','Ifeoma','Joy','Kunle','Linda','Maryam','Nneka','Olamide','Peter','Queen','Richard','Sandra','Tobi','Usman','Veronica','Wumi','Yusuf','Amara'];
    const LAST = ['Adeyemi','Bello','Chukwu','Dada','Eze','Fagbemi','Garba','Hassan','Ibekwe','Johnson','Kalu','Lawal','Mensah','Nwachukwu','Okafor','Ogunleye','Popoola','Quadri','Rabiu','Salami','Temitope','Umar','Vivian','Williams','Yakubu','Zubair','Adebayo','Bamidele','Chukwuma','Dare','Ekwere','Femi','Ganiyu','Idowu','Jibril','Kayode','Lamidi','Mohammed','Nwosu','Olawale','Osman','Pepple','Raji','Sunday','Taiwo','Ugwu','Waziri','Yusuf','Abubakar','Zakari'];

    const candidateRepo = ds.getRepository(Candidate);
    const seatRepo = ds.getRepository(Seat);
    const assignmentRepo = ds.getRepository(CandidateAssignment);

    const existing = await candidateRepo.find({ select: ['id'] });
    let nextNum = existing.length + 1;

    const newCandidates: Candidate[] = [];
    const assignments: CandidateAssignment[] = [];

    for (let i = 0; i < count; i++) {
      const group = groups[i % groups.length];
      const first = FIRST[(existing.length + i) % FIRST.length];
      const last = LAST[Math.floor((existing.length + i) / FIRST.length) % LAST.length];
      const suffix = String(nextNum).padStart(3, '0');
      const candId = `CAN-${suffix}`;

      const cand = candidateRepo.create({
        id: candId,
        name: `${first} ${last}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}.${suffix}@student.fut.edu.ng`,
        matricNo: `FUT/2024/${String(100 + (nextNum % 850)).padStart(3, '0')}`,
        careerGroupId: group.id,
        status: 'scheduled',
      });

      let placed = false;
      for (const hall of halls) {
        const occupied = await assignmentRepo.count({ where: { sessionId, hallId: hall.id } });
        if (occupied >= hall.capacity) continue;
        const seatNumber = `${hall.name.charAt(hall.name.length - 1)}-${String(occupied + 1).padStart(3, '0')}`;

        assignments.push(
          assignmentRepo.create({
            id: `${candId}:${sessionId}`,
            candidateId: candId,
            sessionId,
            hallId: hall.id,
            seatNumber,
          })
        );
        cand.assignedHallId = hall.id;
        cand.assignedSeatNumber = seatNumber;
        cand.assignedSessionId = sessionId;
        cand.assignedExamDate = session.examDate;
        placed = true;
        break;
      }
      if (!placed) cand.status = 'unscheduled';

      newCandidates.push(cand);
      nextNum++;
    }

    await candidateRepo.save(newCandidates);
    await assignmentRepo.save(assignments);

    await logActivity({
      action: 'admin.seed_for_session',
      userId: (req as any).user?.id ?? null,
      entityType: 'session',
      entityId: sessionId,
      details: { sessionName: session.name, examDate: session.examDate, candidatesAdded: count, assigned: assignments.length },
    });

    res.json({
      message: `Seeded ${count} candidates for ${session.name} (${session.examDate}). ${assignments.length} assigned.`,
      candidatesAdded: count,
      assigned: assignments.length,
    });
  })
);

export default router;
