import { Router, Response } from 'express';
import { EntityManager, In } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Course } from '../entities/Course';
import { CourseSlot } from '../entities/CourseSlot';
import { User } from '../entities/User';
import { Enrollment } from '../entities/Enrollment';
import { WaitlistEntry } from '../entities/WaitlistEntry';
import { HttpError, courseCompleted, scheduleConflict } from '../enrollment-rules';
import { AuthRequest, requireAuth } from '../auth';
import { courseDto, slotDto } from '../dto';
import { assertInstructorsFree, PlannedSlot } from '../instructor-rules';
import { promoteWaitlist } from '../waitlist';
import { notifyPromoted, PromotedInfo } from '../mailer';
import { SCHEDULE_FORMAT_HINT, parseSchedule } from '../schedule';

export const courseRouter = Router();
const courses = () => AppDataSource.getRepository(Course);

/** A kérésből az előfeltétel-azonosítók (duplikátumok nélkül). */
const prerequisiteIdsOf = (b: any): number[] =>
  [...new Set((Array.isArray(b?.prerequisiteIds) ? b.prerequisiteIds : []).map(Number))] as number[];

/** Betölti az előfeltétel-kurzusokat; ha bármelyik nem létezik, hibát dob. */
async function loadPrerequisites(m: EntityManager, ids: number[]): Promise<Course[]> {
  if (ids.length === 0) return [];
  const found = await m.find(Course, { where: { id: In(ids) }, relations: { prerequisites: true } });
  if (found.length !== ids.length) throw new HttpError(400, 'A megadott előfeltétel-kurzus nem létezik.');
  return found;
}

// Hallgatók: teljes katalógus (a hallgató teljesített kurzusaival számolt előfeltétel-állapottal)
courseRouter.get('/', requireAuth('student'), async (req: AuthRequest, res) => {
  const [list, me] = await Promise.all([
    courses().find({ relations: { slots: true, prerequisites: true }, order: { code: 'ASC' } }),
    AppDataSource.getRepository(User).findOne({
      where: { id: req.auth!.id }, relations: { completedCourses: true }
    })
  ]);
  const done = new Set((me?.completedCourses ?? []).map((c) => c.id));
  res.json(list.map((c) => courseDto(c, done)));
});

// Előfeltétel-választóhoz: minden kurzus röviden
courseRouter.get('/options', requireAuth(), async (_req, res) => {
  const list = await courses().find({ select: { id: true, code: true, title: true }, order: { code: 'ASC' } });
  res.json(list);
});

// Gyakorlatvezető választásához: a regisztrált oktatók és a már lefoglalt óráik
courseRouter.get('/instructors', requireAuth('instructor'), async (_req, res) => {
  const [users, slots] = await Promise.all([
    AppDataSource.getRepository(User).find({ where: { role: 'instructor' }, order: { name: 'ASC' } }),
    AppDataSource.getRepository(CourseSlot).find({ relations: { course: { owner: true } } })
  ]);
  const busy = new Map<number, { courseId: number; schedule: string; label: string }[]>();
  for (const s of slots) {
    const id = s.instructorUserId ?? s.course.owner?.id;
    if (id == null) continue;
    if (!busy.has(id)) busy.set(id, []);
    busy.get(id)!.push({ courseId: s.course.id, schedule: s.schedule, label: `${s.course.code} – ${s.name}` });
  }
  res.json(users.map((u) => ({
    id: u.id, name: u.name, title: u.title, department: u.department, busy: busy.get(u.id) ?? []
  })));
});

// Más oktató kurzusában, de általam vezetett gyakorlatok
courseRouter.get('/teaching', requireAuth('instructor'), async (req: AuthRequest, res) => {
  const slots = await AppDataSource.getRepository(CourseSlot).find({
    where: { instructorUserId: req.auth!.id, type: 'practice' },
    relations: { course: { owner: true } },
    order: { id: 'ASC' }
  });
  res.json(slots
    .filter((s) => s.course.owner?.id !== req.auth!.id)
    .map((s) => ({
      courseId: s.course.id, code: s.course.code, title: s.course.title,
      owner: s.course.owner?.name ?? '', slot: slotDto(s)
    })));
});

