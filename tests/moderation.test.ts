import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  copyCloudinaryResource,
  createPublishedPublicId,
  getCloudinaryConfig,
  publicIdInPublishedNamespace,
} from "@/server/services/cloudinary";
import { InvalidRepositoryInputError } from "@/server/repositories/errors";
import { approveAndPublishSubmission } from "@/server/services/publication";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const cloudinaryConfig = {
  cloudName: "example-cloud",
  apiKey: "example-key",
  apiSecret: "example-secret",
  pendingFolder: "pfseeker/pending-submissions",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Phase 13 moderation schema", () => {
  it("adds durable memberships and append-only events without report tables", () => {
    const migration = read("migrations/0006_moderation_and_publishing.sql");

    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS moderator_memberships",
    );
    expect(migration).toContain(
      "role TEXT NOT NULL CHECK (role IN ('owner', 'moderator'))",
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS moderation_events");
    expect(migration).toContain("idx_moderation_events_target_time");
    expect(migration).toContain(
      "status IN ('pending', 'approved', 'published', 'rejected')",
    );
    expect(migration).toContain("archived_at TEXT");
    expect(read("src/server/repositories/moderation.ts")).toContain(
      "SET status = 'archived'",
    );
    expect(migration).not.toMatch(/CREATE TABLE[^;]+reports/i);
  });

  it("keeps submission taxonomy nullable and cleanup state explicit", () => {
    const migration = read("migrations/0006_moderation_and_publishing.sql");

    expect(migration).toContain("category_id TEXT,");
    expect(migration).toContain("cloudinary_public_id TEXT UNIQUE");
    expect(migration).toContain("rejection_note_internal TEXT CHECK");
    expect(migration).toContain("media_cleanup_status TEXT NOT NULL DEFAULT");
    expect(migration).toContain("'cleanup_failed'");
  });
});

describe("Phase 13 moderation routes", () => {
  it("adds required protected moderation pages and no reports route", () => {
    for (const path of [
      "src/pages/moderation/index.astro",
      "src/pages/moderation/submissions/index.astro",
      "src/pages/moderation/submissions/[submissionId].astro",
      "src/pages/moderation/taxonomy.astro",
      "src/pages/moderation/history.astro",
      "src/pages/moderation/members.astro",
    ]) {
      expect(existsSync(path), path).toBe(true);
    }

    expect(existsSync("src/pages/moderation/reports.astro")).toBe(false);
    expect(existsSync("src/pages/api/moderation/reports.ts")).toBe(false);
  });

  it("enforces moderator and owner checks on privileged surfaces", () => {
    expect(read("src/pages/moderation/submissions/index.astro")).toContain(
      "requireModerator(Astro)",
    );
    expect(
      read("src/pages/moderation/submissions/[submissionId].astro"),
    ).toContain("requireModerator(Astro)");
    expect(read("src/pages/moderation/history.astro")).toContain(
      "requireModerator(Astro)",
    );
    expect(read("src/pages/moderation/taxonomy.astro")).toContain(
      "requireOwner(Astro)",
    );
    expect(read("src/pages/moderation/members.astro")).toContain(
      "requireOwner(Astro)",
    );
    expect(
      read("src/pages/api/moderation/assets/[assetId]/archive.ts"),
    ).toContain("requireOwner(context)");
  });

  it("keeps bootstrap IDs server-only and avoids serializing the env key", () => {
    const authSource = read("src/server/auth/moderation.ts");
    const bootstrapPage = read("src/pages/api/moderation/bootstrap.ts");
    const pageSources = [
      "src/pages/moderation/index.astro",
      "src/pages/moderation/submissions/index.astro",
      "src/pages/moderation/submissions/[submissionId].astro",
      "src/pages/moderation/taxonomy.astro",
      "src/pages/moderation/history.astro",
      "src/pages/moderation/members.astro",
    ].map(read);

    expect(authSource).toContain("MODERATOR_BOOTSTRAP_DISCORD_IDS");
    expect(authSource).toContain("\\d{17,20}");
    expect(bootstrapPage).toContain("bootstrapOwner");
    expect(pageSources.join("\n")).not.toContain(
      "MODERATOR_BOOTSTRAP_DISCORD_IDS",
    );
  });
});

