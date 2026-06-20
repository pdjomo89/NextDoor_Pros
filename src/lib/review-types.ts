export type ReviewDoc = {
  _id: string;
  _creationTime: number;
  contractorId: string;
  authorId: string | null;
  rating: number;
  comment: string;
  authorName: string | null;
};
