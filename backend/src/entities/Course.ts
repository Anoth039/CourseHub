import { Column, Entity, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './User';
import { CourseSlot } from './CourseSlot';

@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 120 })
  department: string;

  @Column({ type: 'int' })
  credits: number;

  @Column({ type: 'varchar', length: 40 })
  semester: string;

  @Column({ type: 'int' })
  recommendedSemester: number;

  @Column({ type: 'varchar', length: 30 })
  completionType: string;

  @Column({ type: 'text' })
  description: string;

  @ManyToOne(() => User, (u) => u.courses, { onDelete: 'SET NULL', nullable: true })
  owner: User | null;

  /** Opcionális előfeltételek: ezeket a kurzusokat előbb mind teljesíteni kell. */
  @ManyToMany(() => Course)
  @JoinTable({ name: 'course_prerequisites' })
  prerequisites: Course[];

  @OneToMany(() => CourseSlot, (s) => s.course, { cascade: true })
  slots: CourseSlot[];
}
