import { describe, expect, it } from "vitest";

import type { D1DatabaseLike, D1PreparedStatementLike } from "@/server/db/d1";
import { InvalidRepositoryInputError } from "@/server/repositories/errors";
import {
  ModerationRepository,
  type ModeratorRole,
} from "@/server/repositories/moderation";

interface MembershipRecord {
  id: string;
  user_id: string;
  role: ModeratorRole;
  status: "active" | "revoked";
  created_by_user_id: string | null;
  created_at: string;
  revoked_by_user_id: string | null;
  revoked_at: string | null;
  reason: string | null;
}

interface EventRecord {
  action: string;
  target_id: string;
  reason: string | null;
}

class FakeStatement implements D1PreparedStatementLike {
  private values: unknown[] = [];

  constructor(
    private readonly query: string,
    private readonly db: FakeModerationD1,
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T = unknown>(): Promise<T | null> {
    const { results } = await this.all<T>();
    return results[0] ?? null;
  }

  async all<T = unknown>(): Promise<{ results: T[] }> {
    return { results: this.db.resultsFor<T>(this.query, this.values) };
  }

  async run(): Promise<{ success: boolean; meta?: unknown }> {
    this.db.run(this.query, this.values);
    return { success: true };
  }
}

class FakeModerationD1 implements D1DatabaseLike {
  memberships = new Map<string, MembershipRecord>();
  events: EventRecord[] = [];

  prepare(query: string): D1PreparedStatementLike {
    return new FakeStatement(query, this);
  }

  async batch<T = unknown>(
    statements: D1PreparedStatementLike[],
  ): Promise<T[]> {
    for (const statement of statements) {
      await statement.run();
    }
    return [] as T[];
  }

  addMembership(input: {
    id: string;
    userId: string;
    role: ModeratorRole;
    status: "active" | "revoked";
  }): void {
    this.memberships.set(input.id, {
      id: input.id,
      user_id: input.userId,
      role: input.role,
      status: input.status,
      created_by_user_id: null,
      created_at: "2026-07-11T00:00:00.000Z",
      revoked_by_user_id: null,
      revoked_at:
        input.status === "revoked" ? "2026-07-11T00:00:00.000Z" : null,
      reason: null,
    });
  }

  resultsFor<T>(query: string, values: unknown[]): T[] {
    if (
      query.includes("COUNT(*) AS count") &&
      query.includes("role = 'owner'") &&
      query.includes("status = 'active'")
    ) {
      return [
        {
          count: Array.from(this.memberships.values()).filter(
            (membership) =>
              membership.role === "owner" && membership.status === "active",
          ).length,
        },
      ] as T[];
    }

    if (
      query.includes("FROM moderator_memberships") &&
      query.includes("user_id = ?") &&
      query.includes("status = 'revoked'")
    ) {
      const [userId] = values;
      const revoked = Array.from(this.memberships.values()).find(
        (membership) =>
          membership.user_id === userId && membership.status === "revoked",
      );
      return revoked ? ([{ id: revoked.id }] as T[]) : [];
    }

    if (
      query.includes("FROM moderator_memberships") &&
      query.includes("user_id = ?") &&
      query.includes("status = 'active'")
    ) {
      const [userId] = values;
      return Array.from(this.memberships.values()).filter(
        (membership) =>
          membership.user_id === userId && membership.status === "active",
      ) as T[];
    }

    if (
      query.includes("FROM moderator_memberships") &&
      query.includes("WHERE id = ?")
    ) {
      const [id] = values;
      const membership = this.memberships.get(String(id));
      return membership ? ([membership] as T[]) : [];
    }

    return [];
  }

