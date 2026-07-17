import { constantTimeEqual, hmacSha256 } from "@/server/auth/crypto";
import type { AuthConfig } from "@/server/config";
import type {
  ModerationRepository,
  ModeratorMembership,
} from "@/server/repositories/moderation";
import { NotFoundError } from "@/server/repositories/errors";

function revokeSignaturePayload(membershipId: string): string {
  return `moderation-membership-revoke:${membershipId}`;
}

export async function createMembershipRevokeToken(
  membership: Pick<ModeratorMembership, "id">,
  config: Pick<AuthConfig, "sessionSecret">,
): Promise<string> {
  return hmacSha256(
    revokeSignaturePayload(membership.id),
    config.sessionSecret,
  );
}

export async function findMembershipByRevokeToken(input: {
  repository: ModerationRepository;
  config: Pick<AuthConfig, "sessionSecret">;
  token: unknown;
}): Promise<ModeratorMembership> {
  if (typeof input.token !== "string" || !input.token.trim()) {
    throw new NotFoundError("Membership action was not found.");
  }
  const token = input.token.trim();
  const memberships = await input.repository.listMemberships();
  for (const membership of memberships) {
    const expected = await createMembershipRevokeToken(
      membership,
      input.config,
    );
    if (constantTimeEqual(token, expected)) return membership;
  }
  throw new NotFoundError("Membership action was not found.");
}
