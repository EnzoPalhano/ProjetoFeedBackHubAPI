import { compare, hash } from 'bcryptjs';

import { UserRole } from '../enums/user-role';
import {
  type PublicUserListItem,
  type UserRepository,
  type UserWithoutPassword
} from '../repositories/user-repository';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError
} from '../utils/app-error';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
}

export type CreateUserOutput = Pick<
  UserWithoutPassword,
  'id' | 'name' | 'email' | 'role'
>;

export interface LoginInput {
  email: string;
  password: string;
}

export type LoginOutput = Pick<
  UserWithoutPassword,
  'id' | 'name' | 'email' | 'role'
>;

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
}

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async createUser(data: CreateUserInput): Promise<CreateUserOutput> {
    const existingUser = await this.userRepository.findUserByEmail(data.email);

    if (existingUser) {
      throw new ConflictError('Email já cadastrado');
    }

    const passwordHash = await hash(data.password, 12);

    const user = await this.userRepository.createUser({
      name: data.name,
      email: data.email,
      passwordHash,
      role: UserRole.USER
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
  }

  async login(data: LoginInput): Promise<LoginOutput> {
    const user = await this.userRepository.findUserByEmail(data.email);

    if (!user) {
      throw new UnauthorizedError('Credenciais invalidas');
    }

    const passwordMatches = await compare(data.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedError('Credenciais invalidas');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
  }

  async listUsers(): Promise<PublicUserListItem[]> {
    const users = await this.userRepository.listUsers();
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      karma: user.karma
    }));
  }

  async getUserById(id: string): Promise<UserWithoutPassword> {
    const user = await this.userRepository.findUserById(id);
    if (!user) throw new NotFoundError('Usuário não encontrado');
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      karma: user.karma,
      createdAt: user.createdAt
    };
  }

  async updateUser(
    id: string,
    data: UpdateUserInput,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<UserWithoutPassword> {
    const user = await this.userRepository.findUserById(id);
    if (!user) throw new NotFoundError('Usuário não encontrado');

    const isOwner = user.id === requesterId;
    const isAdmin = requesterRole === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('Sem permissão para atualizar este usuário');
    }

    if (data.email && data.email !== user.email) {
      const existing = await this.userRepository.findUserByEmail(data.email);
      if (existing) throw new ConflictError('Email já cadastrado');
    }

    let passwordHash: string | undefined;
    if (data.password) {
      passwordHash = await hash(data.password, 12);
    }

    const updated = await this.userRepository.updateUser(id, {
      name: data.name,
      email: data.email,
      passwordHash
    });

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      karma: updated.karma,
      createdAt: updated.createdAt
    };
  }

  async deleteUser(
    id: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<void> {
    const user = await this.userRepository.findUserById(id);
    if (!user) throw new NotFoundError('Usuário não encontrado');

    const isOwner = user.id === requesterId;
    const isAdmin = requesterRole === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('Sem permissão para deletar este usuário');
    }

    await this.userRepository.deleteUser(id);
  }
}
