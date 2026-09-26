# portfolio

Personal portfolio and technical blog.

Astro (static) + Tailwind v4 + React islands, content as files, deployed to AWS
S3 + CloudFront via Terraform and GitHub Actions OIDC. No CMS, no server.

Not deployed yet — the AWS stack has not been applied, so there is no live URL.

## Commands

```bash
bun run dev       # dev server, :4321
bun run build     # static build -> dist/
bun run preview   # preview the build
bun run lint      # biome check
bun run test      # vitest
bun run test:e2e  # playwright
```

## Content

- Posts: `src/content/posts/*.mdoc` — set `draft: true` to keep a post out of the
  index, the feed and the sitemap while it lives on `main`.
- Projects: `src/content/projects/*.mdoc` — `featured: <n>` promotes a project to
  the home page in ascending order; `status` drives grouping on `/projects`.

## Deploying

Push to `main`. CI lints, type-checks, tests, builds, releases and syncs to S3,
then invalidates CloudFront. See `infra/README.md` for the Terraform side.
