import { Repository } from 'typeorm';
import { UserRepository } from './user.repository';
import { User } from '../domains/user.entity';
import { UserOrmEntity } from '../entities/user.orm-entity';
export declare class TypeormUserRepository implements UserRepository {
    private readonly userRepository;
    constructor(userRepository: Repository<UserOrmEntity>);
    findByUsername(username: string, organizationId?: string | null): Promise<User | null>;
    findById(id: string, organizationId?: string | null): Promise<User | null>;
    create(user: User): Promise<User>;
    update(user: User, organizationId?: string | null): Promise<User>;
    delete(id: string, organizationId: string): Promise<void>;
    list(offset: number, limit: number, organizationId: string): Promise<{
        items: User[];
        total: number;
    }>;
}
