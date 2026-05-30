export interface CommentRecord {
  id: string;
  content: string;
  userId: string;
  postId: string;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommentRepositoryInput {
  content: string;
  userId: string;
  postId: string;
}

export interface CommentRepository {
  createComment(data: CreateCommentRepositoryInput): Promise<CommentRecord>;
  findCommentById(id: string): Promise<CommentRecord | null>;
  updateComment(id: string, content: string): Promise<CommentRecord>;
  deleteComment(id: string): Promise<void>;
  incrementScore(id: string, delta: number): Promise<void>;
}
