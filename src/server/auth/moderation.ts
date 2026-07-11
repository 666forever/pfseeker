import type { APIContext, AstroGlobal } from "astro";
import { requireUser } from "@/server/auth/session";
import type { CurrentUser } from "@/server/auth/types";
import { getCloudflareRuntimeEnv } from "@/server/db/d1";
import { getD1DatabaseAsync } from "@/server/db/d1";
import {
  ModerationRepository,
  type ModeratorRole,
} from "@/server/repositories/moderation";

export class ModerationAuthorizationError extends Error {
  constructor(message = "Moderation access is not available.") {
    super(message);
    this.name = "ModerationAuthorizationError";
  }
}

export interface ModerationAccess {
  currentUser: CurrentUser;
  role: ModeratorRole;
  repository: ModerationRepository;
  bootstrapEligible: boolean;
}

type AuthContext = {
  locals: AstroGlobal["locals"] | APIContext["locals"];
  cookies: APIContext["cookies"] | AstroGlobal["cookies"];
};

function parseBootstrapIds(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => /^\d{17,20}$/.test(entry)),
  );
}

export async function isBootstrapModerator(
  locals: AuthContext["locals"],
  discordUserId: string,
): Promise<boolean> {
  const env = await getCloudflareRuntimeEnv(locals);
  return parseBootstrapIds(env.MODERATOR_BOOTSTRAP_DISCORD_IDS).has(
    discordUserId,
  );
}

export async function requireModerator(
  context: AuthContext,
): Promise<ModerationAccess> {
  const currentUser = await requireUser(context);
  const repository = new ModerationRepository(
    await getD1DatabaseAsync(context.locals),
  );
  const membership = await repository.findActiveMembership(currentUser.user.id);
  if (membership) {
    return {
      currentUser,
      role: membership.role,
      repository,
      bootstrapEligible: false,
    };
  }
  if (
    currentUser.user.accountStatus === "active" &&
    (await isBootstrapModerator(
      context.locals,
      currentUser.user.discordUserId,
    )) &&
    (await repository.canBootstrapOwner(currentUser.user.id))
  ) {
    return {
      currentUser,
      role: "owner",
      repository,
      bootstrapEligible: true,
    };
  }
  throw new ModerationAuthorizationError();
}

export async function requireOwner(
  context: AuthContext,
): Promise<ModerationAccess> {
  const access = await requireModerator(context);
  if (access.role !== "owner") {
    throw new ModerationAuthorizationError("Owner access is required.");
  }
  return access;
}
