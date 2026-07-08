import type { APIContext, AstroGlobal } from "astro";

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta?: unknown }>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch<T = unknown>(statements: D1PreparedStatementLike[]): Promise<T[]>;
}

export interface PfseekerBindings {
  DB?: D1DatabaseLike;
  CF_PAGES?: string;
  CF_PAGES_BRANCH?: string;
  ENVIRONMENT?: string;
  PUBLIC_SITE_URL?: string;
  PUBLIC_CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  CLOUDINARY_PENDING_SUBMISSIONS_FOLDER?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  DISCORD_REDIRECT_URI?: string;
  SESSION_SECRET?: string;
}

export interface RuntimeWithEnv {
  runtime?: {
    env?: PfseekerBindings;
  };
}

interface CloudflareWorkersModule {
  env?: PfseekerBindings;
}

export class MissingDatabaseBindingError extends Error {
  constructor(message = "Cloudflare D1 binding DB is not available.") {
    super(message);
    this.name = "MissingDatabaseBindingError";
  }
}

export function getRuntimeEnv(
  locals: AstroGlobal["locals"] | APIContext["locals"],
): PfseekerBindings {
  try {
    return ((locals as RuntimeWithEnv).runtime?.env ?? {}) as PfseekerBindings;
  } catch {
    return {};
  }
}

export async function getCloudflareRuntimeEnv(
  locals: AstroGlobal["locals"] | APIContext["locals"],
): Promise<PfseekerBindings> {
  const localEnv = getRuntimeEnv(locals);

  if (localEnv.DB || localEnv.CF_PAGES) {
    return localEnv;
  }

  try {
    const workerModule =
      (await import("cloudflare:workers")) as CloudflareWorkersModule;
    return workerModule.env ?? {};
  } catch {
    return {};
  }
}

export function getD1Database(
  locals: AstroGlobal["locals"] | APIContext["locals"],
): D1DatabaseLike {
  const db = getRuntimeEnv(locals).DB;

  if (!db) {
    throw new MissingDatabaseBindingError(
      "Cloudflare D1 binding DB is missing. Apply the D1 binding for this environment before using the D1 repository.",
    );
  }

  return db;
}

export async function getD1DatabaseAsync(
  locals: AstroGlobal["locals"] | APIContext["locals"],
): Promise<D1DatabaseLike> {
  const db = (await getCloudflareRuntimeEnv(locals)).DB;

  if (!db) {
    throw new MissingDatabaseBindingError(
      "Cloudflare D1 binding DB is missing. Apply the D1 binding for this environment before using the D1 repository.",
    );
  }

  return db;
}

export function isCloudflarePagesRuntime(
  locals: AstroGlobal["locals"] | APIContext["locals"],
): boolean {
  return getRuntimeEnv(locals).CF_PAGES === "1";
}
