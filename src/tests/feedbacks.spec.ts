import { hash } from 'bcryptjs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { buildApp } from '../app';
import { UserRole } from '../enums/user-role';
import { prisma } from '../lib/prisma';

const loginResponseSchema = z.object({ token: z.string().min(1) });

const feedbackResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']),
  authorId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const errorResponseSchema = z.object({ message: z.string() });

async function createUserAndLogin(
  app: ReturnType<typeof buildApp>,
  opts: { name: string; email: string; password: string; role?: UserRole }
): Promise<string> {
  if (opts.role === UserRole.ADMIN) {
    const passwordHash = await hash(opts.password, 12);
    await prisma.user.create({
      data: { name: opts.name, email: opts.email, passwordHash, role: UserRole.ADMIN }
    });
  } else {
    await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: opts.name, email: opts.email, password: opts.password }
    });
  }

  const loginRes = await app.inject({
    method: 'POST',
    url: '/login',
    payload: { email: opts.email, password: opts.password }
  });

  const { token } = loginResponseSchema.parse(loginRes.json());
  return token;
}

describe('Feedbacks routes', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await prisma.feedback.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.feedback.deleteMany();
    await prisma.user.deleteMany();
  });

  it('creates a feedback when authenticated', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const response = await app.inject({
      method: 'POST',
      url: '/feedbacks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Meu feedback', description: 'Descrição do feedback aqui' }
    });

    expect(response.statusCode).toBe(201);
    const body = feedbackResponseSchema.parse(response.json());
    expect(body.title).toBe('Meu feedback');
    expect(body.status).toBe('OPEN');
  });

  it('fails to create feedback without token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/feedbacks',
      payload: { title: 'Meu feedback', description: 'Descrição longa aqui' }
    });

    expect(response.statusCode).toBe(401);
  });

  it('fails to create feedback with invalid payload', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const response = await app.inject({
      method: 'POST',
      url: '/feedbacks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Oi', description: 'Ok' }
    });

    expect(response.statusCode).toBe(400);
    const body = errorResponseSchema.parse(response.json());
    expect(body.message).toBeTruthy();
  });

  it('lists feedbacks without authentication', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    await app.inject({
      method: 'POST',
      url: '/feedbacks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Feedback um', description: 'Primeira descrição aqui' }
    });

    const response = await app.inject({ method: 'GET', url: '/feedbacks' });

    expect(response.statusCode).toBe(200);
    const body = z.array(feedbackResponseSchema).parse(response.json());
    expect(body).toHaveLength(1);
  });

  it('filters feedbacks by status', async () => {
    const adminToken = await createUserAndLogin(app, {
      name: 'Admin',
      email: 'admin@email.com',
      password: '123456',
      role: UserRole.ADMIN
    });

    const userToken = await createUserAndLogin(app, {
      name: 'Joao',
      email: 'joao@email.com',
      password: '123456'
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/feedbacks',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { title: 'Feedback aberto', description: 'Esse está aberto mesmo' }
    });

    const { id } = feedbackResponseSchema.parse(createRes.json());

    await app.inject({
      method: 'PUT',
      url: `/feedbacks/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'DONE' }
    });

    await app.inject({
      method: 'POST',
      url: '/feedbacks',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { title: 'Outro feedback', description: 'Esse ainda está aberto' }
    });

    const openRes = await app.inject({ method: 'GET', url: '/feedbacks?status=OPEN' });
    const openBody = z.array(feedbackResponseSchema).parse(openRes.json());
    expect(openBody).toHaveLength(1);
    expect(openBody[0]?.status).toBe('OPEN');

    const doneRes = await app.inject({ method: 'GET', url: '/feedbacks?status=DONE' });
    const doneBody = z.array(feedbackResponseSchema).parse(doneRes.json());
    expect(doneBody).toHaveLength(1);
    expect(doneBody[0]?.status).toBe('DONE');
  });

  it('gets a feedback by id', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/feedbacks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Busca por id', description: 'Descrição para busca por id' }
    });

    const { id } = feedbackResponseSchema.parse(createRes.json());

    const response = await app.inject({ method: 'GET', url: `/feedbacks/${id}` });

    expect(response.statusCode).toBe(200);
    const body = feedbackResponseSchema.parse(response.json());
    expect(body.id).toBe(id);
  });

  it('returns 404 for non-existent feedback', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/feedbacks/id-que-nao-existe'
    });

    expect(response.statusCode).toBe(404);
  });

  it('owner can update title and description', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/feedbacks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Titulo original', description: 'Descricao original aqui mesmo' }
    });

    const { id } = feedbackResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'PUT',
      url: `/feedbacks/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Titulo atualizado' }
    });

    expect(response.statusCode).toBe(200);
    const body = feedbackResponseSchema.parse(response.json());
    expect(body.title).toBe('Titulo atualizado');
  });

  it('non-owner cannot update feedback', async () => {
    const ownerToken = await createUserAndLogin(app, {
      name: 'Dono',
      email: 'dono@email.com',
      password: '123456'
    });

    const otherToken = await createUserAndLogin(app, {
      name: 'Outro',
      email: 'outro@email.com',
      password: '123456'
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/feedbacks',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { title: 'Feedback do dono', description: 'Apenas o dono pode editar' }
    });

    const { id } = feedbackResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'PUT',
      url: `/feedbacks/${id}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { title: 'Tentando editar' }
    });

    expect(response.statusCode).toBe(403);
  });

  it('non-admin user cannot change status', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/feedbacks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Feedback status', description: 'Tentando mudar status sem ser admin' }
    });

    const { id } = feedbackResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'PUT',
      url: `/feedbacks/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'DONE' }
    });

    expect(response.statusCode).toBe(403);
  });

  it('admin can change feedback status', async () => {
    const userToken = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const adminToken = await createUserAndLogin(app, {
      name: 'Admin',
      email: 'admin@email.com',
      password: '123456',
      role: UserRole.ADMIN
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/feedbacks',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { title: 'Mudar status', description: 'Admin vai mudar o status deste' }
    });

    const { id } = feedbackResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'PUT',
      url: `/feedbacks/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'IN_PROGRESS' }
    });

    expect(response.statusCode).toBe(200);
    const body = feedbackResponseSchema.parse(response.json());
    expect(body.status).toBe('IN_PROGRESS');
  });

  it('owner can delete their feedback', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/feedbacks',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Para deletar', description: 'Este feedback sera deletado pelo dono' }
    });

    const { id } = feedbackResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'DELETE',
      url: `/feedbacks/${id}`,
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(204);

    const getRes = await app.inject({ method: 'GET', url: `/feedbacks/${id}` });
    expect(getRes.statusCode).toBe(404);
  });

  it('non-owner cannot delete feedback', async () => {
    const ownerToken = await createUserAndLogin(app, {
      name: 'Dono',
      email: 'dono@email.com',
      password: '123456'
    });

    const otherToken = await createUserAndLogin(app, {
      name: 'Outro',
      email: 'outro@email.com',
      password: '123456'
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/feedbacks',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { title: 'Nao pode deletar', description: 'Apenas o dono pode deletar este' }
    });

    const { id } = feedbackResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'DELETE',
      url: `/feedbacks/${id}`,
      headers: { authorization: `Bearer ${otherToken}` }
    });

    expect(response.statusCode).toBe(403);
  });

  it('admin can delete any feedback', async () => {
    const userToken = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const adminToken = await createUserAndLogin(app, {
      name: 'Admin',
      email: 'admin@email.com',
      password: '123456',
      role: UserRole.ADMIN
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/feedbacks',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { title: 'Admin vai deletar', description: 'Admin tem poder de deletar qualquer um' }
    });

    const { id } = feedbackResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'DELETE',
      url: `/feedbacks/${id}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(response.statusCode).toBe(204);
  });
});