// Oktatók: csak a saját kurzusaik
courseRouter.get('/mine', requireAuth('instructor'), async (req: AuthRequest, res) => {
  const list = await courses().find({
    where: { owner: { id: req.auth!.id } },
    relations: { slots: true, prerequisites: true },
    order: { id: 'DESC' }
  });
  res.json(list.map((c) => courseDto(c)));
});

courseRouter.post('/', requireAuth('instructor'), async (req: AuthRequest, res) => {
  const b = req.body ?? {};
  const practices: any[] = Array.isArray(b.practices) ? b.practices : [];
  try {
    if (!b.code?.trim() || !b.title?.trim() || !b.lecture?.schedule?.trim() || !b.lecture?.location?.trim()) {
      throw new HttpError(400, 'Töltse ki a kötelező mezőket.');
    }
    if (practices.length === 0 || practices.some((p) => !p.name || !p.schedule || !p.location || !(p.capacity > 0))) {
      throw new HttpError(400, 'Legalább egy, teljesen kitöltött gyakorlati csoport szükséges.');
    }
    if (!parseSchedule(b.lecture.schedule) || practices.some((p) => !parseSchedule(p.schedule))) {
      throw new HttpError(400, SCHEDULE_FORMAT_HINT);
    }
    if (await courses().existsBy({ code: b.code.trim() })) {
      throw new HttpError(409, 'Ilyen tárgykóddal már létezik kurzus.');
    }

    const prerequisites = await loadPrerequisites(AppDataSource.manager, prerequisiteIdsOf(b));

    const owner = await AppDataSource.getRepository(User).findOneByOrFail({ id: req.auth!.id });
    const leaderOf = (p: any) => Number(p?.instructorId) || owner.id;

    const planned: PlannedSlot[] = [
      { instructorId: owner.id, schedule: b.lecture.schedule, label: 'Előadás' },
      ...practices.map((p) => ({ instructorId: leaderOf(p), schedule: p.schedule, label: p.name }))
    ];
    const leaders = await assertInstructorsFree(AppDataSource.manager, planned, owner.id);

    const slot = (p: Partial<CourseSlot>) => Object.assign(new CourseSlot(), { enrolledCount: 0, ...p });
    const course = courses().create({
      code: b.code.trim(),
      title: b.title.trim(),
      department: owner.department ?? 'Ismeretlen tanszék',
      credits: Number(b.credits) || 1,
      semester: '2026/27 I. Félév',
      recommendedSemester: Number(b.recommendedSemester) || 1,
      completionType: b.completionType || 'Gyakorlati jegy',
      description: b.description?.trim() || 'A kurzus tematikája feltöltés alatt.',
      owner,
      prerequisites,
      slots: [
        slot({
          type: 'lecture', name: 'Előadás', schedule: b.lecture.schedule, location: b.lecture.location,
          capacity: practices.reduce((s, p) => s + Number(p.capacity), 0),
          instructor: owner.name, instructorUserId: owner.id
        }),
        ...practices.map((p) => slot({
          type: 'practice', name: p.name, schedule: p.schedule, location: p.location, capacity: Number(p.capacity),
          instructor: leaders.get(leaderOf(p))!.name, instructorUserId: leaderOf(p)
        }))
      ]
    });
    const saved = await courses().save(course);
    res.status(201).json(courseDto(saved));
  } catch (e) { fail(e, res); }
});

