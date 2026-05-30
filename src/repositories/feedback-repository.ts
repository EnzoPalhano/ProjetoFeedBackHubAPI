import type { FeedbackStatus } from '@prisma/client';

export interface FeedbackRecord {
  id: string;
  title: string;
  description: string;
  status: FeedbackStatus;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFeedbackRepositoryInput {
  title: string;
  description: string;
  authorId: string;
}

export interface UpdateFeedbackRepositoryInput {
  title?: string;
  description?: string;
  status?: FeedbackStatus;
}

export interface FeedbackRepository {
  createFeedback(data: CreateFeedbackRepositoryInput): Promise<FeedbackRecord>;
  findFeedbackById(id: string): Promise<FeedbackRecord | null>;
  listFeedbacks(status?: FeedbackStatus): Promise<FeedbackRecord[]>;
  updateFeedback(id: string, data: UpdateFeedbackRepositoryInput): Promise<FeedbackRecord>;
  deleteFeedback(id: string): Promise<void>;
}
