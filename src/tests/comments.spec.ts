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

const commentResponseSchema = z.object({
  id: z.string(),
  content: z.string(),
  userId: z.string(),
  postId: z.string(),
  score: z.number().int(),
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

async function createPost(
  app: ReturnType<typeof buildApp>,
  token: string
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/posts',
    headers: { authorization: `Bearer ${token}` },
    payload: { title: 'Post de teste', content: 'Conteudo do post de teste para comentarios' }
  });
  const { id } = postResponseSchema.parse(res.json());
  return id;
}

describe('Comments routes', () => {
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

  it('creates a comment on a post when authenticated', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const postId = await createPost(app, token);

    const response = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${token}` },
      payload: { content: 'Meu comentário aqui' }
    });

    expect(response.statusCode).toBe(201);
    const body = commentResponseSchema.parse(response.json());
    expect(body.content).toBe('Meu comentário aqui');
    expect(body.postId).toBe(postId);
  });

  it('fails to create comment without token', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const postId = await createPost(app, token);

    const response = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/comments`,
      payload: { content: 'Comentário sem token' }
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 404 when creating comment on non-existent post', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const response = await app.inject({
      method: 'POST',
      url: '/posts/post-inexistente/comments',
      headers: { authorization: `Bearer ${token}` },
      payload: { content: 'Comentário em post inexistente' }
    });

    expect(response.statusCode).toBe(404);
  });

  it('comment appears in the post when fetched by id', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const postId = await createPost(app, token);

    await app.inject({
      method: 'POST',
      url: `/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${token}` },
      payload: { content: 'Comentário que deve aparecer no post' }
    });

    const response = await app.inject({
      method: 'GET',
      url: `/posts/${postId}`,
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0].content).toBe('Comentário que deve aparecer no post');
  });

  it('owner can update comment', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const postId = await createPost(app, token);

    const createRes = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${token}` },
      payload: { content: 'Comentário original aqui' }
    });

    const { id } = commentResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'PUT',
      url: `/comments/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { content: 'Comentário atualizado agora' }
    });

    expect(response.statusCode).toBe(200);
    const body = commentResponseSchema.parse(response.json());
    expect(body.content).toBe('Comentário atualizado agora');
  });

  it('non-owner cannot update comment', async () => {
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

    const postId = await createPost(app, ownerToken);

    const createRes = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { content: 'Comentário do dono aqui' }
    });

    const { id } = commentResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'PUT',
      url: `/comments/${id}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { content: 'Tentando editar comentário alheio' }
    });

    expect(response.statusCode).toBe(403);
    const body = errorResponseSchema.parse(response.json());
    expect(body.message).toBeTruthy();
  });

  it('admin can update any comment', async () => {
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

    const postId = await createPost(app, userToken);

    const createRes = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { content: 'Comentário que o admin vai editar' }
    });

    const { id } = commentResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'PUT',
      url: `/comments/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { content: 'Editado pelo administrador do sistema' }
    });

    expect(response.statusCode).toBe(200);
    const body = commentResponseSchema.parse(response.json());
    expect(body.content).toBe('Editado pelo administrador do sistema');
  });

  it('owner can delete comment', async () => {
    const token = await createUserAndLogin(app, {
      name: 'Joao Silva',
      email: 'joao@email.com',
      password: '123456'
    });

    const postId = await createPost(app, token);

    const createRes = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${token}` },
      payload: { content: 'Comentário para deletar agora' }
    });

    const { id } = commentResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'DELETE',
      url: `/comments/${id}`,
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(204);
  });

  it('non-owner cannot delete comment', async () => {
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

    const postId = await createPost(app, ownerToken);

    const createRes = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { content: 'Comentário protegido do dono aqui' }
    });

    const { id } = commentResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'DELETE',
      url: `/comments/${id}`,
      headers: { authorization: `Bearer ${otherToken}` }
    });

    expect(response.statusCode).toBe(403);
  });

  it('admin can delete any comment', async () => {
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

    const postId = await createPost(app, userToken);

    const createRes = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: { content: 'Comentário que o admin vai deletar' }
    });

    const { id } = commentResponseSchema.parse(createRes.json());

    const response = await app.inject({
      method: 'DELETE',
      url: `/comments/${id}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    expect(response.statusCode).toBe(204);
  });
});
