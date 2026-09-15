export const auditActions = {
  "membership.created": "Membership created",
  "membership.accepted": "Membership accepted",
  "membership.revoked": "Membership removed",
  "project.access_granted": "Project access granted",
  "project.access_revoked": "Project access removed",
  "project.permission_changed": "Project permission changed",
  "invitation.created": "Invitation created",
  "invitation.resent": "Invitation renewed",
  "invitation.revoked": "Invitation revoked",
  "invitation.claimed": "Invitation claimed",
  "invitation.accepted": "Invitation accepted",
  "invitation.delivery_queued": "Invitation email requested",
  "invitation.delivery_sent": "Invitation accepted by mail server",
  "invitation.delivery_failed": "Invitation email failed",
  "invitation.delivery_cancelled": "Invitation email cancelled",
  "ownership.proposed": "Ownership proposed",
  "ownership.cancelled": "Ownership proposal cancelled",
  "ownership.transferred": "Ownership transferred",
  "ownership.recovered": "Owner access recovered by operator",
} as const;
export type AuditEntry = {
  id: string;
  source: "membership" | "invitation" | "ownership";
  type: string;
  createdAt: string;
  actor: { id: string | null; name: string | null };
  subject: {
    id: string | null;
    name: string | null;
    kind: "user" | "invitation";
  };
  projectId: string | null;
  changes: {
    previousRole: string | null;
    nextRole: string | null;
    previousPermission: string | null;
    nextPermission: string | null;
    previousOwner: string | null;
    currentOwner: string | null;
    formerOwnerRole: string | null;
    retainedProjectCount: number | null;
    credential: string | null;
    webSessions: string | null;
  };
};
export type AuditPage = { events: AuditEntry[]; nextCursor: string | null };
