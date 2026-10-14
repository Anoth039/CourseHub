import bcrypt from 'bcryptjs';
import { AppDataSource } from './data-source';
import { User } from './entities/User';

const INITIAL_PASSWORD = 'Jelszo123';

export async function seedIfEmpty(): Promise<void> {
  const userRepo = AppDataSource.getRepository(User);
  if ((await userRepo.count()) > 0) return;

  const passwordHash = await bcrypt.hash(INITIAL_PASSWORD, 10);

  await userRepo.save(userRepo.create({
    name: 'Kovács Alex', email: 'alex.kovacs@egyetem.hu', passwordHash, role: 'student',
    studentId: 'N88492', major: 'Mérnökinformatika BSc', semester: 4, maxCredits: 30
  }));
  await userRepo.save(userRepo.create({
    name: 'Szabó Dóra', email: 'dora.szabo@egyetem.hu', passwordHash, role: 'student',
    studentId: 'N77310', major: 'Mérnökinformatika BSc', semester: 6, maxCredits: 30
  }));
  await userRepo.save(userRepo.create({
    name: 'Dr. Rostova Elena', email: 'elena.rostova@egyetem.hu', passwordHash, role: 'instructor',
    title: 'Egyetemi Docens', department: 'Informatikai Intézet'
  }));
  await userRepo.save(userRepo.create({
    name: 'Prof. Vance Marcus', email: 'marcus.vance@egyetem.hu', passwordHash, role: 'instructor',
    title: 'Egyetemi Tanár', department: 'Informatikai Intézet'
  }));
  await userRepo.save(userRepo.create({
    name: 'Dr. Lin Sarah', email: 'sarah.lin@egyetem.hu', passwordHash, role: 'instructor',
    title: 'Adjunktus', department: 'Adattudományi Tanszék'
  }));

  console.log(`Kezdő felhasználók létrehozva. Jelszavuk: ${INITIAL_PASSWORD}`);
}
