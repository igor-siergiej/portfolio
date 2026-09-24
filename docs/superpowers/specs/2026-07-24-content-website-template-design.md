# Content Website Template — Design Spec

## Overview

Genericize this repo (currently `taiseikarate`, the unmodified Keystatic+Astro
starter plus Tailwind v4/shadcn added on top) into `content-website-template`: a
reusable scaffold for SEO-optimised content/promo sites, in the same family as
`imapps-template` (Bun monorepo scaffold for API+web apps) and generalized from
`karate-promo` (the live Taisei Karate site today — a Vite+React CSR SPA with
poor SEO, proven AWS static-hosting infra).

The template fixes karate-promo's core problem (client-rendered SPA → weak SEO,
no per-route meta/OG at HTML level) by using Astro's static prerendering, while
reusing karate-promo's proven Terraform + GitHub Actions AWS deploy pipeline
as-is (S3 + CloudFront + OIDC, no servers, no Docker).

## Goals

- A `bunx degit ... && bun run init <name>` scaffold, same UX as `imapps-template`.
- Every scaffolded site prerenders to static HTML (real SEO wins vs karate-promo).
- Deploys with the same proven infra karate-promo already runs in production.
- Keystatic admin needs no backend server — commits go straight to GitHub, same
  shape as karate-promo's TinaCMS Cloud today.
- SEO essentials + common content-site extras built in, not bolted on later.
- A pre-built marketing-site skeleton (nav/hero/features/etc.) so a new project
  starts from something that looks finished, not a blank page.

## Non-goals

- Not a monorepo (no `packages/*` workspaces) — nothing else needs its own
  package once there's no API server.
- No Docker, no `@imapps/*` API-utils/DI container — those assume a
  long-running backend this stack doesn't have.
