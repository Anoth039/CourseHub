import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { Course } from '../entities/Course';
import { Enrollment } from '../entities/Enrollment';
import { User } from '../entities/User';
import { WaitlistEntry } from '../entities/WaitlistEntry';
import { AuthRequest, requireAuth } from '../auth';
import { waitlistDto } from '../dto';
import { HttpError, courseCompleted, describePrerequisites, missingPrerequisites, scheduleConflict } from '../enrollment-rules';

export const waitlistRouter = Router();
waitlistRouter.use(requireAuth('student'));

const relations = { course: true, practice: true } as const;
const repo = () => AppDataSource.getRepository(WaitlistEntry);

/** A hallgató helye a sorban: az azonos csoportra korábban jelentkezettek + 1. */
const positionOf = (w: WaitlistEntry) =>
  repo().createQueryBuilder('w')
    .where('w.practiceId = :p AND w.id <= :id', { p: w.practice.id, id: w.id })
    .getCount();

waitlistRouter.get('/', async (req: AuthRequest, res) => {
  const list = await repo().find({
    where: { student: { id: req.auth!.id } }, relations, order: { createdAt: 'DESC' }
  });
  res.json(await Promise.all(list.map(async (w) => waitlistDto(w, await positionOf(w)))));
});

waitlistRouter.post('/', async (req: AuthRequest, res) => {
  const { courseId, practiceSlotId } = req.body ?? {};
  try {
    const created = await AppDataSource.transaction(async (m) => {
      const student = await m.findOneByOrFail(User, { id: req.auth!.id });
      const course = await m.findOne(Course, {
        where: { id: Number(courseId) }, relations: { slots: true, prerequisites: true }
      });
      if (!course) throw new HttpError(404, 'A kurzus nem található.');

      const practice = course.slots.find((s) => s.id === Number(practiceSlotId) && s.type === 'practice');
      if (!practice) throw new HttpError(400, 'Érvénytelen gyakorlati csoport.');

      if (await courseCompleted(m, student.id, course.id)) {
        throw new HttpError(409, 'Ezt a tárgyat már teljesítette.');
      }
      if (await m.existsBy(Enrollment, { student: { id: student.id }, course: { id: course.id } })) {
        throw new HttpError(409, 'Ezt a tárgyat már felvette.');
      }
      if (await m.existsBy(WaitlistEntry, { student: { id: student.id }, course: { id: course.id } })) {
        throw new HttpError(409, 'Erre a kurzusra már várólistán van.');
      }
      if (practice.enrolledCount < practice.capacity) {
        throw new HttpError(409, 'A csoportban van szabad hely, jelentkezzen közvetlenül.');
      }
      const missing = await missingPrerequisites(m, student.id, course);
      if (missing.length > 0) {
        throw new HttpError(422, `A várólistára lépéshez teljesítenie kell az előfeltételeket: ${describePrerequisites(missing)}.`);
      }

      const conflict = await scheduleConflict(m, student.id, [practice]);
      if (conflict) throw conflict;

      const saved = await m.save(WaitlistEntry, m.create(WaitlistEntry, { student, course, practice }));
      return m.findOneOrFail(WaitlistEntry, { where: { id: saved.id }, relations });
    });
    res.status(201).json(waitlistDto(created, await positionOf(created)));
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ message: e.message });
    console.error(e);
    res.status(500).json({ message: 'Váratlan hiba történt.' });
  }
});

waitlistRouter.delete('/:id', async (req: AuthRequest, res) => {
  const entry = await repo().findOne({
    where: { id: Number(req.params.id), student: { id: req.auth!.id } }
  });
  if (!entry) return res.status(404).json({ message: 'A várólista-bejegyzés nem található.' });
  await repo().remove(entry);
  res.status(204).end();
});
