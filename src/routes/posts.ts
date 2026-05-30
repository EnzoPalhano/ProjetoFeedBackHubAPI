import type { FastifyPluginCallback } from 'fastify';

import { commentController } from '../controllers/comment.controller';
import { postController } from '../controllers/post.controller';
import { voteController } from '../controllers/vote.controller';
import { verifyJwt } from '../middlewares/verify-jwt';
import { PrismaCommentRepository } from '../repositories/prisma-comment-repository';
import { PrismaPostRepository } from '../repositories/prisma-post-repository';
import { PrismaUserRepository } from '../repositories/prisma-user-repository';
import { PrismaVoteRepository } from '../repositories/prisma-vote-repository';
import { CommentService } from '../services/comment.service';
import { PostService } from '../services/post.service';
import { VoteService } from '../services/vote.service';

export const postsRoutes: FastifyPluginCallback = (app, _opts, done) => {
  const postRepository = new PrismaPostRepository();
  const commentRepository = new PrismaCommentRepository();
  const voteRepository = new PrismaVoteRepository();
  const userRepository = new PrismaUserRepository();

  const postService = new PostService(postRepository);
  const commentService = new CommentService(commentRepository, postRepository);
  const voteService = new VoteService(voteRepository, postRepository, commentRepository, userRepository);

  const postCtrl = postController(postService);
  const commentCtrl = commentController(commentService);
  const voteCtrl = voteController(voteService);

  app.post('/posts', { preHandler: [verifyJwt] }, postCtrl.createPost);
  app.get('/posts', { preHandler: [verifyJwt] }, postCtrl.listPosts);
  app.get('/posts/:id', { preHandler: [verifyJwt] }, postCtrl.getPost);
  app.put('/posts/:id', { preHandler: [verifyJwt] }, postCtrl.updatePost);
  app.delete('/posts/:id', { preHandler: [verifyJwt] }, postCtrl.deletePost);

  app.get('/posts/:postId/comments', { preHandler: [verifyJwt] }, commentCtrl.listComments);
  app.post('/posts/:postId/comments', { preHandler: [verifyJwt] }, commentCtrl.createComment);

  app.post('/posts/:postId/vote', { preHandler: [verifyJwt] }, voteCtrl.voteOnPost);
  app.delete('/posts/:postId/vote', { preHandler: [verifyJwt] }, voteCtrl.removeVoteFromPost);

  done();
};
