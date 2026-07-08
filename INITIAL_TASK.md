# Initial Codex task — audit and initiation

Inspect the entire project directory and every relevant subfolder. This is the initiation and discovery stage only.

Learn the complete current state of the project before making architectural changes. Identify all existing pages, components, styles, scripts, image manifests, assets, dependencies, configuration files, Git state, Cloudflare-related files, and Cloudinary-related files.

Determine:

- what already works
- what is incomplete
- what is broken
- what is duplicated
- what can be reused
- what should be replaced
- what is missing
- what security issues are present
- what accessibility issues are present
- what assumptions the current code makes
- what migration risks exist

The directory `reference/assessed-site/` contains reference material from a separately assessed website. Study it for product concepts and known implementation lessons, but do not treat it as pfseeker production code and do not copy it literally.

Do not delete or broadly rewrite working code during this stage.

Create or update:

- `PROJECT_AUDIT.md`
- `ARCHITECTURE.md`
- `IMPLEMENTATION_PLAN.md`
- `MIGRATION_NOTES.md`

The implementation plan must divide the production build into ordered, testable phases with explicit completion criteria and dependencies.

After creating the documents, run any safe existing validation commands available in the repository and report their results. Stop after the audit documents and findings are complete. Do not begin broad implementation until the audit has been reviewed.