  run(query: string, values: unknown[]): void {
    if (query.includes("INSERT INTO moderator_memberships")) {
      const id = String(values[0]);
      const userId = String(values[1]);
      const role = query.includes("'owner', 'active'")
        ? "owner"
        : (values[2] as ModeratorRole);
      const createdByUserId = query.includes("'owner', 'active'")
        ? String(values[2])
        : String(values[3]);
      const reason = String(values[values.length - 1] ?? "");
      this.memberships.set(id, {
        id,
        user_id: userId,
        role,
        status: "active",
        created_by_user_id: createdByUserId,
        created_at: "2026-07-11T00:00:00.000Z",
        revoked_by_user_id: null,
        revoked_at: null,
        reason,
      });
    }

    if (query.includes("UPDATE moderator_memberships")) {
      const [actorUserId, revokedAt, reason, membershipId] = values;
      const membership = this.memberships.get(String(membershipId));
      if (membership?.status === "active") {
        membership.status = "revoked";
        membership.revoked_by_user_id = String(actorUserId);
        membership.revoked_at = String(revokedAt);
        membership.reason = String(reason);
      }
    }

    if (query.includes("INSERT INTO moderation_events")) {
      this.events.push({
        action: String(values[4]),
        target_id: String(values[3]),
        reason: values[8] === null ? null : String(values[8]),
      });
    }
  }
}

describe("moderation membership behavior", () => {
  it("bootstraps one owner idempotently and records one event", async () => {
    const db = new FakeModerationD1();
    const repository = new ModerationRepository(db);

    const first = await repository.bootstrapOwner(
      "11111111-1111-4111-8111-111111111111",
    );
    const second = await repository.bootstrapOwner(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(first.id).toBe(second.id);
    expect(first.role).toBe("owner");
    expect(
      Array.from(db.memberships.values()).filter(
        (membership) =>
          membership.user_id === "11111111-1111-4111-8111-111111111111" &&
          membership.status === "active",
      ),
    ).toHaveLength(1);
    expect(db.events.map((event) => event.action)).toEqual([
      "membership.bootstrap_owner",
    ]);
  });

  it("does not let a revoked allowlisted user bootstrap again while an owner remains", async () => {
    const db = new FakeModerationD1();
    db.addMembership({
      id: "22222222-2222-4222-8222-222222222222",
      userId: "owner-user",
      role: "owner",
      status: "active",
    });
    db.addMembership({
      id: "33333333-3333-4333-8333-333333333333",
      userId: "11111111-1111-4111-8111-111111111111",
      role: "owner",
      status: "revoked",
    });
    const repository = new ModerationRepository(db);

    await expect(
      repository.bootstrapOwner("11111111-1111-4111-8111-111111111111"),
    ).rejects.toBeInstanceOf(InvalidRepositoryInputError);
    await expect(
      repository.canBootstrapOwner("11111111-1111-4111-8111-111111111111"),
    ).resolves.toBe(false);
  });

  it("allows break-glass bootstrap when there are no active owners", async () => {
    const db = new FakeModerationD1();
    db.addMembership({
      id: "33333333-3333-4333-8333-333333333333",
      userId: "11111111-1111-4111-8111-111111111111",
      role: "owner",
      status: "revoked",
    });
    const repository = new ModerationRepository(db);

    await expect(
      repository.canBootstrapOwner("11111111-1111-4111-8111-111111111111"),
    ).resolves.toBe(true);
    const membership = await repository.bootstrapOwner(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(membership.role).toBe("owner");
    expect(membership.status).toBe("active");
  });

  it("blocks revoking the final active owner", async () => {
    const db = new FakeModerationD1();
    db.addMembership({
      id: "22222222-2222-4222-8222-222222222222",
      userId: "owner-user",
      role: "owner",
      status: "active",
    });
    const repository = new ModerationRepository(db);

    await expect(
      repository.revokeMembership({
        actorUserId: "owner-user",
        membershipId: "22222222-2222-4222-8222-222222222222",
        reason: "Routine test",
      }),
    ).rejects.toBeInstanceOf(InvalidRepositoryInputError);
    expect(
      db.memberships.get("22222222-2222-4222-8222-222222222222")?.status,
    ).toBe("active");
  });

  it("revokes an owner when another active owner remains and writes history", async () => {
    const db = new FakeModerationD1();
    db.addMembership({
      id: "22222222-2222-4222-8222-222222222222",
      userId: "owner-user",
      role: "owner",
      status: "active",
    });
    db.addMembership({
      id: "33333333-3333-4333-8333-333333333333",
      userId: "other-owner",
      role: "owner",
      status: "active",
    });
    const repository = new ModerationRepository(db);

    const revoked = await repository.revokeMembership({
      actorUserId: "other-owner",
      membershipId: "22222222-2222-4222-8222-222222222222",
      reason: "Routine test",
    });

    expect(revoked.status).toBe("revoked");
    expect(db.events.map((event) => event.action)).toEqual([
      "membership.revoke",
    ]);
  });
});
