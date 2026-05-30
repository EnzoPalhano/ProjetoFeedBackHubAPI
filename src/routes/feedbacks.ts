import type { FastifyPluginCallback } from 'fastify';

import { feedbackController } from '../controllers/feedback.controller';
import { verifyJwt } from '../middlewares/verify-jwt';
import { PrismaFeedbackRepository } from '../repositories/prisma-feedback-repository';
import { FeedbackService } from '../services/feedback.service';

export const feedbacksRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const feedbackRepository = new PrismaFeedbackRepository();
  const service = new FeedbackService(feedbackRepository);
  const controller = feedbackController(service);

  app.get('/feedbacks', controller.listFeedbacks);
  app.get('/feedbacks/:id', controller.getFeedback);
  app.post('/feedbacks', { preHandler: [verifyJwt] }, controller.createFeedback);
  app.put('/feedbacks/:id', { preHandler: [verifyJwt] }, controller.updateFeedback);
  app.delete('/feedbacks/:id', { preHandler: [verifyJwt] }, controller.deleteFeedback);

  done();
};
