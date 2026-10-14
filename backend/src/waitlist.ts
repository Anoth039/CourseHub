import { EntityManager } from 'typeorm';
import { CourseSlot } from './entities/CourseSlot';
import { Enrollment } from './entities/Enrollment';
import { WaitlistEntry } from './entities/WaitlistEntry';
import type { PromotedInfo } from './mailer';
import { eligibilityProblem, releaseSeat, scheduleConflict, tryReserveSeat } from './enrollment-rules';

/**
 * Egy gyakorlati csoportban felszabadult hely betöltése a várólistáról.
 * Sorban (érkezési sorrendben) halad: aki közben már nem jogosult (kreditkeret,
 * előfeltétel, már felvette), azt kihagyja és törli a sorból. A hívónak a
 * helyfelszabadítással megegyező tranzakcióban kell futnia.
 * Visszaadja a sikeresen előléptetett hallgatókat – az e-mail értesítést a hívó
 * küldi ki, a tranzakció SIKERES lezárása UTÁN (lásd mailer.ts).
 */
export async function promoteWaitlist(m: EntityManager, practiceId: number): Promise<PromotedInfo[]> {
  const promoted: PromotedInfo[] = [];
  for (;;) {
    const practice = await m.findOneBy(CourseSlot, { id: practiceId });
    if (!practice || practice.enrolledCount >= practice.capacity) return promoted;

    const next = await m.findOne(WaitlistEntry, {
      where: { practice: { id: practiceId } },
      order: { id: 'ASC' },
      relations: { student: true, course: { slots: true, prerequisites: true } }
    });
    if (!next) return promoted;

    if (await eligibilityProblem(m, next.student, next.course)) {
      await m.delete(WaitlistEntry, next.id); // már nem jogosult → kikerül a sorból
      continue;
    }

    // csak olyan előadás jöhet szóba, amely nem ütközik az órarenddel
    const allLectures = next.course.slots.filter((s) => s.type === 'lecture').sort((a, b) => a.id - b.id);
    const lectures: CourseSlot[] = [];
    for (const l of allLectures) {
      if (!(await scheduleConflict(m, next.student.id, [l, practice]))) lectures.push(l);
    }
    if (lectures.length === 0) {
      await m.delete(WaitlistEntry, next.id); // időközben órarendi ütközés alakult ki → kikerül a sorból
      continue;
    }

    // szabad előadás keresése
    let lecture: CourseSlot | null = null;
    for (const l of lectures) {
      if (await tryReserveSeat(m, l.id)) { lecture = l; break; }
    }
    if (!lecture) return promoted; // nincs szabad előadási hely, a hallgató a sorban marad

    if (!(await tryReserveSeat(m, practiceId))) {
      await releaseSeat(m, lecture.id);
      return promoted;
    }

    await m.save(Enrollment, m.create(Enrollment, {
      student: next.student, course: next.course, lecture, practice, status: 'Véglegesítve'
    }));
    await m.delete(WaitlistEntry, next.id);

    promoted.push({
      studentName: next.student.name,
      studentEmail: next.student.email,
      courseCode: next.course.code,
      courseTitle: next.course.title,
      lectureLabel: `${lecture.name} (${lecture.schedule}, ${lecture.location})`,
      practiceLabel: `${practice.name} (${practice.schedule}, ${practice.location})`
    });
  }
}
