import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  allowedSubmissionFormats,
  MAX_ACTIVE_UPLOAD_INTENTS,
  MAX_COMPLETED_SUBMISSIONS_PER_24_HOURS,
  MAX_PENDING_SUBMISSIONS,
  PENDING_SUBMISSION_FOLDER,
  validateSourceUrl,
  validateSubmissionMetadata,
  validateSubmissionStatus,
  validateVerifiedImage,
  type ValidSubmissionCategory,
} from "@/lib/submissions";
import type { D1DatabaseLike, D1PreparedStatementLike } from "@/server/db/d1";
import { InvalidRepositoryInputError } from "@/server/repositories/errors";
import {
  SubmissionRepository,
  type CreateSubmissionInput,
} from "@/server/repositories/submissions";
import {
  createPendingPublicId,
  publicIdInPendingNamespace,
} from "@/server/services/cloudinary";

interface IntentRecord {
  id: string;
  user_id: string;
  asset_type: "pfp" | "banner" | "icon";
  public_id: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

interface SubmissionRecord {
  id: string;
  user_id: string;
  status: "pending";
  asset_type: "pfp" | "banner" | "icon";
  submitted_title: string;
  description: string | null;
  creator_credit: string | null;
  source_url: string | null;
  category_id: string | null;
  cloudinary_public_id: string;
  cloudinary_resource_type: "image";
  cloudinary_format: "jpg" | "jpeg" | "png" | "webp" | "gif";
  bytes: number;
  width: number;
  height: number;
  content_hash: string;
  duplicate_pending_flag: number;
  created_at: string;
}

class FakeStatement implements D1PreparedStatementLike {
  private values: unknown[] = [];

