import { UserRole } from '../enums/user-role';
import type {
  PostRecord,
  PostRepository,
  PostWithComments,
  UpdatePostRepositoryInput
} from '../repositories/post-repository';
import { ForbiddenError, NotFoundError } from '../utils/app-error';

export interface CreatePostInput {
  title: string;
  content: string;
  userId: string;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
  requesterId: string;
  requesterRole: UserRole;
}

export class PostService {
  constructor(private readonly postRepository: PostRepository) {}

  async createPost(data: CreatePostInput): Promise<PostRecord> {
    return this.postRepository.createPost({
      title: data.title,
      content: data.content,
      userId: data.userId
    });
  }

  async listPosts(): Promise<PostRecord[]> {
    return this.postRepository.listPosts();
  }

  async getPostById(id: string): Promise<PostWithComments> {
    const post = await this.postRepository.findPostById(id);
    if (!post) throw new NotFoundError('Post não encontrado');
    return post;
  }

  async updatePost(id: string, data: UpdatePostInput): Promise<PostRecord> {
    const post = await this.postRepository.findPostById(id);
    if (!post) throw new NotFoundError('Post não encontrado');

    const isOwner = post.userId === data.requesterId;
    const isAdmin = data.requesterRole === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('Sem permissão para editar este post');
    }

    const updateData: UpdatePostRepositoryInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;

    return this.postRepository.updatePost(id, updateData);
  }

  async deletePost(id: string, requesterId: string, requesterRole: UserRole): Promise<void> {
    const post = await this.postRepository.findPostById(id);
    if (!post) throw new NotFoundError('Post não encontrado');

    const isOwner = post.userId === requesterId;
    const isAdmin = requesterRole === UserRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('Sem permissão para deletar este post');
    }

    await this.postRepository.deletePost(id);
  }
}
