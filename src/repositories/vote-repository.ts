export interface VoteRecord {
  id: string;
  userId: string;
  postId: string | null;
  commentId: string | null;
  value: boolean;
  createdAt: Date;
}

export interface CreateVoteRepositoryInput {
  userId: string;
  postId?: string;
  commentId?: string;
  value: boolean;
}

export interface VoteRepository {
  findVoteByUserAndPost(userId: string, postId: string): Promise<VoteRecord | null>;
  findVoteByUserAndComment(userId: string, commentId: string): Promise<VoteRecord | null>;
  createVote(data: CreateVoteRepositoryInput): Promise<VoteRecord>;
  updateVote(id: string, value: boolean): Promise<VoteRecord>;
  deleteVote(id: string): Promise<void>;
}