  constructor(
    private readonly query: string,
    private readonly db: FakeSubmissionD1,
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

class FakeSubmissionD1 implements D1DatabaseLike {
  intents = new Map<string, IntentRecord>();
  submissions = new Map<string, SubmissionRecord>();
  submissionTags = new Map<string, string[]>();
  suggestedTags = new Map<string, string[]>();
  categories = new Map([
    [
      "minimal",
      {
        id: "category-minimal",
        slug: "minimal",
        name: "Minimal",
        supported_kinds: "pfp,icon",
      },
    ],
  ]);
  tags = new Map([
    ["quiet", { id: "tag-quiet", slug: "quiet", display_name: "quiet" }],
    ["soft", { id: "tag-soft", slug: "soft", display_name: "soft" }],
  ]);
  publishedHashes = new Map<string, { kind: "pfp"; slug: string }>();

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

  resultsFor<T>(query: string, values: unknown[]): T[] {
    if (
      query.includes("COUNT(*) AS count") &&
      query.includes("submission_upload_intents")
    ) {
      const [userId] = values;
      return [
        {
          count: Array.from(this.intents.values()).filter(
            (intent) => intent.user_id === userId && !intent.consumed_at,
          ).length,
        },
      ] as T[];
    }

    if (query.includes("FROM submission_upload_intents")) {
      const [id, userId] = values;
      return Array.from(this.intents.values()).filter(
        (intent) => intent.id === id && intent.user_id === userId,
      ) as T[];
    }

    if (
      query.includes("COUNT(*) AS count") &&
      query.includes("created_at >=")
    ) {
      const [userId, since] = values;
      return [
        {
          count: Array.from(this.submissions.values()).filter(
            (submission) =>
              submission.user_id === userId &&
              submission.created_at >= String(since),
          ).length,
        },
      ] as T[];
    }

    if (
      query.includes("COUNT(*) AS count") &&
      query.includes("status = 'pending'")
    ) {
      const [userId] = values;
      return [
        {
          count: Array.from(this.submissions.values()).filter(
            (submission) => submission.user_id === userId,
          ).length,
        },
      ] as T[];
    }

    if (
      query.includes("FROM submissions") &&
      query.includes("content_hash = ?")
    ) {
      const [first, second] = values;
      if (query.includes("user_id <>")) {
        return Array.from(this.submissions.values())
          .filter(
            (submission) =>
              submission.user_id !== first &&
              submission.content_hash === second,
          )
          .map((submission) => ({ id: submission.id })) as T[];
      }
      return Array.from(this.submissions.values())
        .filter(
          (submission) =>
            submission.user_id === first && submission.content_hash === second,
        )
        .map((submission) => ({ id: submission.id })) as T[];
    }

    if (query.includes("FROM assets") && query.includes("content_hash")) {
      const duplicate = this.publishedHashes.get(String(values[0]));
      return duplicate ? ([duplicate] as T[]) : [];
    }

    if (
      query.includes("FROM categories") &&
      !query.includes("JOIN categories")
    ) {
      const category = this.categories.get(String(values[0]));
      return category ? ([category] as T[]) : [];
    }

    if (query.includes("FROM tags WHERE slug")) {
      const tag = this.tags.get(String(values[0]));
      return tag ? ([{ id: tag.id }] as T[]) : [];
    }

    if (query.includes("FROM submission_tags")) {
      const tagIds = this.submissionTags.get(String(values[0])) ?? [];
      return tagIds
        .map((id) =>
          Array.from(this.tags.values()).find((tag) => tag.id === id),
        )
        .filter(Boolean) as T[];
    }

    if (query.includes("FROM submission_suggested_tags")) {
      return (this.suggestedTags.get(String(values[0])) ?? []).map(
        (suggested_tag) => ({ suggested_tag }),
      ) as T[];
    }

    if (
      query.includes("FROM submissions") &&
      query.includes("JOIN categories")
    ) {
      const rows = Array.from(this.submissions.values()).filter(
        (submission) => {
          if (query.includes("submissions.id = ?")) {
            return (
              submission.id === values[0] && submission.user_id === values[1]
            );
          }
          return submission.user_id === values[0];
        },
      );
      return rows.map((submission) => {
        const category = Array.from(this.categories.values()).find(
          (entry) => entry.id === submission.category_id,
        );
        return {
          ...submission,
          category_slug: category?.slug ?? null,
          category_name: category?.name ?? null,
        };
      }) as T[];
    }

    return [];
  }

  run(query: string, values: unknown[]): void {
    if (query.includes("INSERT INTO submission_upload_intents")) {
      const [id, userId, assetType, publicId, expiresAt, createdAt] = values;
      this.intents.set(String(id), {
        id: String(id),
        user_id: String(userId),
        asset_type: assetType as IntentRecord["asset_type"],
        public_id: String(publicId),
        expires_at: String(expiresAt),
        consumed_at: null,
        created_at: String(createdAt),
      });
    }

    if (query.includes("UPDATE submission_upload_intents")) {
      const [consumedAt, id, userId] = values;
      const intent = this.intents.get(String(id));
      if (intent && intent.user_id === userId && !intent.consumed_at) {
        intent.consumed_at = String(consumedAt);
      }
    }

    if (query.includes("INSERT INTO submissions")) {
      const [
        id,
        userId,
        assetType,
        title,
        description,
        creatorCredit,
        sourceUrl,
        categoryId,
        publicId,
        resourceType,
        format,
        bytes,
        width,
        height,
        contentHash,
        duplicatePendingFlag,
        createdAt,
      ] = values;
      this.submissions.set(String(id), {
        id: String(id),
        user_id: String(userId),
        status: "pending",
        asset_type: assetType as SubmissionRecord["asset_type"],
        submitted_title: String(title),
        description: description ? String(description) : null,
        creator_credit: creatorCredit ? String(creatorCredit) : null,
        source_url: sourceUrl ? String(sourceUrl) : null,
        category_id: categoryId ? String(categoryId) : null,
        cloudinary_public_id: String(publicId),
        cloudinary_resource_type: resourceType as "image",
        cloudinary_format: format as SubmissionRecord["cloudinary_format"],
        bytes: Number(bytes),
        width: Number(width),
        height: Number(height),
        content_hash: String(contentHash),
        duplicate_pending_flag: Number(duplicatePendingFlag),
        created_at: String(createdAt),
      });
    }

    if (query.includes("INSERT INTO submission_tags")) {
      const [submissionId, tagId] = values;
      this.submissionTags.set(String(submissionId), [
        ...(this.submissionTags.get(String(submissionId)) ?? []),
        String(tagId),
      ]);
    }

    if (query.includes("INSERT INTO submission_suggested_tags")) {
      const [submissionId, tag] = values;
      this.suggestedTags.set(String(submissionId), [
        ...(this.suggestedTags.get(String(submissionId)) ?? []),
        String(tag),
      ]);
    }

    if (query.includes("DELETE FROM submissions")) {
      const [submissionId, userId] = values;
      const submission = this.submissions.get(String(submissionId));
      if (submission?.user_id === userId) {
        this.submissions.delete(String(submissionId));
        this.submissionTags.delete(String(submissionId));
        this.suggestedTags.delete(String(submissionId));
      }
    }
  }
}

function validMetadata() {
  return {
    assetType: "pfp",
    title: "  Quiet   Image ",
    category: "minimal",
    tags: ["quiet", "soft"],
    description: "  Short   note ",
    creatorCredit: " Found online ",
    sourceUrl: "https://example.com/source#frag",
    suggestedTags: ["calm", "muted"],
    contentRulesConfirmed: true,
  };
}

const validCategories: ValidSubmissionCategory[] = [
  { slug: "minimal", kinds: ["pfp", "icon"] },
  { slug: "wide", kinds: ["banner"] },
];

function createInput(
  overrides: Partial<CreateSubmissionInput> = {},
): CreateSubmissionInput {
  const metadata = validateSubmissionMetadata(
    validMetadata(),
    ["quiet", "soft"],
    validCategories,
  );
  if (!metadata.ok) throw new Error(metadata.message);
  return {
    userId: "user-1",
    intentId: "11111111-1111-4111-8111-111111111111",
    publicId:
      "pfseeker/pending-submissions/user-1/11111111-1111-4111-8111-111111111111/file",
    metadata: metadata.metadata,
    cloudinary: {
      resourceType: "image",
      format: "png",
      bytes: 1000,
      width: 512,
      height: 512,
      contentHash: "hash-1",
    },
    ...overrides,
  };
}

describe("submission validation", () => {
  it("normalizes metadata and enforces required fields", () => {
    expect(
      validateSubmissionMetadata(
        validMetadata(),
        ["quiet", "soft"],
        validCategories,
      ),
    ).toMatchObject({
      ok: true,
      metadata: {
        title: "Quiet Image",
        category: "minimal",
        tags: ["quiet", "soft"],
        creatorCredit: "Found online",
        sourceUrl: "https://example.com/source",
      },
    });
    expect(
      validateSubmissionMetadata(
        { ...validMetadata(), title: "x" },
        ["quiet"],
        validCategories,
      ),
    ).toMatchObject({ ok: false });
    expect(
      validateSubmissionMetadata(
        { ...validMetadata(), tags: ["quiet", "unknown"] },
        ["quiet"],
        validCategories,
      ),
    ).toMatchObject({ ok: false });
    expect(
      validateSubmissionMetadata(
        { ...validMetadata(), suggestedTags: ["a"] },
        ["quiet", "soft"],
        validCategories,
      ),
    ).toMatchObject({ ok: false });
    expect(
      validateSubmissionMetadata(
        { ...validMetadata(), contentRulesConfirmed: false },
        ["quiet", "soft"],
        validCategories,
      ),
    ).toMatchObject({ ok: false });
  });

  it("accepts optional category and existing tags from zero to five", () => {
    expect(
      validateSubmissionMetadata(
        { ...validMetadata(), category: undefined, tags: undefined },
        [],
        [],
      ),
    ).toMatchObject({
      ok: true,
      metadata: { category: null, tags: [] },
    });
    expect(
      validateSubmissionMetadata(
        { ...validMetadata(), category: "", tags: [] },
        [],
        [],
      ),
    ).toMatchObject({
      ok: true,
      metadata: { category: null, tags: [] },
    });
    expect(
      validateSubmissionMetadata(
        { ...validMetadata(), category: "minimal", tags: ["quiet"] },
        ["quiet"],
        validCategories,
      ),
    ).toMatchObject({
      ok: true,
      metadata: { category: "minimal", tags: ["quiet"] },
    });
    expect(
      validateSubmissionMetadata(
        {
          ...validMetadata(),
          tags: ["one", "two", "three", "four", "five"],
        },
        ["one", "two", "three", "four", "five"],
        validCategories,
      ),
    ).toMatchObject({ ok: true });
  });

  it("rejects invalid optional taxonomy and normalizes duplicate tags", () => {
    expect(
      validateSubmissionMetadata(
        { ...validMetadata(), category: "unknown" },
        ["quiet"],
        validCategories,
      ),
    ).toMatchObject({ ok: false, field: "category" });
    expect(
      validateSubmissionMetadata(
        { ...validMetadata(), assetType: "pfp", category: "wide" },
        ["quiet"],
        validCategories,
      ),
    ).toMatchObject({ ok: false, field: "category" });
    expect(
      validateSubmissionMetadata(
        { ...validMetadata(), tags: ["quiet", "quiet", "soft"] },
        ["quiet", "soft"],
        validCategories,
      ),
    ).toMatchObject({
      ok: true,
      metadata: { tags: ["quiet", "soft"] },
    });
    expect(
      validateSubmissionMetadata(
        {
          ...validMetadata(),
          tags: ["one", "two", "three", "four", "five", "six"],
        },
        ["one", "two", "three", "four", "five", "six"],
        validCategories,
      ),
    ).toMatchObject({ ok: false, field: "tags" });
    expect(
      validateSubmissionMetadata(
        { ...validMetadata(), tags: [1] },
        ["quiet"],
        validCategories,
      ),
    ).toMatchObject({ ok: false, field: "tags" });
  });

  it("allows only safe source URLs and pending status", () => {
    expect(validateSourceUrl("https://example.com/a")).toMatchObject({
      ok: true,
    });
    expect(validateSourceUrl("javascript:alert(1)")).toMatchObject({
      ok: false,
    });
    expect(validateSourceUrl("data:text/html,hi")).toMatchObject({ ok: false });
    expect(validateSubmissionStatus("pending")).toBe(true);
    expect(validateSubmissionStatus("approved")).toBe(false);
  });

  it("enforces allowed formats, file sizes, dimensions, and GIF workload", () => {
    expect(allowedSubmissionFormats).toEqual([
      "jpg",
      "jpeg",
      "png",
      "webp",
      "gif",
    ]);
    expect(
      validateVerifiedImage("pfp", {
        format: "svg",
        bytes: 1,
        width: 512,
        height: 512,
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateVerifiedImage("icon", {
        format: "png",
        bytes: 5 * 1024 * 1024,
        width: 64,
        height: 64,
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateVerifiedImage("icon", {
        format: "png",
        bytes: 100,
        width: 10,
        height: 64,
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateVerifiedImage("pfp", {
        format: "gif",
        bytes: 100,
        width: 2048,
        height: 2048,
        frameCount: 101,
      }),
    ).toMatchObject({ ok: false });
    expect(
      validateVerifiedImage("pfp", {
        format: "webp",
        bytes: 100,
        width: 512,
        height: 512,
      }),
    ).toMatchObject({ ok: true });
  });

  it("keeps the submission form submittable without taxonomy choices", () => {
    const page = readFileSync("src/pages/submissions/new.astro", "utf8");
    const client = readFileSync("src/scripts/submissions-client.ts", "utf8");

    expect(page).toContain("Categories are not available yet.");
    expect(page).toContain("Tags are not available yet.");
    expect(page).toContain('<select name="category" data-submission-category>');
    expect(page).not.toContain('<select name="category" required');
    expect(client).not.toContain("selectedTags().length < 1");
    expect(client).toContain("selectedTags().length > 5");
  });

  it("renders pending submission media with runtime Cloudinary config", () => {
    const listPage = readFileSync("src/pages/submissions/index.astro", "utf8");
    const detailPage = readFileSync(
      "src/pages/submissions/[submissionId].astro",
      "utf8",
    );

    expect(listPage).toContain("getCloudinaryConfig(Astro.locals)");
    expect(detailPage).toContain("getCloudinaryConfig(Astro.locals)");
    expect(listPage).toContain("cloudName: cloudinaryConfig.cloudName");
    expect(detailPage).toContain("cloudName: cloudinaryConfig.cloudName");
  });
});

describe("submission migration", () => {
  it("adds pending submissions, upload intents, relations, hashes, and indexes", () => {
    const migration = readFileSync(
      "migrations/0004_signed_submissions.sql",
      "utf8",
    );

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS submissions");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS submission_tags");
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS submission_upload_intents",
    );
    expect(migration).toContain("status TEXT NOT NULL DEFAULT 'pending'");
    expect(migration).toContain("CHECK (status IN ('pending'))");
    expect(migration).toContain("FOREIGN KEY (user_id) REFERENCES users(id)");
    expect(migration).toContain("ON DELETE CASCADE");
    expect(migration).toContain("idx_submissions_user_created");
    expect(migration).toContain("idx_submissions_content_hash_user");
    expect(migration).not.toMatch(/\bmoderator|approval|rejection|audit\b/i);
  });

  it("adds the optional taxonomy migration without recreating unrelated tables", () => {
    const migration = readFileSync(
      "migrations/0005_optional_submission_taxonomy.sql",
      "utf8",
    );

    expect(migration).toContain("CREATE TABLE submissions_new");
    expect(migration).toContain("category_id TEXT,");
    expect(migration).toContain(
      "ALTER TABLE submissions_new RENAME TO submissions",
    );
    expect(migration).not.toContain("CREATE TABLE assets");
    expect(migration).not.toContain("CREATE TABLE tags");
    expect(migration).not.toContain("CREATE TABLE categories");
  });
});

describe("Cloudinary upload boundaries", () => {
  it("creates unpredictable pending public IDs and rejects unsafe namespaces", () => {
    const publicId = createPendingPublicId({
      userId: "user-1",
      intentId: "intent-1",
      folder: PENDING_SUBMISSION_FOLDER,
    });

    expect(publicId).toMatch(
      /^pfseeker\/pending-submissions\/user-1\/intent-1\/[a-f0-9]{32}$/,
    );
    expect(publicIdInPendingNamespace(publicId)).toBe(true);
    expect(publicIdInPendingNamespace("pfseeker/public/file")).toBe(false);
    expect(
      publicIdInPendingNamespace("pfseeker/pending-submissions/../file"),
    ).toBe(false);
    expect(publicIdInPendingNamespace("https://example.com/file")).toBe(false);
  });
});

describe("submission repository", () => {
  it("creates pending submissions, consumes upload intents, and lists owner rows", async () => {
    const db = new FakeSubmissionD1();
    const repository = new SubmissionRepository(db);
    const input = createInput();
    await repository.createUploadIntent({
      id: input.intentId,
      userId: input.userId,
      assetType: "pfp",
      publicId: input.publicId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const submission = await repository.createPendingSubmission(input);
    const listed = await repository.listOwnedPendingSubmissions(input.userId);

    expect(submission.status).toBe("pending");
    expect(submission.tags.map((tag) => tag.slug)).toEqual(["quiet", "soft"]);
    expect(listed).toHaveLength(1);
    expect(db.intents.get(input.intentId)?.consumed_at).toBeTruthy();
  });

  it("creates, lists, reads, and cancels submissions without taxonomy", async () => {
    const db = new FakeSubmissionD1();
    const repository = new SubmissionRepository(db);
    const metadata = validateSubmissionMetadata(
      {
        ...validMetadata(),
        category: "",
        tags: undefined,
        suggestedTags: [],
      },
      [],
      [],
    );
    if (!metadata.ok) throw new Error(metadata.message);
    const input = createInput({
      intentId: "55555555-5555-4555-8555-555555555555",
      publicId:
        "pfseeker/pending-submissions/user-1/55555555-5555-4555-8555-555555555555/file",
      metadata: metadata.metadata,
      cloudinary: {
        resourceType: "image",
        format: "png",
        bytes: 1000,
        width: 512,
        height: 512,
        contentHash: "hash-without-taxonomy",
      },
    });
    await repository.createUploadIntent({
      id: input.intentId,
      userId: input.userId,
      assetType: "pfp",
      publicId: input.publicId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const submission = await repository.createPendingSubmission(input);
    const listed = await repository.listOwnedPendingSubmissions(input.userId);
    const read = await repository.readOwnedSubmission(
      input.userId,
      submission.id,
    );

    expect(submission.category).toBeNull();
    expect(submission.tags).toEqual([]);
    expect(db.submissionTags.get(submission.id)).toBeUndefined();
    expect(listed[0]?.category).toBeNull();
    expect(read.category).toBeNull();

    await repository.deleteOwnedSubmission({
      userId: input.userId,
      submissionId: submission.id,
    });
    await expect(
      repository.readOwnedSubmission(input.userId, submission.id),
    ).rejects.toThrow("Submission was not found");
  });

  it("enforces ownership and cancellation removal", async () => {
    const db = new FakeSubmissionD1();
    const repository = new SubmissionRepository(db);
    const input = createInput();
    await repository.createUploadIntent({
      id: input.intentId,
      userId: input.userId,
      assetType: "pfp",
      publicId: input.publicId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const submission = await repository.createPendingSubmission(input);

    await expect(
      repository.readOwnedSubmission("other-user", submission.id),
    ).rejects.toThrow("Submission was not found");

    await repository.deleteOwnedSubmission({
      userId: input.userId,
      submissionId: submission.id,
    });
    await expect(
      repository.readOwnedSubmission(input.userId, submission.id),
    ).rejects.toThrow("Submission was not found");
  });

  it("blocks intent replay, expired intents, same-user duplicates, and published duplicates", async () => {
    const db = new FakeSubmissionD1();
    const repository = new SubmissionRepository(db);
    const input = createInput();
    await repository.createUploadIntent({
      id: input.intentId,
      userId: input.userId,
      assetType: "pfp",
      publicId: input.publicId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await repository.createPendingSubmission(input);
    await expect(repository.createPendingSubmission(input)).rejects.toThrow(
      "already used",
    );

    const duplicate = createInput({
      intentId: "22222222-2222-4222-8222-222222222222",
      publicId:
        "pfseeker/pending-submissions/user-1/22222222-2222-4222-8222-222222222222/file",
    });
    await repository.createUploadIntent({
      id: duplicate.intentId,
      userId: duplicate.userId,
      assetType: "pfp",
      publicId: duplicate.publicId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await expect(repository.createPendingSubmission(duplicate)).rejects.toThrow(
      "already submitted",
    );

    db.publishedHashes.set("hash-published", { kind: "pfp", slug: "existing" });
    const publishedDuplicate = createInput({
      intentId: "33333333-3333-4333-8333-333333333333",
      publicId:
        "pfseeker/pending-submissions/user-1/33333333-3333-4333-8333-333333333333/file",
      cloudinary: {
        resourceType: "image",
        format: "png",
        bytes: 1000,
        width: 512,
        height: 512,
        contentHash: "hash-published",
      },
    });
    await repository.createUploadIntent({
      id: publishedDuplicate.intentId,
      userId: publishedDuplicate.userId,
      assetType: "pfp",
      publicId: publishedDuplicate.publicId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    await expect(
      repository.createPendingSubmission(publishedDuplicate),
    ).rejects.toThrow("/pfp/existing");

    const expired = createInput({
      intentId: "44444444-4444-4444-8444-444444444444",
      publicId:
        "pfseeker/pending-submissions/user-1/44444444-4444-4444-8444-444444444444/file",
      cloudinary: {
        resourceType: "image",
        format: "png",
        bytes: 1000,
        width: 512,
        height: 512,
        contentHash: "hash-expired",
      },
    });
    await repository.createUploadIntent({
      id: expired.intentId,
      userId: expired.userId,
      assetType: "pfp",
      publicId: expired.publicId,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    await expect(repository.createPendingSubmission(expired)).rejects.toThrow(
      "expired",
    );
  });

  it("enforces active upload, rolling daily, and pending quotas", async () => {
    const db = new FakeSubmissionD1();
    const repository = new SubmissionRepository(db);
    for (let index = 0; index < MAX_ACTIVE_UPLOAD_INTENTS; index += 1) {
      await repository.createUploadIntent({
        id: crypto.randomUUID(),
        userId: "user-1",
        assetType: "pfp",
        publicId: `${PENDING_SUBMISSION_FOLDER}/user-1/${index}/file`,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
    }
    await expect(repository.assertCanCreateIntent("user-1")).rejects.toThrow(
      "Too many upload flows",
    );

    db.intents.clear();
    for (
      let index = 0;
      index < MAX_COMPLETED_SUBMISSIONS_PER_24_HOURS;
      index += 1
    ) {
      db.submissions.set(`submission-${index}`, {
        ...db.submissions.values().next().value,
        id: `submission-${index}`,
        user_id: "quota-user",
        status: "pending",
        asset_type: "pfp",
        submitted_title: "Quota",
        description: null,
        creator_credit: null,
        source_url: null,
        category_id: "category-minimal",
        cloudinary_public_id: `public-${index}`,
        cloudinary_resource_type: "image",
        cloudinary_format: "png",
        bytes: 100,
        width: 512,
        height: 512,
        content_hash: `hash-${index}`,
        duplicate_pending_flag: 0,
        created_at: new Date().toISOString(),
      });
    }
    await expect(
      repository.assertCanCompleteSubmission("quota-user"),
    ).rejects.toThrow("Daily submission limit");

    db.submissions.clear();
    for (let index = 0; index < MAX_PENDING_SUBMISSIONS; index += 1) {
      db.submissions.set(`pending-${index}`, {
        id: `pending-${index}`,
        user_id: "pending-user",
        status: "pending",
        asset_type: "pfp",
        submitted_title: "Pending",
        description: null,
        creator_credit: null,
        source_url: null,
        category_id: "category-minimal",
        cloudinary_public_id: `pending-public-${index}`,
        cloudinary_resource_type: "image",
        cloudinary_format: "png",
        bytes: 100,
        width: 512,
        height: 512,
        content_hash: `pending-hash-${index}`,
        duplicate_pending_flag: 0,
        created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      });
    }
    await expect(
      repository.assertCanCompleteSubmission("pending-user"),
    ).rejects.toThrow("50 pending");
  });

  it("throws typed errors for malformed submission IDs", async () => {
    const repository = new SubmissionRepository(new FakeSubmissionD1());
    await expect(
      repository.readOwnedSubmission("user-1", "not-an-id"),
    ).rejects.toBeInstanceOf(InvalidRepositoryInputError);
  });
});
