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

async function createUserAndLogin(
  app: ReturnType<typeof buildApp>,
  opts: { name: string; email: string; password: string; role?: UserRole }
): Promise<{ token: string; userId: string }> {
  if (opts.role === UserRole.ADMIN) {
    const passwordHash = await hash(opts.password, 12);
    const user = await prisma.user.create({
      data: { name: opts.name, email: opts.email, passwordHash, role: UserRole.ADMIN }
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/login',
      payload: { email: opts.email, password: opts.password }
    });
    const { token } = loginResponseSchema.parse(loginRes.json());
    return { token, userId: user.id };
  }

  const createRes = await app.inject({
    method: 'POST',
    url: '/users',
    payload: { name: opts.name, email: opts.email, password: opts.password }
  });

  const { id: userId } = z.object({ id: z.string() }).parse(createRes.json());

  const loginRes = await app.inject({
    method: 'POST',
    url: '/login',
    payload: { email: opts.email, password: opts.password }
  });

  const { token } = loginResponseSchema.parse(loginRes.json());
  return { token, userId };
}

async function createPost(
  app: ReturnType<typeof buildApp>,
  token: string
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/posts',
    headers: { authorization: `Bearer ${token}` },
    payload: { title: 'Post para votos', content: 'Conteudo do post que recebera votos aqui' }
  });
  const { id } = postResponseSchema.parse(res.json());
  return id;
}

async function createComment(
  app: ReturnType<typeof buildApp>,
  token: string,
  postId: string
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: `/posts/${postId}/comments`,
    headers: { authorization: `Bearer ${token}` },
    payload: { content: 'Comentário para receber votos' }
  });
  const { id } = commentResponseSchema.parse(res.json());
  return id;
}

