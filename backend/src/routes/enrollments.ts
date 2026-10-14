import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { Course } from '../entities/Course';
import { CourseSlot } from '../entities/CourseSlot';
import { Enrollment } from '../entities/Enrollment';
import { User } from '../entities/User';
import { WaitlistEntry } from '../entities/WaitlistEntry';
import { AuthRequest, requireAuth } from '../auth';
import { enrollmentDto } from '../dto';
import { HttpError, eligibilityProblem, releaseSeat, scheduleConflict, tryReserveSeat } from '../enrollment-rules';
import { promoteWaitlist } from '../waitlist';
import { notifyPromoted, PromotedInfo } from '../mailer';

export const enrollmentRouter = Router();
enrollmentRouter.use(requireAuth('student'));

const relations = { course: true, lecture: true, practice: true } as const;

enrollmentRouter.get('/', async (req: AuthRequest, res) => {
  const list = await AppDataSource.getRepository(Enrollment).find({
    where: { student: { id: req.auth!.id } }, relations, order: { enrolledAt: 'DESC' }
  });
  res.json(list.map(enrollmentDto));
});

enrollmentRouter.post('/', async (req: AuthRequest, res) => {
  const { courseId, lectureSlotId, practiceSlotId } = req.body ?? {};
  try {
    const created = await AppDataSource.transaction(async (m) => {
      const student = await m.findOneByOrFail(User, { id: req.auth!.id });
      const course = await m.findOne(Course, { where: { id: Number(courseId) }, relations: { slots: true, prerequisites: true } });
      if (!course) throw new HttpError(404, 'A kurzus nem található.');

      const lecture = course.slots.find((s) => s.id === Number(lectureSlotId) && s.type === 'lecture');
      const practice = course.slots.find((s) => s.id === Number(practiceSlotId) && s.type === 'practice');
      if (!lecture || !practice) throw new HttpError(400, 'Érvénytelen előadás vagy gyakorlat.');

      const problem = await eligibilityProblem(m, student, course);
      if (problem) throw problem;

      const conflict = await scheduleConflict(m, student.id, [lecture, practice]);
      if (conflict) throw conflict;

      // Atomikus helyfoglalás: csak akkor nő a létszám, ha még van szabad hely
      for (const slot of [lecture, practice]) {
        if (!(await tryReserveSeat(m, slot.id))) {
          throw new HttpError(409, `A(z) „${slot.name}” csoport időközben betelt.`);
        }
      }

      const saved = await m.save(Enrollment, m.create(Enrollment, {
        student, course, lecture, practice, status: 'Véglegesítve'
      }));
      // ha a hallgató várólistán volt erre a kurzusra, a bejegyzés megszűnik
      await m.createQueryBuilder().delete().from(WaitlistEntry)
        .where('studentId = :s AND courseId = :c', { s: student.id, c: course.id }).execute();
      return m.findOneOrFail(Enrollment, { where: { id: saved.id }, relations });
    });
    res.status(201).json(enrollmentDto(created));
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ message: e.message });
    console.error(e);
    res.status(500).json({ message: 'Váratlan hiba történt.' });
  }
});

// Gyakorlati csoport váltása a tárgy leadása nélkül
enrollmentRouter.patch('/:id/practice', async (req: AuthRequest, res) => {
  const newPracticeId = Number(req.body?.practiceSlotId);
  let promoted: PromotedInfo[] = [];
  try {
    const updated = await AppDataSource.transaction(async (m) => {
      const e = await m.findOne(Enrollment, {
        where: { id: Number(req.params.id), student: { id: req.auth!.id } }, relations
      });
      if (!e) throw new HttpError(404, 'A jelentkezés nem található.');
      if (e.status === 'Teljesítve') throw new HttpError(409, 'Teljesített tárgynál nem lehet csoportot váltani.');

      const course = await m.findOneOrFail(Course, { where: { id: e.course.id }, relations: { slots: true } });
      const target = course.slots.find((s) => s.id === newPracticeId && s.type === 'practice');
      if (!target) throw new HttpError(400, 'Érvénytelen gyakorlati csoport.');
      if (target.id === e.practice.id) throw new HttpError(409, 'Már ebben a gyakorlati csoportban van.');

      const conflict = await scheduleConflict(m, req.auth!.id, [e.lecture, target], e.id);
      if (conflict) throw conflict;

      if (!(await tryReserveSeat(m, target.id))) {
        throw new HttpError(409, `A(z) „${target.name}” csoport betelt.`);
      }
      const oldPracticeId = e.practice.id;
      await releaseSeat(m, oldPracticeId);
      await m.update(Enrollment, { id: e.id }, { practice: { id: target.id } });
      // a régi csoportban felszabadult helyre a várólista következő jogosultja kerül
      promoted = await promoteWaitlist(m, oldPracticeId);
      return m.findOneOrFail(Enrollment, { where: { id: e.id }, relations });
    });
    notifyPromoted(promoted); // commit után, nem várjuk meg
    res.json(enrollmentDto(updated));
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ message: e.message });
    console.error(e);
    res.status(500).json({ message: 'Váratlan hiba történt.' });
  }
});

enrollmentRouter.delete('/:id', async (req: AuthRequest, res) => {
  let promoted: PromotedInfo[] = [];
  try {
    const found = await AppDataSource.transaction(async (m) => {
      const e = await m.findOne(Enrollment, {
        where: { id: Number(req.params.id), student: { id: req.auth!.id } }, relations
      });
      if (!e) return false;
      if (e.status === 'Teljesítve') {
        throw new HttpError(409, 'Teljesített tárgyról nem lehet leiratkozni.');
      }
      for (const slot of [e.lecture, e.practice]) {
        await releaseSeat(m, slot.id);
      }
      const practiceId = e.practice.id;
      await m.remove(e);
      // a felszabadult helyre a várólista első jogosult hallgatója kerül
      promoted = await promoteWaitlist(m, practiceId);
      return true;
    });
    if (!found) return res.status(404).json({ message: 'A jelentkezés nem található.' });
    notifyPromoted(promoted); // commit után, nem várjuk meg
    res.status(204).end();
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ message: e.message });
    console.error(e);
    res.status(500).json({ message: 'Váratlan hiba történt.' });
  }
});
