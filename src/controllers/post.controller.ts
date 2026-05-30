import type { FastifyReply, FastifyRequest } from 'fastify';

import { createPostSchema } from '../schemas/create-post.schema';
import { updatePostSchema } from '../schemas/update-post.schema';
import type { PostService, UpdatePostInput } from '../services/post.service';

export function postController(service: PostService) {
  return {
    createPost: async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      const payload = createPostSchema.parse(request.body);
      const post = await service.createPost({ ...payload, userId: request.user.sub });
      return reply.status(201).send(post);
    },

    listPosts: async (_request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      const posts = await service.listPosts();
      return reply.status(200).send(posts);
    },

    getPost: async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      const { id } = request.params as { id: string };
      const post = await service.getPostById(id);
      return reply.status(200).send(post);
    },

    updatePost: async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      const { id } = request.params as { id: string };
      const parsed = updatePostSchema.parse(request.body);
      const payload: UpdatePostInput = {
        requesterId: request.user.sub,
        requesterRole: request.user.role
      };
      if (parsed.title !== undefined) payload.title = parsed.title;
      if (parsed.content !== undefined) payload.content = parsed.content;
      const post = await service.updatePost(id, payload);
      return reply.status(200).send(post);
    },

    deletePost: async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      const { id } = request.params as { id: string };
      await service.deletePost(id, request.user.sub, request.user.role);
      return reply.status(204).send();
    }
  };
}
