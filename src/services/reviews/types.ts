export interface ReviewDTO {
  id: string;
  sessionId: string;
  rating: number;
  text: string | null;
  containsSpoiler: boolean;
  createdAt: string;
  updatedAt: string;
}
