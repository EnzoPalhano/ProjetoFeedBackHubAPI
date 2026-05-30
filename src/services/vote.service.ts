import type { CommentRepository } from '../repositories/comment-repository';
import type { PostRepository } from '../repositories/post-repository';
import type { UserRepository } from '../repositories/user-repository';
import type { VoteRepository } from '../repositories/vote-repository';
import { ForbiddenError, NotFoundError } from '../utils/app-error';

export class VoteService {
  constructor(
    private readonly voteRepository: VoteRepository,
    private readonly postRepository: PostRepository,
    private readonly commentRepository: CommentRepository,
    private readonly userRepository: UserRepository
  ) {}

  async voteOnPost(postId: string, userId: string, value: boolean): Promise<void> {
    const post = await this.postRepository.findPostById(postId);
    if (!post) throw new NotFoundError('Post não encontrado');

    if (post.userId === userId) {
      throw new ForbiddenError('Não é permitido votar no próprio post');
    }

    const existing = await this.voteRepository.findVoteByUserAndPost(userId, postId);

    if (existing) {
      if (existing.value === value) return;
      const delta = value ? 2 : -2;
      await this.voteRepository.updateVote(existing.id, value);
      await this.postRepository.incrementScore(postId, delta);
      await this.userRepository.updateKarma(post.userId, delta);
    } else {
      const delta = value ? 1 : -1;
      await this.voteRepository.createVote({ userId, postId, value });
      await this.postRepository.incrementScore(postId, delta);
      await this.userRepository.updateKarma(post.userId, delta);
    }
  }

  async removeVoteFromPost(postId: string, userId: string): Promise<void> {
    const post = await this.postRepository.findPostById(postId);
    if (!post) throw new NotFoundError('Post não encontrado');

    const existing = await this.voteRepository.findVoteByUserAndPost(userId, postId);
    if (!existing) throw new NotFoundError('Voto não encontrado');

    const delta = existing.value ? -1 : 1;
    await this.voteRepository.deleteVote(existing.id);
    await this.postRepository.incrementScore(postId, delta);
    await this.userRepository.updateKarma(post.userId, delta);
  }

  async voteOnComment(commentId: string, userId: string, value: boolean): Promise<void> {
    const comment = await this.commentRepository.findCommentById(commentId);
    if (!comment) throw new NotFoundError('Comentário não encontrado');

    if (comment.userId === userId) {
      throw new ForbiddenError('Não é permitido votar no próprio comentário');
    }

    const existing = await this.voteRepository.findVoteByUserAndComment(userId, commentId);

    if (existing) {
      if (existing.value === value) return;
      const delta = value ? 2 : -2;
      await this.voteRepository.updateVote(existing.id, value);
      await this.commentRepository.incrementScore(commentId, delta);
      await this.userRepository.updateKarma(comment.userId, delta);
    } else {
      const delta = value ? 1 : -1;
      await this.voteRepository.createVote({ userId, commentId, value });
      await this.commentRepository.incrementScore(commentId, delta);
      await this.userRepository.updateKarma(comment.userId, delta);
    }
  }

  async removeVoteFromComment(commentId: string, userId: string): Promise<void> {
    const comment = await this.commentRepository.findCommentById(commentId);
    if (!comment) throw new NotFoundError('Comentário não encontrado');

    const existing = await this.voteRepository.findVoteByUserAndComment(userId, commentId);
    if (!existing) throw new NotFoundError('Voto não encontrado');

    const delta = existing.value ? -1 : 1;
    await this.voteRepository.deleteVote(existing.id);
    await this.commentRepository.incrementScore(commentId, delta);
    await this.userRepository.updateKarma(comment.userId, delta);
  }
}