// Oktató: a saját kurzus módosítása (adatok, előadás, gyakorlati csoportok)
courseRouter.put('/:id', requireAuth('instructor'), async (req: AuthRequest, res) => {
  const b = req.body ?? {};
  const practices: any[] = Array.isArray(b.practices) ? b.practices : [];
  try {
    if (!b.code?.trim() || !b.title?.trim() || !b.lecture?.schedule?.trim() || !b.lecture?.location?.trim()) {
      throw new HttpError(400, 'Töltse ki a kötelező mezőket.');
    }
    if (practices.length === 0 || practices.some((p) => !p.name || !p.schedule || !p.location || !(p.capacity > 0))) {
      throw new HttpError(400, 'Legalább egy, teljesen kitöltött gyakorlati csoport szükséges.');
    }
    if (!parseSchedule(b.lecture.schedule) || practices.some((p) => !parseSchedule(p.schedule))) {
      throw new HttpError(400, SCHEDULE_FORMAT_HINT);
    }

    let promoted: PromotedInfo[] = [];
    const result = await AppDataSource.transaction(async (m) => {
      const course = await m.findOne(Course, {
        where: { id: Number(req.params.id) }, relations: { owner: true, slots: true, prerequisites: true }
      });
      if (!course) throw new HttpError(404, 'A kurzus nem található.');
      if (course.owner?.id !== req.auth!.id) throw new HttpError(403, 'Csak a saját kurzusát módosíthatja.');

      const code = String(b.code).trim();
      const dup = await m.findOneBy(Course, { code });
      if (dup && dup.id !== course.id) throw new HttpError(409, 'Ilyen tárgykóddal már létezik kurzus.');

      // előfeltételek (önmaga és körkörös hivatkozás nem megengedett)
      const prereqIds = prerequisiteIdsOf(b);
      let frontier = await loadPrerequisites(m, prereqIds);
      const seen = new Set<number>();
      for (let depth = 0; frontier.length > 0 && depth < 50; depth++) {
        const next: number[] = [];
        for (const c of frontier) {
          if (c.id === course.id) throw new HttpError(400, 'A kurzus nem lehet (közvetve sem) a saját előfeltétele.');
          if (seen.has(c.id)) continue;
          seen.add(c.id);
          next.push(...(c.prerequisites ?? []).map((p) => p.id));
        }
        frontier = next.length ? await m.find(Course, { where: { id: In(next) }, relations: { prerequisites: true } }) : [];
      }

      const lectures = course.slots.filter((s) => s.type === 'lecture').sort((a, b) => a.id - b.id);
      const existing = course.slots.filter((s) => s.type === 'practice');
      const keepIds = new Set(practices.filter((p) => p.id != null).map((p) => Number(p.id)));
      for (const id of keepIds) {
        if (!existing.some((s) => s.id === id)) throw new HttpError(400, 'Érvénytelen gyakorlati csoport azonosító.');
      }

      // az oktatók nem lehetnek két helyen egyszerre (a kurzus saját, régi óráit nem számítjuk)
      const leaderOf = (p: any) => Number(p?.instructorId) || course.owner!.id;
      const leaders = await assertInstructorsFree(m, [
        { instructorId: course.owner!.id, schedule: b.lecture.schedule, label: 'Előadás' },
        ...practices.map((p) => ({ instructorId: leaderOf(p), schedule: p.schedule, label: p.name }))
      ], req.auth!.id, course.id);

      let scheduleChanged = false;

      // törölt gyakorlatok (csak üres, várólista nélküli csoport törölhető)
      for (const s of existing.filter((x) => !keepIds.has(x.id))) {
        const waiting = await m.countBy(WaitlistEntry, { practice: { id: s.id } });
        if (s.enrolledCount > 0 || waiting > 0) {
          throw new HttpError(409, `A(z) „${s.name}” csoport nem törölhető, mert van jelentkezett vagy várólistán lévő hallgató.`);
        }
        await m.remove(CourseSlot, s);
      }

      // meglévő gyakorlatok módosítása, újak létrehozása
      for (const p of practices) {
        const capacity = Number(p.capacity);
        if (p.id != null) {
          const s = existing.find((x) => x.id === Number(p.id))!;
          if (capacity < s.enrolledCount) {
            throw new HttpError(422, `A(z) „${s.name}” csoport létszáma nem lehet kevesebb a jelentkezettek számánál (${s.enrolledCount}).`);
          }
          if (s.schedule !== p.schedule) scheduleChanged = true;
          Object.assign(s, {
            name: p.name, schedule: p.schedule, location: p.location, capacity,
            instructor: leaders.get(leaderOf(p))!.name, instructorUserId: leaderOf(p)
          });
          await m.save(CourseSlot, s);
        } else {
          await m.save(CourseSlot, Object.assign(new CourseSlot(), {
            type: 'practice', name: p.name, schedule: p.schedule, location: p.location,
            capacity, enrolledCount: 0, instructor: leaders.get(leaderOf(p))!.name, instructorUserId: leaderOf(p), course
          }));
        }
      }

      // előadás: időpont és helyszín; a férőhely a gyakorlatok összkapacitása
      const lecture = lectures[0];
      if (lecture) {
        if (lecture.schedule !== b.lecture.schedule) scheduleChanged = true;
        lecture.schedule = b.lecture.schedule;
        lecture.location = b.lecture.location;
        lecture.instructor = course.owner!.name;
        lecture.instructorUserId = course.owner!.id;
        if (lectures.length === 1) {
          const total = practices.reduce((s, p) => s + Number(p.capacity), 0);
          if (total < lecture.enrolledCount) {
            throw new HttpError(422, `Az összkapacitás nem lehet kevesebb az előadásra jelentkezettek számánál (${lecture.enrolledCount}).`);
          }
          lecture.capacity = total;
        }
        await m.save(CourseSlot, lecture);
      }

      await m.update(Course, { id: course.id }, {
        code,
        title: String(b.title).trim(),
        credits: Number(b.credits) || 1,
        recommendedSemester: Number(b.recommendedSemester) || 1,
        completionType: b.completionType || 'Gyakorlati jegy',
        description: b.description?.trim() || 'A kurzus tematikája feltöltés alatt.'
      });
      const oldPrereqIds = course.prerequisites.map((p) => p.id);
      await m.createQueryBuilder().relation(Course, 'prerequisites').of(course.id).addAndRemove(
        prereqIds.filter((id) => !oldPrereqIds.includes(id)),
        oldPrereqIds.filter((id) => !prereqIds.includes(id))
      );

      // időpont-módosításnál a már jelentkezett hallgatóknál sem alakulhat ki ütközés
      if (scheduleChanged) {
        const enrolls = await m.find(Enrollment, {
          where: { course: { id: course.id } }, relations: { student: true, lecture: true, practice: true }
        });
        for (const e of enrolls) {
          const c = await scheduleConflict(m, e.student.id, [e.lecture, e.practice], e.id);
          if (c) throw new HttpError(409, `Az időpont módosítása egy jelentkezett hallgatónál (${e.student.name}) ütközést okozna. ${c.message}`);
        }
      }

      // ha nőtt a létszám, a felszabadult helyekre a várólista következő jogosultjai kerülnek
      for (const p of practices) {
        if (p.id != null) promoted.push(...await promoteWaitlist(m, Number(p.id)));
      }

      return m.findOneOrFail(Course, { where: { id: course.id }, relations: { slots: true, prerequisites: true } });
    });
    notifyPromoted(promoted); // commit után, nem várjuk meg
    res.json(courseDto(result));
  } catch (e) { fail(e, res); }
});

