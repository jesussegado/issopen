export type PersonalNotification = {
  id: string;
  kind: "assignment" | "question" | "mention" | "review";
  issueId: string;
  number: number;
  title: string;
  actorName: string;
  questionId: string | null;
  createdAt: string;
  readAt: string | null;
  actionable: boolean;
};
export type NotificationPage = {
  notifications: PersonalNotification[];
  unread: number;
  nextCursor: string | null;
};
