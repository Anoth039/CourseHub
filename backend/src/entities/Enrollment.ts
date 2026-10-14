import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from './User';
import { Course } from './Course';
import { CourseSlot } from './CourseSlot';

@Entity('enrollments')
@Unique(['student', 'course'])
export class Enrollment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (u) => u.enrollments, { onDelete: 'CASCADE', nullable: false })
  student: User;

  @ManyToOne(() => Course, { onDelete: 'CASCADE', nullable: false })
  course: Course;

  @ManyToOne(() => CourseSlot, { onDelete: 'CASCADE', nullable: false })
  lecture: CourseSlot;

  @ManyToOne(() => CourseSlot, { onDelete: 'CASCADE', nullable: false })
  practice: CourseSlot;

  @Column({ type: 'varchar', length: 20, default: 'Véglegesítve' })
  status: string;

  @CreateDateColumn()
  enrolledAt: Date;
}