describe('Votes routes', () => {
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

  it('user can upvote a post', async () => {
    const { token: authorToken } = await createUserAndLogin(app, {
      name: 'Autor',
      email: 'autor@email.com',
      password: '123456'
    });

    const { token: voterToken } = await createUserAndLogin(app, {
      name: 'Votador',
      email: 'votador@email.com',
      password: '123456'
    });

    const postId = await createPost(app, authorToken);

    const response = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/vote`,
      headers: { authorization: `Bearer ${voterToken}` },
      payload: { value: true }
    });

    expect(response.statusCode).toBe(204);

    const post = await prisma.post.findUnique({ where: { id: postId } });
    expect(post?.score).toBe(1);
  });

  it('user can downvote a post', async () => {
    const { token: authorToken } = await createUserAndLogin(app, {
      name: 'Autor',
      email: 'autor@email.com',
      password: '123456'
    });

    const { token: voterToken } = await createUserAndLogin(app, {
      name: 'Votador',
      email: 'votador@email.com',
      password: '123456'
    });

    const postId = await createPost(app, authorToken);

    const response = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/vote`,
      headers: { authorization: `Bearer ${voterToken}` },
      payload: { value: false }
    });

    expect(response.statusCode).toBe(204);

    const post = await prisma.post.findUnique({ where: { id: postId } });
    expect(post?.score).toBe(-1);
  });

  it('user cannot vote on their own post', async () => {
    const { token } = await createUserAndLogin(app, {
      name: 'Autor',
      email: 'autor@email.com',
      password: '123456'
    });

    const postId = await createPost(app, token);

    const response = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/vote`,
      headers: { authorization: `Bearer ${token}` },
      payload: { value: true }
    });

    expect(response.statusCode).toBe(403);
  });

  it('voting again with same value is idempotent', async () => {
    const { token: authorToken } = await createUserAndLogin(app, {
      name: 'Autor',
      email: 'autor@email.com',
      password: '123456'
    });

    const { token: voterToken } = await createUserAndLogin(app, {
      name: 'Votador',
      email: 'votador@email.com',
      password: '123456'
    });

    const postId = await createPost(app, authorToken);

    await app.inject({
      method: 'POST',
      url: `/posts/${postId}/vote`,
      headers: { authorization: `Bearer ${voterToken}` },
      payload: { value: true }
    });

    await app.inject({
      method: 'POST',
      url: `/posts/${postId}/vote`,
      headers: { authorization: `Bearer ${voterToken}` },
      payload: { value: true }
    });

    const post = await prisma.post.findUnique({ where: { id: postId } });
    expect(post?.score).toBe(1);
  });

  it('changing vote updates score by 2', async () => {
    const { token: authorToken } = await createUserAndLogin(app, {
      name: 'Autor',
      email: 'autor@email.com',
      password: '123456'
    });

    const { token: voterToken } = await createUserAndLogin(app, {
      name: 'Votador',
      email: 'votador@email.com',
      password: '123456'
    });

    const postId = await createPost(app, authorToken);

    await app.inject({
      method: 'POST',
      url: `/posts/${postId}/vote`,
      headers: { authorization: `Bearer ${voterToken}` },
      payload: { value: true }
    });

    await app.inject({
      method: 'POST',
      url: `/posts/${postId}/vote`,
      headers: { authorization: `Bearer ${voterToken}` },
      payload: { value: false }
    });

    const post = await prisma.post.findUnique({ where: { id: postId } });
    expect(post?.score).toBe(-1);
  });

  it('removing an upvote decrements score by 1', async () => {
    const { token: authorToken } = await createUserAndLogin(app, {
      name: 'Autor',
      email: 'autor@email.com',
      password: '123456'
    });

    const { token: voterToken } = await createUserAndLogin(app, {
      name: 'Votador',
      email: 'votador@email.com',
      password: '123456'
    });

    const postId = await createPost(app, authorToken);

    await app.inject({
      method: 'POST',
      url: `/posts/${postId}/vote`,
      headers: { authorization: `Bearer ${voterToken}` },
      payload: { value: true }
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/posts/${postId}/vote`,
      headers: { authorization: `Bearer ${voterToken}` }
    });

    expect(response.statusCode).toBe(204);

    const post = await prisma.post.findUnique({ where: { id: postId } });
    expect(post?.score).toBe(0);
  });

  it('upvote on post increases author karma', async () => {
    const { token: authorToken, userId: authorId } = await createUserAndLogin(app, {
      name: 'Autor',
      email: 'autor@email.com',
      password: '123456'
    });

    const { token: voterToken } = await createUserAndLogin(app, {
      name: 'Votador',
      email: 'votador@email.com',
      password: '123456'
    });

    const postId = await createPost(app, authorToken);

    await app.inject({
      method: 'POST',
      url: `/posts/${postId}/vote`,
      headers: { authorization: `Bearer ${voterToken}` },
      payload: { value: true }
    });

    const author = await prisma.user.findUnique({ where: { id: authorId } });
    expect(author?.karma).toBe(1);
  });

  it('downvote on post decreases author karma', async () => {
    const { token: authorToken, userId: authorId } = await createUserAndLogin(app, {
      name: 'Autor',
      email: 'autor@email.com',
      password: '123456'
    });

    const { token: voterToken } = await createUserAndLogin(app, {
      name: 'Votador',
      email: 'votador@email.com',
      password: '123456'
    });

    const postId = await createPost(app, authorToken);

    await app.inject({
      method: 'POST',
      url: `/posts/${postId}/vote`,
      headers: { authorization: `Bearer ${voterToken}` },
      payload: { value: false }
    });

    const author = await prisma.user.findUnique({ where: { id: authorId } });
    expect(author?.karma).toBe(-1);
  });

  it('user can upvote a comment', async () => {
    const { token: authorToken } = await createUserAndLogin(app, {
      name: 'Autor',
      email: 'autor@email.com',
      password: '123456'
    });

    const { token: voterToken } = await createUserAndLogin(app, {
      name: 'Votador',
      email: 'votador@email.com',
      password: '123456'
    });

    const postId = await createPost(app, authorToken);
    const commentId = await createComment(app, authorToken, postId);

    const response = await app.inject({
      method: 'POST',
      url: `/comments/${commentId}/vote`,
      headers: { authorization: `Bearer ${voterToken}` },
      payload: { value: true }
    });

    expect(response.statusCode).toBe(204);

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    expect(comment?.score).toBe(1);
  });

  it('user cannot vote on their own comment', async () => {
    const { token } = await createUserAndLogin(app, {
      name: 'Autor',
      email: 'autor@email.com',
      password: '123456'
    });

    const postId = await createPost(app, token);
    const commentId = await createComment(app, token, postId);

    const response = await app.inject({
      method: 'POST',
      url: `/comments/${commentId}/vote`,
      headers: { authorization: `Bearer ${token}` },
      payload: { value: true }
    });

    expect(response.statusCode).toBe(403);
  });

  it('removing a vote from comment restores score', async () => {
    const { token: authorToken } = await createUserAndLogin(app, {
      name: 'Autor',
      email: 'autor@email.com',
      password: '123456'
    });

    const { token: voterToken } = await createUserAndLogin(app, {
      name: 'Votador',
      email: 'votador@email.com',
      password: '123456'
    });

    const postId = await createPost(app, authorToken);
    const commentId = await createComment(app, authorToken, postId);

    await app.inject({
      method: 'POST',
      url: `/comments/${commentId}/vote`,
      headers: { authorization: `Bearer ${voterToken}` },
      payload: { value: true }
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/comments/${commentId}/vote`,
      headers: { authorization: `Bearer ${voterToken}` }
    });

    expect(response.statusCode).toBe(204);

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    expect(comment?.score).toBe(0);
  });

  it('upvote on comment increases author karma', async () => {
    const { token: authorToken, userId: authorId } = await createUserAndLogin(app, {
      name: 'Autor',
      email: 'autor@email.com',
      password: '123456'
    });

    const { token: voterToken } = await createUserAndLogin(app, {
      name: 'Votador',
      email: 'votador@email.com',
      password: '123456'
    });

    const postId = await createPost(app, authorToken);
    const commentId = await createComment(app, authorToken, postId);

    await app.inject({
      method: 'POST',
      url: `/comments/${commentId}/vote`,
      headers: { authorization: `Bearer ${voterToken}` },
      payload: { value: true }
    });

    const author = await prisma.user.findUnique({ where: { id: authorId } });
    expect(author?.karma).toBe(1);
  });

  it('returns 404 when voting on non-existent post', async () => {
    const { token } = await createUserAndLogin(app, {
      name: 'Votador',
      email: 'votador@email.com',
      password: '123456'
    });

    const response = await app.inject({
      method: 'POST',
      url: '/posts/post-inexistente/vote',
      headers: { authorization: `Bearer ${token}` },
      payload: { value: true }
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 404 when removing vote that does not exist', async () => {
    const { token: authorToken } = await createUserAndLogin(app, {
      name: 'Autor',
      email: 'autor@email.com',
      password: '123456'
    });

    const { token: voterToken } = await createUserAndLogin(app, {
      name: 'Votador',
      email: 'votador@email.com',
      password: '123456'
    });

    const postId = await createPost(app, authorToken);

    const response = await app.inject({
      method: 'DELETE',
      url: `/posts/${postId}/vote`,
      headers: { authorization: `Bearer ${voterToken}` }
    });

    expect(response.statusCode).toBe(404);
  });
});
