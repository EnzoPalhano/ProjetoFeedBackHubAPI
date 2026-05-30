import type { Comment } from '@prisma/client';

import { prisma } from '../lib/prisma';
import type {
  CommentRecord,
  CommentRepository,
  CreateCommentRepositoryInput
} from './comment-repository';

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

export class PrismaCommentRepository implements CommentRepository {
  async createComment(data: CreateCommentRepositoryInput): Promise<CommentRecord> {
    const comment = await prisma.comment.create({ data });
    return toCommentRecord(comment);
  }

  async findCommentById(id: string): Promise<CommentRecord | null> {
    const comment = await prisma.comment.findUnique({ where: { id } });
    return comment ? toCommentRecord(comment) : null;
  }

  async findCommentsByPostId(postId: string): Promise<CommentRecord[]> {
    const comments = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' }
    });
    return comments.map(toCommentRecord);
  }

  async updateComment(id: string, content: string): Promise<CommentRecord> {
    const comment = await prisma.comment.update({ where: { id }, data: { content } });
    return toCommentRecord(comment);
  }

  async deleteComment(id: string): Promise<void> {
    await prisma.comment.delete({ where: { id } });
  }

  async incrementScore(id: string, delta: number): Promise<void> {
    await prisma.comment.update({
      where: { id },
      data: { score: { increment: delta } }
    });
  }
}
