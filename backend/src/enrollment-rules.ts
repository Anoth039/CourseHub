import { EntityManager } from 'typeorm';
import { Course } from './entities/Course';
import { CourseSlot } from './entities/CourseSlot';
import { Enrollment } from './entities/Enrollment';
import { User } from './entities/User';
import { schedulesOverlap } from './schedule';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** A kurzus azon előfeltételei, amelyeket a hallgató még nem teljesített. */
export async function missingPrerequisites(m: EntityManager, studentId: number, course: Course): Promise<Course[]> {
  const pre = course.prerequisites ?? [];
  if (pre.length === 0) return [];
  const me = await m.findOne(User, { where: { id: studentId }, relations: { completedCourses: true } });
  const done = new Set((me?.completedCourses ?? []).map((c) => c.id));
  return pre.filter((p) => !done.has(p.id));
}

/** Igaz, ha a hallgató minden előfeltételt teljesített (vagy nincs előfeltétel). */
export async function prerequisiteMet(m: EntityManager, studentId: number, course: Course): Promise<boolean> {
  return (await missingPrerequisites(m, studentId, course)).length === 0;
}

export const describePrerequisites = (list: Course[]) => list.map((p) => `${p.code} — ${p.title}`).join(', ');

/** Igaz, ha a hallgató már teljesítette a kurzust. */
export async function courseCompleted(m: EntityManager, studentId: number, courseId: number): Promise<boolean> {
  const n = await m.createQueryBuilder(User, 'u')
    .innerJoin('u.completedCourses', 'c', 'c.id = :cid', { cid: courseId })
    .where('u.id = :uid', { uid: studentId })
    .getCount();
  return n > 0;
}

/**
 * A tárgyfelvétel szabályai (már felvett, előfeltétel, kreditkeret).
 * A kurzust a `prerequisites` kapcsolattal együtt kell betölteni.
 */
export async function eligibilityProblem(m: EntityManager, student: User, course: Course): Promise<HttpError | null> {
  if (await courseCompleted(m, student.id, course.id)) {
    return new HttpError(409, 'Ezt a tárgyat már teljesítette, ezért nem veheti fel újra.');
  }
  if (await m.existsBy(Enrollment, { student: { id: student.id }, course: { id: course.id } })) {
    return new HttpError(409, 'Ezt a tárgyat már felvette.');
  }
  const missing = await missingPrerequisites(m, student.id, course);
  if (missing.length > 0) {
    return new HttpError(422, `A tárgy felvételéhez előbb teljesítenie kell az előfeltételeket: ${describePrerequisites(missing)}.`);
  }
  const taken = await m.find(Enrollment, { where: { student: { id: student.id } }, relations: { course: true } });
  const used = taken.reduce((s, e) => s + e.course.credits, 0);
  const max = student.maxCredits ?? 30;
  if (used + course.credits > max) {
    return new HttpError(422, `A tárgy felvételével túllépné a maximálisan engedélyezett ${max} kreditet.`);
  }
  return null;
}

/** Atomikus helyfoglalás: csak akkor nő a létszám, ha még van szabad hely. */
export async function tryReserveSeat(m: EntityManager, slotId: number): Promise<boolean> {
  const r = await m.createQueryBuilder()
    .update(CourseSlot)
    .set({ enrolledCount: () => 'enrolledCount + 1' })
    .where('id = :id AND enrolledCount < capacity', { id: slotId })
    .execute();
  return !!r.affected;
}

export async function releaseSeat(m: EntityManager, slotId: number): Promise<void> {
  await m.createQueryBuilder().update(CourseSlot)
    .set({ enrolledCount: () => 'GREATEST(enrolledCount - 1, 0)' })
    .where('id = :id', { id: slotId }).execute();
}

/**
 * Órarendi ütközés vizsgálata: a megadott csoportok egymással, illetve a hallgató
 * már felvett csoportjaival nem fedhetik át egymást.
 */
export async function scheduleConflict(
  m: EntityManager, studentId: number, slots: CourseSlot[], ignoreEnrollmentId?: number
): Promise<HttpError | null> {
  const label = (s: CourseSlot) => `${s.name} (${s.schedule})`;

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (schedulesOverlap(slots[i].schedule, slots[j].schedule)) {
        return new HttpError(409, `Órarendi ütközés: a(z) ${label(slots[i])} és a(z) ${label(slots[j])} átfedik egymást.`);
      }
    }
  }

  const taken = await m.find(Enrollment, {
    where: { student: { id: studentId } }, relations: { course: true, lecture: true, practice: true }
  });
  for (const slot of slots) {
    for (const e of taken) {
      if (e.id === ignoreEnrollmentId) continue;
      for (const other of [e.lecture, e.practice]) {
        if (schedulesOverlap(slot.schedule, other.schedule)) {
          return new HttpError(409,
            `Órarendi ütközés: a(z) ${label(slot)} ütközik a már felvett ${e.course.code} tárgy ${label(other)} csoportjával.`);
        }
      }
    }
  }
  return null;
}
