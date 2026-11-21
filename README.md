# portfolio

Personal portfolio and technical blog.

Astro (static) + Tailwind v4 + React islands, content as files, deployed to AWS
S3 + CloudFront via Terraform and GitHub Actions OIDC. No CMS, no server.

Not deployed yet — the AWS stack has not been applied, so there is no live URL.
`public/robots.txt` still advertises `Sitemap: http://localhost:4321/…` and stays
that way until the stack is applied and the real origin is known.

## Architecture

[docs/diagrams/architecture.excalidraw](docs/diagrams/architecture.excalidraw) (open in
excalidraw.com or the VS Code Excalidraw extension) — content, pages, CI jobs and the AWS
stack. Not part of the homelab: this site is not hosted on foundry/Dokploy, and no
`imapps.uk` domain is configured (`infra/variables.tf` `domain_name` defaults to `""`).

- `src/content/` — Markdoc content collections, schemas in `src/content.config.ts`.
- `src/pages/` — `index`, `about`, `blog/[slug]`, `projects/[slug]`, `rss.xml`, `og.svg`, `404`.
- `src/components/` — Astro components; `mobile-nav.tsx` and `theme-toggle.tsx` are the
  React islands. `src/config/site.ts` holds site metadata, `src/config/shiki.mjs` code
  highlighting (shared by `.md` and `.mdoc`).

## Local dev

Use Node.js **>=22.22.1** and Bun **>=1.4.4** (the lockfile and checks were verified
with Bun 1.4.4 / Node 24.22.1). Astro and lint-staged set the Node floor; loading
the `.mts` tooling configs also requires Node's built-in TypeScript stripping.

```bash
bun install
cp .env.example .env   # SITE_URL; defaults to http://localhost:4321 when unset
bun run dev
```

## Commands

```bash
bun run dev           # dev server, :4321
bun run build         # static build -> dist/
bun run preview       # preview the build
bun run lint          # read-only Oxlint + Oxfmt formatting check
bun run lint:fix      # fix lint, format, then lint again
bun run format        # write formatting only (including import sorting)
bun run format:check  # read-only formatting check
bun run typecheck     # Astro template/content/TypeScript checks
bun run test          # vitest
bun run test:e2e      # playwright
```

## Tooling

`oxlint.config.mts` and `oxfmt.config.mts` consume the published
`@imapps/oxc-config/oxlint` and `@imapps/oxc-config/oxfmt` presets, including the
shared anti-slop plugin. The installed release is **7.0.1**, with **Oxlint 1.94.0**,
**@oxlint/plugins 1.94.0** and **Oxfmt 0.79.0** exact-pinned in `package.json`.
Those versions satisfy the published package's peer ranges:
`oxlint` / `@oxlint/plugins >=1.90.0 <2`, `oxfmt >=0.75.0 <1`. When upgrading,
inspect `bun pm view @imapps/oxc-config@latest peerDependencies` rather than
copying version examples from its README; keep Oxlint and its JS-plugin runtime
aligned and regenerate `bun.lock`.

- `lint` never writes; CI's existing `bun run lint` now checks both lint and formatting.
  CI pins Node 22 (`actions/setup-node`) alongside Bun, since the Oxlint JS-plugin
  runtime and `.mts` config loading use the `node` on `PATH`.
- `lint:fix` uses `scripts/lint-fix.mjs`: two lint-fix passes, formatting, then a
  final read-only lint. Native fixes such as `prefer-const` can expose a JS-plugin
  spacing fix on the next pass. Unresolved errors still fail the command.
- Husky runs lint-staged: staged JS/TS and Astro files use that same fixer; supported
  non-code files use Oxfmt. Both tools respect `.gitignore`; the configs also
  exclude `.factory`, `dist`, `.astro`, coverage, Playwright output, generated
  Markdoc timestamp modules and `CHANGELOG.md` (semantic-release rewrites it in its
  own format, so formatting it would fail `lint` after the next release), while retaining shared agent-directory exclusions.
- Shared four-space/120-column/single-quote/semicolon formatting and import
  sorting match the previous project style; JSON and YAML use two spaces.
  `one-var: never` preserves single declarations. The source-specific allowances
  for unused variables, explicit `any`, non-null assertions, and the content
  config's TypeScript directive are retained where Oxlint has equivalents.

### File-type boundaries

Oxlint checks JS/TS and extracted JavaScript/TypeScript in Astro files, including
frontmatter. It does **not** provide full Astro-template linting or template-aware
import sorting. In this setup, Oxfmt 0.79.0 leaves `.astro` files unchanged:
its opt-in Astro formatter requires `astro: true` plus `@astrojs/compiler-rs`,
which this migration does not enable. Markdoc `.mdoc` is unsupported. Astro hooks
therefore lint extracted code only; keep template and Markdoc formatting manual.
Run `bun run typecheck`, `bun run test` and `bun run build` for Astro and content
validation. Markdown (`.md`), JSON, YAML and CSS are formatted by
Oxfmt, but Oxlint is not a CSS/JSON/Markdown linter. Former CSS unknown-at-rule /
important-style allowances and Astro unique-element-ID rules have no equivalent
in this setup; the old Astro unused-import/import-sorting exception is not
replaced with a claim of template coverage.

## Testing

- Unit: vitest, `src/lib/*.test.ts`.
- E2E: playwright, `e2e/` (`feed`, `navigation`, `theme`). The web server is
  `bun run build && bun run preview`, so it tests the static build — but `astro preview`
  resolves directory indexes itself, so CloudFront routing is only covered by the
  post-deploy smoke test in `ci-cd.yml`.
- PRs run `.github/workflows/pull-request.yml`.

## Content

- Posts: `src/content/posts/*.mdoc` — set `draft: true` to keep a post out of the
  index, the feed and the sitemap while it lives on `main`.
- Post frontmatter: `title`, optional `description`, `publishDate`, `coverImage`, `tags`, `draft`.
- Projects: `src/content/projects/*.mdoc` — `featured: <n>` promotes a project to
  the home page in ascending order; `status` (`active` | `maintained` | `archived`)
  drives grouping on `/projects`. Required: `title`, `summary`, `role`, `period`, `status`.

## Deploying

Push to `main`. CI lints, type-checks, tests, builds, releases and syncs to S3,
then invalidates CloudFront and smoke-tests routing. Jobs: `lint` + `test` → `build`
(artifact) → `release` (semantic-release, writes `CHANGELOG.md`) and `deploy` in parallel.
Deploy assumes the `gha-deploy` role via GitHub OIDC and needs repo variables `S3_BUCKET`,
`CLOUDFRONT_DISTRIBUTION_ID`, `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `SITE_URL` (build fails
without `SITE_URL`). `infra/**` changes go through `terraform.yml` (plan on PR, apply on main). See `infra/README.md` for the Terraform side.
