import { hash } from 'bcryptjs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { buildApp } from '../app';
import { UserRole } from '../enums/user-role';
import { prisma } from '../lib/prisma';

const loginResponseSchema = z.object({ token: z.string().min(1) });

const postResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  userId: z.string(),
  score: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const postWithCommentsSchema = postResponseSchema.extend({
  comments: z.array(z.object({ id: z.string() }))
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

describe('Posts routes', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await prisma.vote.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.vote.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.post.deleteMany();
    await prisma.user.deleteMany();
  });

  it('creates a post when authenticated', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const response = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Meu primeiro post', content: 'Conteúdo do meu primeiro post aqui' }
    });

    expect(response.statusCode).toBe(201);
    const body = postResponseSchema.parse(response.json());
    expect(body.title).toBe('Meu primeiro post');
    expect(body.score).toBe(0);
  });

  it('fails to create post without token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/posts',
      payload: { title: 'Post sem token', content: 'Conteudo sem autenticacao aqui' }
    });

    expect(response.statusCode).toBe(401);
  });

  it('fails to create post with invalid payload', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const response = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Ok', content: 'Curto' }
    });

    expect(response.statusCode).toBe(400);
    const body = errorResponseSchema.parse(response.json());
    expect(body.message).toBeTruthy();
  });

  it('lists posts when authenticated', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Post para listar', content: 'Conteudo do post que sera listado aqui' }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/posts',
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(200);
    const body = z.array(postResponseSchema).parse(response.json());
    expect(body).toHaveLength(1);
  });

  it('gets a post by id with comments', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Post para buscar', content: 'Conteudo do post que sera buscado por id' }
    });

    const { id } = postResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'GET',
      url: `/posts/${id}`,
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(200);
    const body = postWithCommentsSchema.parse(response.json());
    expect(body.id).toBe(id);
    expect(body.comments).toHaveLength(0);
  });

  it('returns 404 for non-existent post', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const response = await app.inject({
      method: 'GET',
      url: '/posts/id-que-nao-existe',
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(404);
  });

  it('owner can update post', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Titulo original', content: 'Conteudo original do post que sera editado' }
    });

    const { id } = postResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'PUT',
      url: `/posts/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Titulo atualizado' }
    });

    expect(response.statusCode).toBe(200);
    const body = postResponseSchema.parse(response.json());
    expect(body.title).toBe('Titulo atualizado');
  });

  it('non-owner cannot update post', async () => {
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
      url: '/posts',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { title: 'Post do dono', content: 'Apenas o dono pode editar este post aqui' }
    });

    const { id } = postResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'PUT',
      url: `/posts/${id}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { title: 'Tentando editar' }
    });

    expect(response.statusCode).toBe(403);
  });

  it('admin can update any post', async () => {
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
      url: '/posts',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { title: 'Post do usuario', content: 'Admin vai editar este post de outro usuario' }
    });

    const { id } = postResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'PUT',
      url: `/posts/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { title: 'Editado pelo admin' }
    });

    expect(response.statusCode).toBe(200);
    const body = postResponseSchema.parse(response.json());
    expect(body.title).toBe('Editado pelo admin');
  });

  it('owner can delete post', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Post para deletar', content: 'Este post sera deletado pelo proprio dono' }
    });

    const { id } = postResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'DELETE',
      url: `/posts/${id}`,
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(204);

    const getRes = await app.inject({
      method: 'GET',
      url: `/posts/${id}`,
      headers: { authorization: `Bearer ${token}` }
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('non-owner cannot delete post', async () => {
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
      url: '/posts',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { title: 'Post protegido', content: 'Apenas o dono pode deletar este post aqui' }
    });

    const { id } = postResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'DELETE',
      url: `/posts/${id}`,
      headers: { authorization: `Bearer ${otherToken}` }
    });

    expect(response.statusCode).toBe(403);
  });

  it('admin can delete any post', async () => {
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
      url: '/posts',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { title: 'Admin vai deletar', content: 'Admin tem poder de deletar qualquer post' }
    });

    const { id } = postResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'DELETE',
      url: `/posts/${id}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(response.statusCode).toBe(204);
  });
});
