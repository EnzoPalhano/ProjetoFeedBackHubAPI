import type { Feedback, FeedbackStatus } from '@prisma/client';

import { prisma } from '../lib/prisma';
import type {
  CreateFeedbackRepositoryInput,
  FeedbackRecord,
  FeedbackRepository,
  UpdateFeedbackRepositoryInput
} from './feedback-repository';

function toFeedbackRecord(feedback: Feedback): FeedbackRecord {
  return {
    id: feedback.id,
    title: feedback.title,
    description: feedback.description,
    status: feedback.status,
    authorId: feedback.authorId,
    createdAt: feedback.createdAt,
    updatedAt: feedback.updatedAt
  };
}

export class PrismaFeedbackRepository implements FeedbackRepository {
  async createFeedback(data: CreateFeedbackRepositoryInput): Promise<FeedbackRecord> {
    const feedback = await prisma.feedback.create({ data });
    return toFeedbackRecord(feedback);
  }

  async findFeedbackById(id: string): Promise<FeedbackRecord | null> {
    const feedback = await prisma.feedback.findUnique({ where: { id } });
    return feedback ? toFeedbackRecord(feedback) : null;
  }

  async listFeedbacks(status?: FeedbackStatus): Promise<FeedbackRecord[]> {
    const feedbacks = await prisma.feedback.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' }
    });
    return feedbacks.map(toFeedbackRecord);
  }

  async updateFeedback(id: string, data: UpdateFeedbackRepositoryInput): Promise<FeedbackRecord> {
    const feedback = await prisma.feedback.update({ where: { id }, data });
    return toFeedbackRecord(feedback);
  }

  async deleteFeedback(id: string): Promise<void> {
    await prisma.feedback.delete({ where: { id } });
  }
}
