import { buildApp } from '../app';
import { UserRole } from '../enums/user-role';
import { prisma } from '../lib/prisma';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

const createUserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole)
});

const errorResponseSchema = z.object({
  message: z.string()
});

const loginResponseSchema = z.object({
  token: z.string().min(1)
});

const usersListResponseSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    role: z.nativeEnum(UserRole),
    karma: z.number().int()
  })
);

describe('Users routes', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  it('creates a user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: 'Joao Silva',
        email: 'joao@email.com',
        password: '123456'
      }
    });

    expect(response.statusCode).toBe(201);
    const body = createUserResponseSchema.parse(response.json());

    expect(body.id).toBeTypeOf('string');
    expect(body).toMatchObject({
      name: 'Joao Silva',
      email: 'joao@email.com',
      role: 'USER'
    });

    const storedUser = await prisma.user.findUnique({
      where: {
        email: 'joao@email.com'
      }
    });

    expect(storedUser).not.toBeNull();
    expect(storedUser?.passwordHash).not.toBe('123456');
  });

  it('fails when email is duplicated', async () => {
    await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: 'Joao Silva',
        email: 'joao@email.com',
        password: '123456'
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: 'Joao Silva',
        email: 'joao@email.com',
        password: '654321'
      }
    });

    expect(response.statusCode).toBe(409);
    const body = errorResponseSchema.parse(response.json());

    expect(body).toEqual({
      message: 'Email já cadastrado'
    });
  });

  it('fails validation for invalid payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: 'Jo',
        email: 'email-invalido',
        password: '123'
      }
    });

    expect(response.statusCode).toBe(400);
    const body = errorResponseSchema.parse(response.json());

    expect(body).toEqual({
      message: 'O nome deve ter no mínimo 3 caracteres'
    });
  });

  it('returns 401 when listing users without a token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/users'
    });

    expect(response.statusCode).toBe(401);
    const body = errorResponseSchema.parse(response.json());

    expect(body).toEqual({
      message: 'Não autorizado'
    });
  });

  it('logs in with valid credentials', async () => {
    await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: 'Joao Silva',
        email: 'joao@email.com',
        password: '123456'
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/login',
      payload: {
        email: 'joao@email.com',
        password: '123456'
      }
    });

    expect(response.statusCode).toBe(200);
    const body = loginResponseSchema.parse(response.json());

    expect(body.token).toBeTypeOf('string');
  });

  it('fails login with invalid credentials', async () => {
    await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: 'Joao Silva',
        email: 'joao@email.com',
        password: '123456'
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/login',
      payload: {
        email: 'joao@email.com',
        password: 'senha-errada'
      }
    });

    expect(response.statusCode).toBe(401);
    const body = errorResponseSchema.parse(response.json());

    expect(body).toEqual({
      message: 'Credenciais invalidas'
    });
  });

  it('lists users when authenticated', async () => {
    await app.inject({
      method: 'POST',
      url: '/users',
      payload: {
        name: 'Joao Silva',
        email: 'joao@email.com',
        password: '123456'
      }
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/login',
      payload: {
        email: 'joao@email.com',
        password: '123456'
      }
    });

    const { token } = loginResponseSchema.parse(loginResponse.json());

    const response = await app.inject({
      method: 'GET',
      url: '/users',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = usersListResponseSchema.parse(response.json());

    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBeTypeOf('string');
    expect(body[0]).toMatchObject({
      name: 'Joao Silva',
      email: 'joao@email.com',
      role: 'USER',
      karma: 0
    });
  });
});
