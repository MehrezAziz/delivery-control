/** Shape returned by GET /api/company/notifications (Prisma notification row). */
export type CompanyNotificationRow = {
  id: string;
  title: string;
  body: string;
  sentAt: string;
  readAt: string | null;
  type?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  groupKey?: string | null;
};

export type CompanyInboxEntry =
  | {
      kind: "single";
      notification: CompanyNotificationRow;
      threadKey: string | null;
    }
  | {
      kind: "group";
      threadKey: string;
      notifications: CompanyNotificationRow[];
      latest: CompanyNotificationRow;
      count: number;
      unreadCount: number;
    };
