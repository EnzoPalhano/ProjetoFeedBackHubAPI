import type { Vote } from '@prisma/client';

import { prisma } from '../lib/prisma';
import type {
  CreateVoteRepositoryInput,
  VoteRecord,
  VoteRepository
} from './vote-repository';

function toVoteRecord(vote: Vote): VoteRecord {
  return {
    id: vote.id,
    userId: vote.userId,
    postId: vote.postId,
    commentId: vote.commentId,
    value: vote.value,
    createdAt: vote.createdAt
  };
}

export class PrismaVoteRepository implements VoteRepository {
  async findVoteByUserAndPost(userId: string, postId: string): Promise<VoteRecord | null> {
    const vote = await prisma.vote.findFirst({ where: { userId, postId } });
    return vote ? toVoteRecord(vote) : null;
  }

  async findVoteByUserAndComment(userId: string, commentId: string): Promise<VoteRecord | null> {
    const vote = await prisma.vote.findFirst({ where: { userId, commentId } });
    return vote ? toVoteRecord(vote) : null;
  }

  async createVote(data: CreateVoteRepositoryInput): Promise<VoteRecord> {
    const vote = await prisma.vote.create({ data });
    return toVoteRecord(vote);
  }

  async updateVote(id: string, value: boolean): Promise<VoteRecord> {
    const vote = await prisma.vote.update({ where: { id }, data: { value } });
    return toVoteRecord(vote);
  }

  async deleteVote(id: string): Promise<void> {
    await prisma.vote.delete({ where: { id } });
  }
}
