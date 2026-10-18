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

```bash
bun install
cp .env.example .env   # SITE_URL; defaults to http://localhost:4321 when unset
bun run dev
```

## Commands

```bash
bun run dev       # dev server, :4321
bun run build     # static build -> dist/
bun run preview   # preview the build
bun run lint      # biome check
bun run test      # vitest
bun run test:e2e  # playwright
```

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
