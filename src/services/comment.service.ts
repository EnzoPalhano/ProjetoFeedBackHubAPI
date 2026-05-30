import { UserRole } from '../enums/user-role';
import type { CommentRecord, CommentRepository } from '../repositories/comment-repository';
import type { PostRepository } from '../repositories/post-repository';
import { ForbiddenError, NotFoundError } from '../utils/app-error';

export interface CreateCommentInput {
  content: string;
  postId: string;
  userId: string;
}

export class CommentService {
  constructor(
    private readonly commentRepository: CommentRepository,
    private readonly postRepository: PostRepository
  ) {}

  async getCommentsByPostId(postId: string): Promise<CommentRecord[]> {
    const post = await this.postRepository.findPostById(postId);
    if (!post) throw new NotFoundError('Post não encontrado');
    return this.commentRepository.findCommentsByPostId(postId);
  }

  async createComment(data: CreateCommentInput): Promise<CommentRecord> {
    const post = await this.postRepository.findPostById(data.postId);
    if (!post) throw new NotFoundError('Post não encontrado');

    return this.commentRepository.createComment({
      content: data.content,
      userId: data.userId,
      postId: data.postId
    });
  }

  async updateComment(
    id: string,
    content: string,
    requesterId: string,
    requesterRole: UserRole
  ): Promise<CommentRecord> {
    const comment = await this.commentRepository.findCommentById(id);
    if (!comment) throw new NotFoundError('Comentário não encontrado');

    const isOwner = comment.userId === requesterId;
    const isAdmin = requesterRole === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('Sem permissão para editar este comentário');
    }

    return this.commentRepository.updateComment(id, content);
  }

  async deleteComment(id: string, requesterId: string, requesterRole: UserRole): Promise<void> {
    const comment = await this.commentRepository.findCommentById(id);
    if (!comment) throw new NotFoundError('Comentário não encontrado');

    const isOwner = comment.userId === requesterId;
    const isAdmin = requesterRole === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('Sem permissão para deletar este comentário');
    }

    await this.commentRepository.deleteComment(id);
  }
}
