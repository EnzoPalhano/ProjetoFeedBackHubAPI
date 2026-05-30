import type { FastifyPluginCallback } from 'fastify';

import { userController } from '../controllers/user.controller';
import { verifyJwt } from '../middlewares/verify-jwt';
import { PrismaUserRepository } from '../repositories/prisma-user-repository';
import { UserService } from '../services/user.service';

export const usersRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const userRepository = new PrismaUserRepository();
  const service = new UserService(userRepository);
  const controller = userController(service);

  app.post('/users', controller.createUser);
  app.post('/login', controller.login);
  app.get('/users/me', { preHandler: [verifyJwt] }, controller.getMe);
  app.get('/users', { preHandler: [verifyJwt] }, controller.listUsers);
  app.get('/users/:id', { preHandler: [verifyJwt] }, controller.getUser);
  app.put('/users/:id', { preHandler: [verifyJwt] }, controller.updateUser);
  app.patch('/users/:id/role', { preHandler: [verifyJwt] }, controller.changeUserRole);
  app.delete('/users/:id', { preHandler: [verifyJwt] }, controller.deleteUser);

  done();
};
