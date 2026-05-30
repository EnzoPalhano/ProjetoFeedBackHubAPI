import type { FastifyReply, FastifyRequest } from 'fastify';

import { createCommentSchema } from '../schemas/create-comment.schema';
import { updateCommentSchema } from '../schemas/update-comment.schema';
import type { CommentService } from '../services/comment.service';

export function commentController(service: CommentService) {
  return {
    listComments: async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      const { postId } = request.params as { postId: string };
      const comments = await service.getCommentsByPostId(postId);
      return reply.status(200).send(comments);
    },

    createComment: async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      const { postId } = request.params as { postId: string };
      const payload = createCommentSchema.parse(request.body);
      const comment = await service.createComment({
        content: payload.content,
        postId,
        userId: request.user.sub
      });
      return reply.status(201).send(comment);
    },

    updateComment: async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      const { id } = request.params as { id: string };
      const payload = updateCommentSchema.parse(request.body);
      const comment = await service.updateComment(
        id,
        payload.content,
        request.user.sub,
        request.user.role
      );
      return reply.status(200).send(comment);
    },

    deleteComment: async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      const { id } = request.params as { id: string };
      await service.deleteComment(id, request.user.sub, request.user.role);
      return reply.status(204).send();
    }
  };
}
