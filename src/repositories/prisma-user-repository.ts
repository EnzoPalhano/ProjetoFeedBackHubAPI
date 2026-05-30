import type { User } from '@prisma/client';

import { prisma } from '../lib/prisma';
import {
  type CreateUserRepositoryInput,
  type UpdateUserRepositoryInput,
  type UserRecord,
  type UserRepository,
  type UserWithoutPassword
} from './user-repository';

function toUserRecord(user: User): UserRecord {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role,
    karma: user.karma,
    createdAt: user.createdAt
  };
}

function toUserWithoutPassword(user: User): UserWithoutPassword {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    karma: user.karma,
    createdAt: user.createdAt
  };
}

export class PrismaUserRepository implements UserRepository {
  async createUser(data: CreateUserRepositoryInput): Promise<UserRecord> {
    const user = await prisma.user.create({
      data
    });

    return toUserRecord(user);
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const user = await prisma.user.findUnique({
      where: {
        email
      }
    });

    return user ? toUserRecord(user) : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? toUserRecord(user) : null;
  }

  async listUsers(): Promise<UserWithoutPassword[]> {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return users.map(toUserWithoutPassword);
  }

  async updateUser(id: string, data: UpdateUserRepositoryInput): Promise<UserRecord> {
    const user = await prisma.user.update({ where: { id }, data });
    return toUserRecord(user);
  }

  async deleteUser(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }
}
