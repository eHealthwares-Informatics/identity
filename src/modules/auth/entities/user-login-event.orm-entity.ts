import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_login_events')
@Index('idx_user_login_events_user', ['userId'])
export class UserLoginEventOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'event_type', type: 'text' })
  eventType!: 'login' | 'refresh';

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}