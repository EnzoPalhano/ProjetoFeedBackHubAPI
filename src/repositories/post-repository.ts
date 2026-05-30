import type { CommentRecord } from './comment-repository';

export interface PostRecord {
  id: string;
  title: string;
  content: string;
  userId: string;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostWithComments extends PostRecord {
  comments: CommentRecord[];
}

export interface CreatePostRepositoryInput {
  title: string;
  content: string;
  userId: string;
}

export interface UpdatePostRepositoryInput {
  title?: string;
  content?: string;
}

export interface PostRepository {
  createPost(data: CreatePostRepositoryInput): Promise<PostRecord>;
  findPostById(id: string): Promise<PostWithComments | null>;
  listPosts(): Promise<PostRecord[]>;
  updatePost(id: string, data: UpdatePostRepositoryInput): Promise<PostRecord>;
  deletePost(id: string): Promise<void>;
  incrementScore(id: string, delta: number): Promise<void>;
}
