import { EntityManager, In } from 'typeorm';
import { CourseSlot } from './entities/CourseSlot';
import { User } from './entities/User';
import { HttpError } from './enrollment-rules';
import { schedulesOverlap } from './schedule';

/** Egy mentendő óra: ki tartja, mikor, és hogyan hivatkozunk rá a hibaüzenetben. */
export interface PlannedSlot { instructorId: number; schedule: string; label: string; }

/** Az oktató órái (előadás vagy gyakorlat) – régi, NULL oktatós sávoknál a kurzus tulajdonosáé. */
export async function slotsLedBy(m: EntityManager, instructorId: number, excludeCourseId?: number) {
  const qb = m.createQueryBuilder(CourseSlot, 's')
    .innerJoinAndSelect('s.course', 'c')
    .leftJoin('c.owner', 'o')
    .where('(s.instructorUserId = :id OR (s.instructorUserId IS NULL AND o.id = :id))', { id: instructorId });
  if (excludeCourseId != null) qb.andWhere('c.id <> :ex', { ex: excludeCourseId });
  return qb.getMany();
}

/**
 * Ellenőrzi, hogy a megadott oktatók léteznek-e, és hogy a tervezett órák nem ütköznek
 * sem egymással, sem az oktatók más kurzusokban tartott óráival.
 * Visszaadja az oktatók adatait (id → User).
 */
export async function assertInstructorsFree(
  m: EntityManager, planned: PlannedSlot[], viewerId: number, excludeCourseId?: number
): Promise<Map<number, User>> {
  const ids = [...new Set(planned.map((p) => p.instructorId))];
  const users = await m.find(User, { where: { id: In(ids) } });
  const byId = new Map(users.map((u) => [u.id, u]));
  for (const id of ids) {
    const u = byId.get(id);
    if (!u || u.role !== 'instructor') throw new HttpError(400, 'A gyakorlatvezető csak létező oktató lehet.');
  }
  const who = (id: number) => (id === viewerId ? 'Ön' : byId.get(id)!.name);

  for (const id of ids) {
    const mine = planned.filter((p) => p.instructorId === id);

    // a most mentett órák egymással
    for (let i = 0; i < mine.length; i++) {
      for (let j = i + 1; j < mine.length; j++) {
        if (schedulesOverlap(mine[i].schedule, mine[j].schedule)) {
          throw new HttpError(409,
            `${who(id)} nem tarthat egyszerre két órát: „${mine[i].label}” (${mine[i].schedule}) és „${mine[j].label}” (${mine[j].schedule}).`);
        }
      }
    }

    // más kurzusokban már lefoglalt órák
    const others = await slotsLedBy(m, id, excludeCourseId);
    for (const p of mine) {
      const hit = others.find((s) => schedulesOverlap(s.schedule, p.schedule));
      if (hit) {
        throw new HttpError(409,
          `${who(id)} ekkor már tart órát: ${hit.course.code} – ${hit.name} (${hit.schedule}), ezért „${p.label}” nem vehető fel erre az időpontra (${p.schedule}).`);
      }
    }
  }
  return byId;
}
