import type { FastifyPluginCallback } from 'fastify';

import { commentController } from '../controllers/comment.controller';
import { voteController } from '../controllers/vote.controller';
import { verifyJwt } from '../middlewares/verify-jwt';
import { PrismaCommentRepository } from '../repositories/prisma-comment-repository';
import { PrismaPostRepository } from '../repositories/prisma-post-repository';
import { PrismaUserRepository } from '../repositories/prisma-user-repository';
import { PrismaVoteRepository } from '../repositories/prisma-vote-repository';
import { CommentService } from '../services/comment.service';
import { VoteService } from '../services/vote.service';

export const commentsRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const commentRepository = new PrismaCommentRepository();
  const postRepository = new PrismaPostRepository();
  const voteRepository = new PrismaVoteRepository();
  const userRepository = new PrismaUserRepository();

  const commentService = new CommentService(commentRepository, postRepository);
  const voteService = new VoteService(voteRepository, postRepository, commentRepository, userRepository);

  const commentCtrl = commentController(commentService);
  const voteCtrl = voteController(voteService);

  app.put('/comments/:id', { preHandler: [verifyJwt] }, commentCtrl.updateComment);
  app.delete('/comments/:id', { preHandler: [verifyJwt] }, commentCtrl.deleteComment);

  app.post('/comments/:commentId/vote', { preHandler: [verifyJwt] }, voteCtrl.voteOnComment);
  app.delete('/comments/:commentId/vote', { preHandler: [verifyJwt] }, voteCtrl.removeVoteFromComment);

  done();
};
