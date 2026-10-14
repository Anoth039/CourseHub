import { CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from './User';
import { Course } from './Course';
import { CourseSlot } from './CourseSlot';

/** Várólista-bejegyzés: egy hallgató egy betelt gyakorlati csoportra vár. */
@Entity('waitlist_entries')
@Unique(['student', 'course'])
export class WaitlistEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  student: User;

  @ManyToOne(() => Course, { onDelete: 'CASCADE', nullable: false })
  course: Course;

  @ManyToOne(() => CourseSlot, { onDelete: 'CASCADE', nullable: false })
  practice: CourseSlot;

  @CreateDateColumn()
  createdAt: Date;
}
