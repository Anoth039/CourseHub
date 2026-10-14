import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { AppDataSource, ensureDatabase } from './data-source';
import { seedIfEmpty } from './seed';
import { authRouter } from './routes/auth';
import { courseRouter } from './routes/courses';
import { enrollmentRouter } from './routes/enrollments';
import { waitlistRouter } from './routes/waitlist';
import { verifyMailer } from './mailer';

async function main() {
  await ensureDatabase();
  await AppDataSource.initialize();
  await seedIfEmpty();

  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200' }));
  app.use(express.json());

  app.use('/api/auth', authRouter);
  app.use('/api/courses', courseRouter);
  app.use('/api/enrollments', enrollmentRouter);
  app.use('/api/waitlist', waitlistRouter);

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => console.log(`API fut: http://localhost:${port}/api`));
  void verifyMailer(); // csak naplóz, nem blokkol
}

main().catch((err) => {
  console.error('Indítási hiba (fut a MySQL/WAMP, és helyesek a .env adatok?):', err);
  process.exit(1);
});
