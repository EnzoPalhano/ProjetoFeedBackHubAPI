import type { FastifyReply, FastifyRequest } from 'fastify';

import { voteSchema } from '../schemas/vote.schema';
import type { VoteService } from '../services/vote.service';

export function voteController(service: VoteService) {
  return {
    voteOnPost: async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      const { postId } = request.params as { postId: string };
      const { value } = voteSchema.parse(request.body);
      await service.voteOnPost(postId, request.user.sub, value);
      return reply.status(204).send();
    },

    removeVoteFromPost: async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<FastifyReply> => {
      const { postId } = request.params as { postId: string };
      await service.removeVoteFromPost(postId, request.user.sub);
      return reply.status(204).send();
    },

    voteOnComment: async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      const { commentId } = request.params as { commentId: string };
      const { value } = voteSchema.parse(request.body);
      await service.voteOnComment(commentId, request.user.sub, value);
      return reply.status(204).send();
    },

    removeVoteFromComment: async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<FastifyReply> => {
      const { commentId } = request.params as { commentId: string };
      await service.removeVoteFromComment(commentId, request.user.sub);
      return reply.status(204).send();
    }
  };
}