describe("Phase 13 publication boundaries", () => {
  it("copies pending media into the published namespace before deleting pending media", () => {
    const source = read("src/server/services/publication.ts");
    const copyIndex = source.indexOf("copyCloudinaryResource");
    const publishIndex = source.indexOf("repository.publishSubmission");
    const deleteIndex = source.lastIndexOf("deleteCloudinaryResource");

    expect(copyIndex).toBeGreaterThan(-1);
    expect(publishIndex).toBeGreaterThan(copyIndex);
    expect(deleteIndex).toBeGreaterThan(publishIndex);
    expect(source).toContain("markCleanupFailed");
  });

  it("uses a safe published Cloudinary namespace", () => {
    const publicId = createPublishedPublicId({
      assetType: "pfp",
      assetId: "asset-1",
    });

    expect(publicId).toBe("pfseeker/published/pfp/asset-1");
    expect(publicIdInPublishedNamespace(publicId)).toBe(true);
    expect(publicIdInPublishedNamespace("pfseeker/published/../asset")).toBe(
      false,
    );
    expect(publicIdInPublishedNamespace("https://example.com/asset")).toBe(
      false,
    );
  });

  it("copies nested pending resources from Cloudinary's canonical secure URL", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            public_id:
              "pfseeker/pending-submissions/user-1/intent-1/source-file",
            resource_type: "image",
            type: "upload",
            format: "png",
            bytes: 100,
            width: 512,
            height: 512,
            secure_url:
              "https://res.cloudinary.com/example-cloud/image/upload/v123/pfseeker/pending-submissions/user-1/intent-1/source-file.png",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ public_id: "published" }), {
          status: 200,
        }),
      );

    await copyCloudinaryResource({
      config: cloudinaryConfig,
      sourcePublicId:
        "pfseeker/pending-submissions/user-1/intent-1/source-file",
      targetPublicId: "pfseeker/published/pfp/asset-1",
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.cloudinary.com/v1_1/example-cloud/resources/image/upload/pfseeker/pending-submissions/user-1/intent-1/source-file",
    );
    const uploadBody = fetchMock.mock.calls[1]?.[1]?.body as URLSearchParams;
    expect(uploadBody.get("file")).toBe(
      "https://res.cloudinary.com/example-cloud/image/upload/v123/pfseeker/pending-submissions/user-1/intent-1/source-file.png",
    );
    expect(uploadBody.get("public_id")).toBe("pfseeker/published/pfp/asset-1");
    expect(uploadBody.get("public_id")).not.toContain(".png");
    expect(uploadBody.get("overwrite")).toBe("false");
  });

  it("uses runtime Cloudinary config names and not only public env names", () => {
    const source = read("src/server/services/cloudinary.ts");

    expect(source).toContain("runtimeEnv.CLOUDINARY_CLOUD_NAME");
    expect(source).toContain("runtimeEnv.CLOUDINARY_API_KEY");
    expect(source).toContain("runtimeEnv.CLOUDINARY_API_SECRET");
    expect(getCloudinaryConfig).toBeTypeOf("function");
  });

  it("leaves publication retryable when Cloudinary copy fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            public_id:
              "pfseeker/pending-submissions/user-1/intent-1/source-file",
            resource_type: "image",
            type: "upload",
            format: "png",
            bytes: 100,
            width: 512,
            height: 512,
            secure_url:
              "https://res.cloudinary.com/example-cloud/image/upload/v123/pfseeker/pending-submissions/user-1/intent-1/source-file.png",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "copy failed" } }), {
          status: 400,
        }),
      );
    const publishSubmission = vi.fn();
    const repository = {
      readSubmission: vi.fn().mockResolvedValue({
        id: "11111111-1111-4111-8111-111111111111",
        userId: "user-1",
        status: "pending",
        assetType: "pfp",
        title: "Pending",
        description: null,
        creatorCredit: null,
        sourceUrl: null,
        reviewedAt: null,
        publishedAssetId: null,
        publishedAssetSlug: null,
        rejectionReasonPublic: null,
        mediaCleanupStatus: "pending_media_present",
        category: { id: "category-1", slug: "phase-13-test", name: "Test" },
        tags: [{ id: "tag-1", slug: "phase-13-test", displayName: "Test" }],
        suggestedTags: [],
        cloudinaryPublicId:
          "pfseeker/pending-submissions/user-1/intent-1/source-file",
        cloudinaryResourceType: "image",
        cloudinaryFormat: "png",
        bytes: 100,
        width: 512,
        height: 512,
        contentHash: "hash",
        duplicatePendingFlag: false,
        createdAt: "2026-07-17T00:00:00.000Z",
        submitter: { id: "user-1", username: "user", globalName: null },
      }),
      validateModeratedMetadata: vi.fn().mockResolvedValue({
        title: "Published",
        description: null,
        categoryId: "category-1",
        categorySlug: "phase-13-test",
        tagIds: ["tag-1"],
        tagSlugs: ["phase-13-test"],
        creatorCredit: null,
        sourceUrl: null,
      }),
      uniqueAssetSlug: vi.fn().mockResolvedValue("published"),
      publishSubmission,
      markCleanupFailed: vi.fn(),
    };

    await expect(
      approveAndPublishSubmission({
        repository: repository as never,
        config: cloudinaryConfig,
        actorUserId: "owner-1",
        submissionId: "11111111-1111-4111-8111-111111111111",
        metadataInput: {
          title: "Published",
          description: "",
          category: "phase-13-test",
          tags: ["phase-13-test"],
          creatorCredit: "",
          sourceUrl: "",
        },
      }),
    ).rejects.toBeInstanceOf(InvalidRepositoryInputError);
    expect(publishSubmission).not.toHaveBeenCalled();
  });

  it("requires real moderator-assigned taxonomy before publication", () => {
    const repository = read("src/server/repositories/moderation.ts");
    const approveApi = read(
      "src/pages/api/moderation/submissions/[submissionId]/approve.ts",
    );

    expect(repository).toContain("Choose a category.");
    expect(repository).toContain("Choose at least one tag.");
    expect(approveApi).toContain("approveAndPublishSubmission");
  });
});

describe("Phase 13 submitter experience", () => {
  it("renders moderation lifecycle states without exposing internal notes", () => {
    const list = read("src/pages/submissions/index.astro");
    const detail = read("src/pages/submissions/[submissionId].astro");

    expect(list).toContain("submissionStatusLabels[submission.status]");
    expect(detail).toContain("submissionStatusLabels[submission.status]");
    expect(detail).toContain("rejectionReasonPublic");
    expect(detail).not.toContain("rejection_note_internal");
    expect(detail).not.toContain("moderation_events");
    expect(list).toContain('submission.status === "pending"');
  });

  it("does not add raw SQL to moderation pages", () => {
    for (const path of [
      "src/pages/moderation/index.astro",
      "src/pages/moderation/submissions/index.astro",
      "src/pages/moderation/submissions/[submissionId].astro",
      "src/pages/moderation/taxonomy.astro",
      "src/pages/moderation/history.astro",
      "src/pages/moderation/members.astro",
    ]) {
      expect(read(path), join(process.cwd(), path)).not.toContain(".prepare(");
    }
  });
});
