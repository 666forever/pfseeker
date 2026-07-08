# pfseeker Authentication

## Policy

Phase 10 implements open Discord sign-in for ordinary pfseeker users.

- Any valid Discord account may authenticate.
- OAuth requests use the `identify` scope only.
- pfseeker does not require Discord guild membership.
- pfseeker does not use a Discord bot token.
- Phase 10 does not assign moderator, administrator, creator, or role-based access.
- Future authorization must be stored and enforced by pfseeker server-side code, not trusted from client claims.

## Discord application

- Approved Discord client ID: `1523444161951437050`
- Registered redirect URIs:
  - `http://localhost:4321/auth/discord/callback`
  - `http://127.0.0.1:4321/auth/discord/callback`
  - `https://pfseeker.com/auth/discord/callback`

Local development should use the localhost redirect in `.env`. Production should use the `https://pfseeker.com` redirect configured in Cloudflare. Arbitrary Cloudflare preview deployment URLs are not registered and should show a configuration error rather than reusing production OAuth settings.

## Production verification

Production OAuth was manually verified on 2026-07-08 at `https://pfseeker.com`.

- The Astro SSR site loads through Cloudflare Pages.
- Discord sign-in opens and requests the approved identity access.
- The production callback completes at `https://pfseeker.com/auth/discord/callback`.
- Authenticated users reach `/account`.
- Signed-in state persists after page refresh.
- Logout revokes the session and returns the user to the signed-out state.

Cloudflare Pages deploys the SSR runtime through the Pages advanced-mode `_worker.js` compatibility layer added in commit `f41c81a9`. The root Pages configuration uses `pages_build_output_dir = "./dist/client"` and Cloudflare builds run on Node `24.16.0`.

## Environment

Required server-side variables:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `SESSION_SECRET`

`SESSION_SECRET` must be at least 32 characters. Validation errors identify the missing or invalid variable name but never include secret values.

## Routes

- `GET /auth/discord` creates a short-lived OAuth state record, stores a browser-bound state cookie, and redirects to Discord with `response_type=code` and `scope=identify`.
- `GET /auth/discord/callback` validates the state, exchanges the code server-side, fetches `/users/@me`, creates or updates the local user, creates a new session, and redirects to the validated return path.
- `POST /auth/logout` revokes the current D1 session and clears the cookie.
- `/account` is a protected account identity page and is marked `noindex`.
- `/auth/error` shows safe, noindex authentication errors.

## OAuth state

OAuth state is persisted in D1 in `oauth_states`.

- The raw state value is random and browser-bound with an HTTP-only cookie.
- D1 stores only an HMAC hash of the state.
- State records expire after 10 minutes.
- State records are single-use and marked used during callback validation.
- Return paths are stored only after strict same-origin relative-path validation.

## Users

The `users` table stores only Discord identity fields available from the `identify` scope:

- local user ID
- Discord user ID
- username
- global display name
- avatar hash
- account status
- created, updated, and last-login timestamps

pfseeker does not store Discord email, guilds, roles, linked accounts, access tokens, or refresh tokens in Phase 10.

## Sessions

Sessions are D1-backed opaque sessions.

- A cryptographically random token is generated on login.
- The raw token is stored only in the `pfseeker_session` HTTP-only cookie.
- D1 stores only an HMAC hash of the token.
- Session lifetime is 30 days.
- Expired or revoked sessions are rejected.
- Logout revokes server-side state before clearing the cookie.
- `last_seen_at` updates are throttled to avoid writing on every request.

The Cloudflare adapter-generated `SESSION` KV binding can still appear in build output. pfseeker does not use that KV binding for Phase 10 authentication.

## Cookies

`pfseeker_session`:

- `HttpOnly`
- `Secure` in production
- `SameSite=Lax`
- `Path=/`
- finite `Max-Age`
- no `Domain`

`pfseeker_oauth_state` uses the same HTTP-only and SameSite model with a short max age. Phase 10 keeps the non-prefixed cookie name so local HTTP development and production share the same application code. A `__Host-` production-only rename can be considered during the security hardening phase.

## Redirect safety

Post-login return paths must be same-origin relative paths beginning with `/`. The validator rejects external URLs, protocol-relative URLs, backslashes, encoded external redirect tricks, and auth callback loops. Invalid or missing return paths fall back to `/account`.

## Logout and CSRF

Logout is POST-only. SameSite=Lax reduces cross-site cookie submission, and the route checks the `Origin` header when present. This is sufficient for Phase 10 logout behavior, but it is not a complete general CSRF framework for future state-changing account features.

## D1 migrations

`migrations/0002_auth_and_sessions.sql` adds:

- `users`
- `sessions`
- `oauth_states`

The migration was applied locally, to `pfseeker-preview`, and to `pfseeker-production`. Repeat migration execution reported no pending migrations in all three environments.

## Testing

Phase 10 tests cover migration shape, safe return-path validation, Discord authorization URL construction, Discord user mapping, avatar URL generation, random tokens, HMAC hashing, and cookie attributes. Route smoke checks cover unauthenticated account redirects, Discord authorization redirect shape, denied and invalid callbacks, controlled test-session account rendering, POST logout, and GET logout rejection.

## Future work

Phase 10 is complete. Phase 11 has not started. Phase 11 may add synced collections for authenticated users. Moderator/admin roles, submissions, reports, upload signing, rate limiting, and full CSRF coverage remain later phases and must be implemented with server-side authorization.
