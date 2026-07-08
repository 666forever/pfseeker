# Acceptance criteria

The project is considered production-ready only when all applicable criteria are met.

## Functional integrity

- Every visible control performs a complete action.
- No internal route returns an unintended 404.
- No production link uses `href="#"` as a placeholder.
- Search and filters are shareable through URLs.
- Gallery loading handles success, empty, slow, offline, and failed states.
- Downloads work for supported formats.
- Collection ZIP generation completes even when individual assets fail.
- Authenticated features verify authorization server-side.
- Submission and moderation flows persist real state.

## Accessibility

- Complete keyboard operation.
- Visible focus indicators.
- Semantic buttons and links.
- Accurate labels and ARIA state.
- Dialog focus trapping and restoration.
- Escape-key support.
- Essential actions available without hover.
- Dynamic feedback announced through live regions.
- Forms expose labels, instructions, and validation errors.
- Reduced-motion preferences respected.
- Layout remains usable at high zoom and on mobile touch devices.

## Performance

- Tailwind is compiled at build time.
- No jQuery.
- No duplicate scripts.
- No full catalog loaded on initial render.
- Images use explicit dimensions or stable aspect-ratio reservation.
- Cloudinary produces responsive formats and sizes.
- Noncritical media is lazy-loaded.
- Hydration is limited to interactive islands.
- Representative routes meet the documented Lighthouse targets or have recorded, justified exceptions.

## Security

- No secrets committed.
- Environment variables are validated.
- Privileged routes validate roles server-side.
- User input is validated and escaped.
- API-controlled messages are not inserted through unsanitized HTML.
- OAuth state and redirect destinations are validated.
- Cookies use secure production settings.
- Uploads are signed and validated.
- Rate limits cover abuse-prone endpoints.
- Security headers are configured and tested.

## SEO

- Every indexable page has a unique title and description.
- Canonicals use `https://pfseeker.com/`.
- Social metadata uses supported raster preview images.
- Sitemap and robots files are correct.
- Primary content is available without client-side rendering.
- Internal navigation is crawlable.
- Structured data validates where used.

## Code quality

- TypeScript strict mode passes.
- Linting passes.
- Formatting passes.
- Production build passes.
- Tests pass.
- No unused production code.
- No unexplained magic values.
- No silent catches that discard errors.
- No production debug logging.
- Documentation matches the implementation.

## Deployment

- Cloudflare preview deployment works.
- Production deployment works.
- D1 migrations are documented and repeatable.
- Environment bindings are documented.
- `pfseeker.com` resolves correctly.
- `www` redirects to the canonical host.
- Error pages, redirects, and security headers work in production.
