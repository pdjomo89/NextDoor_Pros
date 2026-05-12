export type ReviewDoc = {
  _id: string;
  _creationTime: number;
  contractorId: string;
  authorId: string;
  rating: number;
  comment: string;
  authorName: string | null;
};
