import type { Comment, Post } from '@prisma/client';

import { prisma } from '../lib/prisma';
import type { CommentRecord } from './comment-repository';
import type {
  CreatePostRepositoryInput,
  PostRecord,
  PostRepository,
  PostWithComments,
  UpdatePostRepositoryInput
} from './post-repository';

function toPostRecord(post: Post): PostRecord {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    userId: post.userId,
    score: post.score,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt
  };
}

function toCommentRecord(comment: Comment): CommentRecord {
  return {
    id: comment.id,
    content: comment.content,
    userId: comment.userId,
    postId: comment.postId,
    score: comment.score,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt
  };
}

export class PrismaPostRepository implements PostRepository {
  async createPost(data: CreatePostRepositoryInput): Promise<PostRecord> {
    const post = await prisma.post.create({ data });
    return toPostRecord(post);
  }

  async findPostById(id: string): Promise<PostWithComments | null> {
    const post = await prisma.post.findUnique({
      where: { id },
      include: { comments: { orderBy: { createdAt: 'asc' } } }
    });
    if (!post) return null;
    return {
      ...toPostRecord(post),
      comments: post.comments.map(toCommentRecord)
    };
  }

  async listPosts(): Promise<PostRecord[]> {
    const posts = await prisma.post.findMany({ orderBy: { createdAt: 'desc' } });
    return posts.map(toPostRecord);
  }

  async updatePost(id: string, data: UpdatePostRepositoryInput): Promise<PostRecord> {
    const post = await prisma.post.update({ where: { id }, data });
    return toPostRecord(post);
  }

  async deletePost(id: string): Promise<void> {
    await prisma.post.delete({ where: { id } });
  }

  async incrementScore(id: string, delta: number): Promise<void> {
    await prisma.post.update({
      where: { id },
      data: { score: { increment: delta } }
    });
  }
}