courseRouter.delete('/:id', requireAuth('instructor'), async (req: AuthRequest, res) => {
  const course = await courses().findOne({
    where: { id: Number(req.params.id) }, relations: { owner: true }
  });
  if (!course) return res.status(404).json({ message: 'A kurzus nem található.' });
  if (course.owner?.id !== req.auth!.id) {
    return res.status(403).json({ message: 'Csak a saját kurzusát törölheti.' });
  }
  await courses().remove(course); // csoportok és jelentkezések CASCADE-del törlődnek
  res.status(204).end();
});

/** Betölti a kurzust, és ellenőrzi, hogy a bejelentkezett oktató a tulajdonosa. */
async function ownedCourse(m: EntityManager, courseId: number, instructorId: number): Promise<Course> {
  const course = await m.findOne(Course, { where: { id: courseId }, relations: { owner: true } });
  if (!course) throw new HttpError(404, 'A kurzus nem található.');
  if (course.owner?.id !== instructorId) throw new HttpError(403, 'Csak a saját kurzusához fér hozzá.');
  return course;
}

const fail = (e: unknown, res: Response) => {
  if (e instanceof HttpError) return res.status(e.status).json({ message: e.message });
  console.error(e);
  return res.status(500).json({ message: 'Váratlan hiba történt.' });
};

