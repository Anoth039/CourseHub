import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Course } from './Course';
import { Enrollment } from './Enrollment';

export type Role = 'student' | 'instructor';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 160, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20 })
  role: Role;

  // hallgatói mezők
  @Column({ type: 'varchar', length: 20, nullable: true })
  studentId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  major: string | null;

  @Column({ type: 'int', nullable: true })
  semester: number | null;

  @Column({ type: 'int', nullable: true })
  maxCredits: number | null;

  // oktatói mezők
  @Column({ type: 'varchar', length: 80, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  department: string | null;

  /** Korábban teljesített kurzusok (az előfeltétel-ellenőrzéshez). */
  @ManyToMany(() => Course)
  @JoinTable({ name: 'user_completed_courses' })
  completedCourses: Course[];

  @OneToMany(() => Course, (c) => c.owner)
  courses: Course[];

  @OneToMany(() => Enrollment, (e) => e.student)
  enrollments: Enrollment[];
}
