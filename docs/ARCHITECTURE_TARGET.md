# Target architecture

## Frontend

Recommended stack:

- Astro
- TypeScript strict mode
- compiled Tailwind CSS
- native browser APIs
- small hydrated islands only where necessary

Astro is appropriate because the platform needs crawlable public pages, minimal client JavaScript, and selected interactive experiences such as search, filters, lightboxes, and collections.

## Deployment

- GitHub repository is the source of truth.
- Cloudflare Pages deploys preview branches and production.
- `main` is the production branch unless repository constraints require otherwise.
- `pfseeker.com` is canonical.
- `www.pfseeker.com` redirects to the canonical host.

## Server-side functionality

Use Cloudflare Pages Functions or Workers for:

- Discord OAuth
- sessions
- signed Cloudinary uploads
- submissions
- moderation
- creator accounts
- synced collections
- download tracking
- reports
- protected administrative actions

Use Cloudflare D1 for relational data and migrations. Use KV only for cache-like or ephemeral data, not as a substitute for relational modeling.

## Cloudinary

Cloudinary stores and delivers:

- PFP originals
- banner originals
- icon originals
- generated thumbnails
- responsive sizes
- modern formats
- blur placeholders
- download originals

Store stable structured metadata, especially the Cloudinary public ID. Do not persist transformed URLs across the application.

Create one URL-generation module supporting:

- responsive `srcset`
- width and DPR variants
- automatic quality and format
- square PFP crops
- banner aspect ratios
- icon previews
- animated assets
- original downloads

Secrets remain server-side. Browser uploads must use short-lived signed upload parameters issued after authorization and validation.

## Suggested relational model

### users

- id
- discord_id
- username
- display_name
- avatar_url
- role
- created_at
- updated_at

### assets

- id
- public_id
- content_type
- title
- slug
- description
- format
- width
- height
- file_size
- status
- creator_id
- download_count
- created_at
- published_at
- updated_at

Content types:

- pfp
- banner
- icon

Publication states:

- draft
- pending
- approved
- rejected
- archived

### categories

- id
- name
- slug
- description
- content_type

### tags

- id
- name
- slug

### asset_categories

- asset_id
- category_id

### asset_tags

- asset_id
- tag_id

### collections

- id
- owner_id
- title
- slug
- description
- visibility
- cover_asset_id
- created_at
- updated_at

### collection_assets

- collection_id
- asset_id
- position

### downloads

- id
- asset_id
- user_id
- anonymous_hash
- created_at

### reports

- id
- asset_id
- reporter_id
- reason
- details
- status
- created_at

### moderation_events

- id
- actor_id
- target_type
- target_id
- action
- details
- created_at

## Route target

Public:

- `/`
- `/pfps`
- `/pfps/[category]`
- `/pfp/[slug]`
- `/banners`
- `/banners/[category]`
- `/banner/[slug]`
- `/icons`
- `/icons/[category]`
- `/icon/[slug]`
- `/collections`
- `/collection/[slug]`
- `/creators`
- `/creator/[slug-or-id]`
- `/search?q=`
- `/about`
- `/faq`
- `/privacy`
- `/terms`

Account:

- `/account`
- `/account/collections`
- `/account/submissions`
- `/account/settings`

Submission:

- `/submit`
- `/submit/pfp`
- `/submit/banner`
- `/submit/icon`
- `/submit/collection`

Administration:

- `/admin`
- `/admin/submissions`
- `/admin/assets`
- `/admin/users`
- `/admin/reports`
- `/admin/categories`

Administrative routes require server-side authorization on every request.

## Suggested repository layout

```text
pfseeker/
├─ .github/workflows/
├─ public/
├─ src/
│  ├─ assets/
│  ├─ components/
│  ├─ layouts/
│  ├─ pages/
│  ├─ content/
│  ├─ lib/
│  ├─ styles/
│  ├─ types/
│  └─ middleware.ts
├─ functions/
├─ migrations/
├─ scripts/
├─ tests/
├─ astro.config.mjs
├─ tailwind.config.mjs
├─ tsconfig.json
├─ wrangler.toml
├─ package.json
├─ .env.example
└─ README.md
```
