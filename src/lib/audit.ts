import { prisma } from "@/lib/prisma";

type RegisterUserAuditInput = {
  actorUserId: string;
  action: string;
  description: string;
  payload?: string;
  teamId?: string | null;
  signatureRequestId?: string;
};

export async function registerUserAudit({
  actorUserId,
  action,
  description,
  payload,
  teamId,
  signatureRequestId,
}: RegisterUserAuditInput) {
  await prisma.auditEvent.create({
    data: {
      action,
      description,
      payload,
      actorType: "USER",
      actorUserId,
      teamId: teamId ?? undefined,
      signatureRequestId,
    },
  });
}
