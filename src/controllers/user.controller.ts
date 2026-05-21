import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  createUserSchema,
  type CreateUserSchemaInput
} from '../schemas/create-user.schema';
import { loginSchema, type LoginSchemaInput } from '../schemas/login.schema';
import { type UserService } from '../services/user.service';

export function userController(service: UserService) {
  return {
    createUser: async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<FastifyReply> => {
      const payload: CreateUserSchemaInput = createUserSchema.parse(request.body);
      const user = await service.createUser(payload);

      return reply.status(201).send(user);
    },

    login: async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<FastifyReply> => {
      const payload: LoginSchemaInput = loginSchema.parse(request.body);
      const user = await service.login(payload);
      const token = request.server.jwt.sign(
        {
          role: user.role
        },
        {
          sub: user.id
        }
      );

      return reply.status(200).send({ token });
    },

    listUsers: async (
      _request: FastifyRequest,
      reply: FastifyReply
    ): Promise<FastifyReply> => {
      const users = await service.listUsers();

      return reply.status(200).send(users);
    }
  };
}
