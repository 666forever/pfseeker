import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import { seedAssets } from "../src/data/assets";
import { seedCategories } from "../src/data/categories";

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function statement(sql: string): string {
  return `${sql};`;
}

function parseOutPath(args: string[]): string | undefined {
  const index = args.indexOf("--out");
  return index === -1 ? undefined : args[index + 1];
}

interface GenerateSeedSqlOptions {
  transaction?: boolean;
}

export function generateSeedSql(options: GenerateSeedSqlOptions = {}): string {
  const transaction = options.transaction ?? true;
  const now = "2026-07-05T00:00:00.000Z";
  const tagSlugs = Array.from(
    new Set(seedAssets.flatMap((asset) => asset.tags.map(normalizeToken))),
  ).sort();

  const lines: string[] = ["PRAGMA foreign_keys = ON;"];

  if (transaction) {
    lines.push("BEGIN TRANSACTION;");
  }

  for (const category of seedCategories) {
    lines.push(
      statement(`INSERT INTO categories (
      id, slug, name, description, supported_kinds, created_at, updated_at
    ) VALUES (
      ${sqlString(`category-${category.slug}`)},
      ${sqlString(category.slug)},
      ${sqlString(category.name)},
      ${sqlString(category.description)},
      ${sqlString(category.kinds.join(","))},
      ${sqlString(now)},
      ${sqlString(now)}
    ) ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      name = excluded.name,
      description = excluded.description,
      supported_kinds = excluded.supported_kinds,
      updated_at = excluded.updated_at`),
    );
  }

  for (const tag of tagSlugs) {
    lines.push(
      statement(`INSERT INTO tags (
      id, slug, display_name, created_at, updated_at
    ) VALUES (
      ${sqlString(`tag-${tag}`)},
      ${sqlString(tag)},
      ${sqlString(tag)},
      ${sqlString(now)},
      ${sqlString(now)}
    ) ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      display_name = excluded.display_name,
      updated_at = excluded.updated_at`),
    );
  }

  for (const asset of seedAssets) {
    lines.push(
      statement(`INSERT INTO assets (
      id, slug, kind, title, alt_text, media_source_type, durable_media_ref,
      cloudinary_public_id, width, height, format, animation, palette_json,
      motif, status, published_at, created_at, updated_at
    ) VALUES (
      ${sqlString(asset.id)},
      ${sqlString(asset.slug)},
      ${sqlString(asset.kind)},
      ${sqlString(asset.title)},
      ${sqlString(asset.alt)},
      'local_seed',
      ${sqlString(asset.localSource)},
      NULL,
      ${asset.width},
      ${asset.height},
      ${sqlString(asset.format)},
      ${sqlString(asset.animation)},
      ${sqlString(JSON.stringify(asset.palette))},
      ${sqlString(asset.motif)},
      'published',
      ${sqlString(`${asset.publishedAt}T00:00:00.000Z`)},
      ${sqlString(now)},
      ${sqlString(now)}
    ) ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      kind = excluded.kind,
      title = excluded.title,
      alt_text = excluded.alt_text,
      media_source_type = excluded.media_source_type,
      durable_media_ref = excluded.durable_media_ref,
      cloudinary_public_id = excluded.cloudinary_public_id,
      width = excluded.width,
      height = excluded.height,
      format = excluded.format,
      animation = excluded.animation,
      palette_json = excluded.palette_json,
      motif = excluded.motif,
      status = excluded.status,
      published_at = excluded.published_at,
      updated_at = excluded.updated_at`),
    );

    lines.push(
      statement(
        `DELETE FROM asset_categories WHERE asset_id = ${sqlString(asset.id)}`,
      ),
    );
    for (const category of asset.categories) {
      lines.push(
        statement(`INSERT INTO asset_categories (asset_id, category_id)
        VALUES (${sqlString(asset.id)}, ${sqlString(`category-${category}`)})`),
      );
    }

    lines.push(
      statement(
        `DELETE FROM asset_tags WHERE asset_id = ${sqlString(asset.id)}`,
      ),
    );
    for (const tag of asset.tags.map(normalizeToken)) {
      lines.push(
        statement(`INSERT INTO asset_tags (asset_id, tag_id)
        VALUES (${sqlString(asset.id)}, ${sqlString(`tag-${tag}`)})`),
      );
    }
  }

  if (transaction) {
    lines.push("COMMIT;");
  }

  return `${lines.join("\n")}\n`;
}

export function writeSeedSql(args: string[]): void {
  const output = generateSeedSql({
    transaction: !args.includes("--no-transaction"),
  });
  const outPath = parseOutPath(args);

  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, output, "utf8");
  } else {
    process.stdout.write(output);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  writeSeedSql(process.argv.slice(2));
}
