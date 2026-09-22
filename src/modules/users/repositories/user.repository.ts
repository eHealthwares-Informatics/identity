import { User } from '../domains/user.entity';

export interface UserRepository {
  findByUsername(username: string, organizationId?: string | null): Promise<User | null>;
  findByPhone(phone: string, organizationId?: string | null): Promise<User | null>;
  findByEmail(email: string, organizationId?: string | null): Promise<User | null>;
  findById(id: string, organizationId?: string | null): Promise<User | null>;
  create(user: User): Promise<User>;
  update(user: User, organizationId?: string | null): Promise<User>;
  delete(id: string, organizationId: string): Promise<void>;
  list(offset: number, limit: number, organizationId: string): Promise<{ items: User[]; total: number }>;
}