- No contact-form Lambda/SES/API-Gateway — left out of the base template;
  add per-project if a site needs one (karate-promo's `infra/lambda.tf` +
  `packages/mailer/` is the reference if that's needed later).

## 1. Identity & scaffolding mechanism

- Rename the working directory and repo to `content-website-template`.
- Port `imapps-template/scripts/init.ts` verbatim: validates a kebab-case slug,
  walks the tree replacing `__APP_NAME__`/`__APP_TITLE__` (title = slug's words
  capitalized), skips `node_modules/.git/build/dist/.tooling/bun.lock`, deletes
  itself and its `package.json` `init` script entry after running.
- `package.json` `name` becomes `__APP_NAME__`.
- `README.md` rewritten to the same degit+init instructions as
  `imapps-template`'s README, plus a "Post-scaffold setup" section (see §5).

## 2. Architecture: static Keystatic

Today: `astro.config.mjs` has `output: 'server'` + `@astrojs/node` adapter,
`keystatic.config.ts` has `storage: { kind: 'local' }` — both only work with a
running Node server, which rules out the karate-promo-style static S3 deploy.

Change:
- `keystatic.config.ts`: `storage.kind` moves off `local` to whichever
  non-local mode lets the `/keystatic` admin run with **zero self-hosted
  backend** (GitHub-storage OAuth device flow, or Keystatic Cloud as the
  OAuth-proxy — same role Tina Cloud plays for karate-promo today). **Pin the
  exact kind during implementation planning** by checking current Keystatic
  docs; both give the same end architecture (admin commits straight to
  GitHub, no server), this is purely which one needs zero vs near-zero extra
  setup.
- `astro.config.mjs`: drop `@astrojs/node` import/adapter, `output: 'server'`
  → `'static'`. `site` field reads from `process.env.SITE_URL` (Astro config
  can't import runtime app code like `src/config/site.ts`).
- `package.json`: remove `@astrojs/node` dependency.
- `.env.example` documents whatever the chosen Keystatic storage kind needs
  (client id/secret or Cloud project slug), analogous to karate-promo's
  `TINA_CLIENT_ID`/`TINA_TOKEN`.

## 3. SEO feature set

("Core + content extras" tier.)

- `@astrojs/sitemap` integration → `sitemap.xml` generated from prerendered
  routes automatically.
- Static `robots.txt` referencing the sitemap.
- `src/components/Seo.astro`: title/description, canonical URL, OG tags
  (`og:title/description/image/type/url`), Twitter card tags. Per-page props
  override, falls back to `src/config/site.ts` defaults.
- JSON-LD: `Organization` schema site-wide (rendered in `Layout.astro`) +
  `Article` schema per post (title, `datePublished`, author, image, from
  Keystatic post frontmatter).
- RSS feed at `src/pages/rss.xml.ts` via `@astrojs/rss`, sourced from the
  `posts` collection.
- Reading-time / word-count util, computed at build from Markdoc content,
  shown on post pages.
- Related-posts: same-collection, excludes current post, recency-ordered (no
  ML/embedding — a shared-tag boost if/when posts gain a tags field).
- `astro:assets` `<Image />` used for all content images (already partly true
  via Keystatic's Markdoc image directory) — lazy-loaded by default,
  width/height enforced.

## 4. Site configuration

- `src/config/site.ts`: single source of truth — `name`, `title`, `url`,
  `description`, `locale`, `social` (e.g. `twitter`), `defaultOgImage`.
  Imported by `Seo.astro`, the JSON-LD component, `rss.xml.ts`.
- `init.ts`'s token replace only touches identity (`__APP_NAME__`/
  `__APP_TITLE__` in `package.json`, README, Terraform `project`/
  `github_repo` defaults) — it does **not** try to fill in `site.ts`'s
  content fields (description, social, OG image); those are edited by hand
  post-scaffold, same as karate-promo's `infra/README.md` "fill these in"
  steps.

## 5. Infrastructure & CI/CD

Ported from `karate-promo/infra/` and `.github/workflows/`, generalized:

- **Terraform** (`infra/`): `s3.tf`, `cloudfront.tf`, `oidc.tf`, `acm.tf`,
  `route53.tf`, `backend.tf`, `outputs.tf`, `variables.tf`, `versions.tf`
  copied as-is. **Not copied**: `lambda.tf` and any API-Gateway/mailer wiring
  (contact-form Lambda is out of scope, per Non-goals).
  - `variables.tf` defaults: `project` and `github_repo` tokenized by
    `init.ts` (same mechanism as `package.json`'s name); `mail_to`/`mail_from`
    are dropped entirely (no mailer); `domain_name` is left blank, filled in
    manually post-init, documented in `infra/README.md`'s "First apply"
    section (ported from karate-promo's, with mailer-specific steps
    removed).
  - Same OIDC role split: `gha-deploy` (S3 put/delete/list + CloudFront
    invalidation only) and `gha-terraform` (broader: S3/CloudFront/IAM —
    Lambda/API-Gateway/SES permissions dropped since there's no mailer).
- **CI** (`.github/workflows/`):
  - `ci-cd.yml`: lint → test → build → deploy (mirrors karate-promo's
    structure) → release (semantic-release). Tina-specific bake/env steps
    (`TINA_CLIENT_ID`/`TINA_TOKEN`, the `tinacms dev --noWatch` build
    shell-out) replaced by whatever the chosen Keystatic storage kind needs
    for a build-time content fetch, or dropped entirely if Keystatic's
    static build needs no equivalent bake step (Astro content collections
    read Markdoc files directly from the repo at build time — likely no
    bake needed at all, unlike Tina's remote-GraphQL model. Confirm during
    implementation).
  - `terraform.yml`: PR → `terraform plan` posted as a comment; push to
    `main` → `terraform apply`. Same OIDC trust model, same fork-PR guard.
    Mailer-build step (`bun run --filter @karate-promo/mailer build`)
    dropped since there's no mailer package.
  - No Docker build/push steps anywhere (the deploy artifact is a static
    `dist/` folder, `aws s3 sync`, not an image).

## 6. Content model

Single generic `posts` collection stays (already exists) as the example
entity — matches `imapps-template`'s "one example entity, strip it out"
philosophy. README notes that more Keystatic collections (services,
testimonials, static pages) are added per-project as needed.

## 7. UI skeleton (ported theme)

Port `leoMirandaa/shadcn-landing-page` (MIT, Vite+React+TS+Tailwind+shadcn,
no Next.js lock-in) component-by-component into `src/components/sections/`:
`Navbar, Hero, HeroCards, Sponsors, About, HowItWorks, Features, Services,
Cta, Testimonials, Team, Pricing, Newsletter, FAQ, Footer` + dark-mode
toggle.

Porting work:
- Tailwind v3 → v4: utility class names carry over as-is; only its
  `tailwind.config.js` custom theme extensions (colors, etc.) move into our
  `@theme` block in `src/styles.css`.
- Per-package `@radix-ui/react-*` imports reconciled with the unified
  `radix-ui` package already installed (add missing sub-packages or repoint
  imports — mechanical).
- React 18 → 19: verify no breakage at build (cva/radix-based components,
  no known incompatibilities).
- Each section is a React component embedded in `.astro` pages/layouts,
  rendered static (no `client:*`) by default since everything prerenders —
  only genuinely interactive bits (mobile-nav toggle, theme toggle, FAQ
  accordion) get `client:idle`/`client:visible`.
- Hardcoded demo content (testimonials, pricing tiers, team bios, sponsor
  logos) replaced with props sourced from `site.ts` / Keystatic collections,
  not left as static placeholder data.

## 8. Tooling & testing

Ported from karate-promo as-is, paths adjusted for the flat (non-monorepo)
layout:
- Biome (`biome.json`) — lint/format.
- Husky + lint-staged + commitlint (Conventional Commits).
- `semantic-release` (`.releaserc.json`) — drop the `@semantic-release/exec`
  prepare-cmd's `packages/web` version-bump loop (single `package.json` at
  root now, no per-package versioning needed).
- Fallow (`.fallowrc.json`) — dead-code audit, ignore patterns adjusted to
  drop `packages/web/tina/**` (no Tina) in favor of whatever Keystatic's
  generated/cache paths are.
- Vitest (unit tests) + Playwright (e2e), matching karate-promo's test
  commands but without `--filter` (`bun run test`, `bun run test:e2e`)
  since there's no workspace to filter.

## Open questions (pin during implementation planning, don't block spec approval)

1. Exact Keystatic storage kind (`github` device-flow vs Keystatic Cloud) —
   both satisfy "no self-hosted backend", pick based on current Keystatic
   docs and whichever needs less per-project setup.
2. Whether Astro+Keystatic's static build needs any CI "bake" step
   equivalent to Tina's `tinacms dev --noWatch` — likely not, since Markdoc
   content lives in the repo and Astro content collections read it directly
   at build time with no remote GraphQL round-trip. Confirm once the
   storage-kind question (#1) is settled, since it affects whether content
   is fetched from GitHub's API at build time or read from the local
   checkout.

## References

- `imapps-template` (`/home/igors/imapps/imapps-template`) — init-script
  scaffolding pattern.
- `karate-promo` (`/home/igors/imapps/karate-promo`) — infra/CI to
  generalize from (`infra/`, `.github/workflows/ci-cd.yml`,
  `.github/workflows/terraform.yml`, `biome.json`, `.releaserc.json`,
  `.fallowrc.json`).
- `leoMirandaa/shadcn-landing-page` (GitHub, MIT) — UI skeleton source.
