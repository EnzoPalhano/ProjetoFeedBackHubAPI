import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FeedbackStatus } from '@prisma/client';

import { createFeedbackSchema } from '../schemas/create-feedback.schema';
import { updateFeedbackSchema } from '../schemas/update-feedback.schema';
import type { FeedbackService, UpdateFeedbackInput } from '../services/feedback.service';

export function feedbackController(service: FeedbackService) {
  return {
    createFeedback: async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<FastifyReply> => {
      const payload = createFeedbackSchema.parse(request.body);
      const feedback = await service.createFeedback({
        ...payload,
        authorId: request.user.sub
      });
      return reply.status(201).send(feedback);
    },

    listFeedbacks: async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<FastifyReply> => {
      const { status } = request.query as { status?: string };
      const feedbacks = await service.listFeedbacks(status as FeedbackStatus | undefined);
      return reply.status(200).send(feedbacks);
    },

    getFeedback: async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<FastifyReply> => {
      const { id } = request.params as { id: string };
      const feedback = await service.getFeedbackById(id);
      return reply.status(200).send(feedback);
    },

    updateFeedback: async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<FastifyReply> => {
      const { id } = request.params as { id: string };
      const parsed = updateFeedbackSchema.parse(request.body);
      const payload: UpdateFeedbackInput = {
        requesterId: request.user.sub,
        requesterRole: request.user.role
      };
      if (parsed.title !== undefined) payload.title = parsed.title;
      if (parsed.description !== undefined) payload.description = parsed.description;
      if (parsed.status !== undefined) payload.status = parsed.status;
      const feedback = await service.updateFeedback(id, payload);
      return reply.status(200).send(feedback);
    },

    deleteFeedback: async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<FastifyReply> => {
      const { id } = request.params as { id: string };
      await service.deleteFeedback(id, request.user.sub, request.user.role);
      return reply.status(204).send();
    }
  };
}