// Oktató: a kurzusra jelentkezett hallgatók és teljesítési állapotuk.
// A tárgyfelelős mindenkit lát; a más kurzusában gyakorlatot vezető oktató csak a saját csoportjait.
courseRouter.get('/:id/students', requireAuth('instructor'), async (req: AuthRequest, res) => {
  try {
    const list = await AppDataSource.transaction(async (m) => {
      const course = await m.findOne(Course, { where: { id: Number(req.params.id) }, relations: { owner: true } });
      if (!course) throw new HttpError(404, 'A kurzus nem található.');

      let onlyPractices: Set<number> | null = null; // null = a tárgyfelelős, minden hallgató látszik
      if (course.owner?.id !== req.auth!.id) {
        const led = await m.find(CourseSlot, {
          where: { course: { id: course.id }, type: 'practice', instructorUserId: req.auth!.id }
        });
        if (led.length === 0) throw new HttpError(403, 'Csak a saját kurzusához fér hozzá.');
        onlyPractices = new Set(led.map((s) => s.id));
      }

      const enrollments = (await m.find(Enrollment, {
        where: { course: { id: course.id } },
        relations: { student: true, lecture: true, practice: true },
        order: { id: 'ASC' }
      })).filter((e) => !onlyPractices || onlyPractices.has(e.practice.id));
      const done = await m.createQueryBuilder(User, 'u')
        .innerJoin('u.completedCourses', 'c', 'c.id = :cid', { cid: course.id })
        .select('u.id', 'id')
        .getRawMany<{ id: number }>();
      const doneIds = new Set(done.map((d) => Number(d.id)));
      return enrollments.map((e) => ({
        id: e.student.id,
        name: e.student.name,
        studentId: e.student.studentId,
        major: e.student.major,
        semester: e.student.semester,
        lecture: e.lecture.name,
        practice: e.practice.name,
        completed: doneIds.has(e.student.id)
      }));
    });
    res.json(list);
  } catch (e) { fail(e, res); }
});

// Oktató: kurzus teljesítettnek jelölése egy hallgatónak
courseRouter.post('/:id/completions', requireAuth('instructor'), async (req: AuthRequest, res) => {
  try {
    const studentId = Number(req.body?.studentId);
    await AppDataSource.transaction(async (m) => {
      const course = await ownedCourse(m, Number(req.params.id), req.auth!.id);
      const enrollment = await m.findOne(Enrollment, {
        where: { course: { id: course.id }, student: { id: studentId } }
      });
      if (!enrollment) throw new HttpError(404, 'A hallgató nem jelentkezett erre a kurzusra.');
      if (await courseCompleted(m, studentId, course.id)) {
        throw new HttpError(409, 'A kurzus már teljesítettnek van jelölve ennél a hallgatónál.');
      }
      await m.createQueryBuilder().relation(User, 'completedCourses').of(studentId).add(course.id);
      await m.update(Enrollment, { id: enrollment.id }, { status: 'Teljesítve' });
      await m.createQueryBuilder().delete().from(WaitlistEntry)
        .where('studentId = :s AND courseId = :c', { s: studentId, c: course.id }).execute();
    });
    res.status(204).end();
  } catch (e) { fail(e, res); }
});
