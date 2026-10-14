import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Course } from './Course';
import { User } from './User';

export type SlotType = 'lecture' | 'practice';

@Entity('course_slots')
export class CourseSlot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  type: SlotType;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 80 })
  schedule: string;

  @Column({ type: 'varchar', length: 120 })
  instructor: string;

  @Column({ type: 'int', nullable: true })
  instructorUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'instructorUserId' })
  instructorUser: User | null;

  @Column({ type: 'varchar', length: 120 })
  location: string;

  @Column({ type: 'int' })
  capacity: number;

  @Column({ type: 'int', default: 0 })
  enrolledCount: number;

  @ManyToOne(() => Course, (c) => c.slots, { onDelete: 'CASCADE' })
  course: Course;
}
