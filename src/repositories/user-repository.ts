import type { UserRole } from '../enums/user-role';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  karma: number;
  createdAt: Date;
}

export type UserWithoutPassword = Omit<UserRecord, 'passwordHash'>;

export type PublicUserListItem = Pick<
  UserWithoutPassword,
  'id' | 'name' | 'email' | 'role' | 'karma'
>;

export interface CreateUserRepositoryInput {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

export interface UserRepository {
  createUser(data: CreateUserRepositoryInput): Promise<UserRecord>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  listUsers(): Promise<UserWithoutPassword[]>;
}
