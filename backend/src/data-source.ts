import 'reflect-metadata';
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { DataSource } from 'typeorm';
import { User } from './entities/User';
import { Course } from './entities/Course';
import { CourseSlot } from './entities/CourseSlot';
import { Enrollment } from './entities/Enrollment';
import { WaitlistEntry } from './entities/WaitlistEntry';

const cfg = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USERNAME || process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'coursehub'
};

console.log(`MySQL kapcsolat: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: cfg.host,
  port: cfg.port,
  username: cfg.user, // TypeORM-nál "username", nem "user"
  password: cfg.password,
  database: cfg.database,
  charset: 'utf8mb4',
  synchronize: true, // fejlesztéshez: automatikusan létrehozza/frissíti a táblákat
  entities: [User, Course, CourseSlot, Enrollment, WaitlistEntry]
});

/** Létrehozza az adatbázist, ha még nem létezik. */
export async function ensureDatabase(): Promise<void> {
  const conn = await mysql.createConnection({
    host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password
  });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci`
  );
  await conn.end();
}
