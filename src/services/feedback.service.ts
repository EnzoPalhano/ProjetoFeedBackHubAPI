import type { FeedbackStatus } from '@prisma/client';

import { UserRole } from '../enums/user-role';
import type { FeedbackRecord, FeedbackRepository } from '../repositories/feedback-repository';
import { ForbiddenError, NotFoundError } from '../utils/app-error';

export interface CreateFeedbackInput {
  title: string;
  description: string;
  authorId: string;
}

export interface UpdateFeedbackInput {
  title?: string;
  description?: string;
  status?: FeedbackStatus;
  requesterId: string;
  requesterRole: UserRole;
}

export class FeedbackService {
  constructor(private readonly feedbackRepository: FeedbackRepository) {}

  async createFeedback(data: CreateFeedbackInput): Promise<FeedbackRecord> {
    return this.feedbackRepository.createFeedback({
      title: data.title,
      description: data.description,
      authorId: data.authorId
    });
  }

  async listFeedbacks(status?: FeedbackStatus): Promise<FeedbackRecord[]> {
    return this.feedbackRepository.listFeedbacks(status);
  }

  async getFeedbackById(id: string): Promise<FeedbackRecord> {
    const feedback = await this.feedbackRepository.findFeedbackById(id);
    if (!feedback) throw new NotFoundError('Feedback não encontrado');
    return feedback;
  }

  async updateFeedback(id: string, data: UpdateFeedbackInput): Promise<FeedbackRecord> {
    const feedback = await this.feedbackRepository.findFeedbackById(id);
    if (!feedback) throw new NotFoundError('Feedback não encontrado');

    const isOwner = feedback.authorId === data.requesterId;
    const isAdmin = data.requesterRole === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('Sem permissão para editar este feedback');
    }

    if (data.status && !isAdmin) {
      throw new ForbiddenError('Apenas administradores podem alterar o status');
    }

    return this.feedbackRepository.updateFeedback(id, {
      title: data.title,
      description: data.description,
      status: data.status
    });
  }

  async deleteFeedback(
    id: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<void> {
    const feedback = await this.feedbackRepository.findFeedbackById(id);
    if (!feedback) throw new NotFoundError('Feedback não encontrado');

    const isOwner = feedback.authorId === requesterId;
    const isAdmin = requesterRole === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('Sem permissão para deletar este feedback');
    }

    await this.feedbackRepository.deleteFeedback(id);
  }
}
