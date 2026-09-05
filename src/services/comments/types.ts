export interface CommentDTO {
  id: string;
  activityId: string;
  authorId: string;
  text: string;
  parentCommentId: string | null;
  deleted: boolean;
  createdAt: string;
}

export interface CommentCursorPageDTO {
  items: CommentDTO[];
  nextCursor: string | null;
}
