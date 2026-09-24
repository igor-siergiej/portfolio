# Content Website Template

Astro + Keystatic (Cloud storage) + Tailwind v4/shadcn scaffold for
SEO-optimised content/promo sites. Deploys to AWS (S3 + CloudFront) via
Terraform + GitHub Actions, no backend server at runtime.

## Create a new site

```bash
bunx degit igor-siergiej/content-website-template my-site
cd my-site
bun run init my-site         # replaces portfolio/Portfolio tokens, removes itself
bun install
git init && git add -A && git commit -m "chore: scaffold from content-website-template"
```

## Stack

| Concern | Choice |
|---------|--------|
| Runtime / package manager | Bun |
| Framework | Astro 7 (static output) |
| Content / CMS | Keystatic, `storage: { kind: 'cloud' }` — admin at `/keystatic`, commits straight to GitHub, no backend |
| UI | React 19 islands, Tailwind v4, shadcn (radix base, nova preset) |
| Lint / format | Biome |
| Hooks | Husky + lint-staged + commitlint (Conventional Commits) |
| Release | semantic-release |
| Dead code | Fallow |
| CI | GitHub Actions (`.github/workflows`) |
| Infra | Terraform (`infra/`) — S3 + CloudFront + GitHub OIDC, no servers |

## Commands

```bash
bun run dev            # dev server, :4321
bun run build          # static build -> dist/
bun run preview        # preview the static build
bun run lint           # biome check
bun run test           # vitest
bun run test:e2e       # playwright
```

## Post-scaffold setup

1. Create the Keystatic Cloud project (keystatic.cloud) and set
   `cloud.project` in `keystatic.config.ts` to `<team>/<project>`.
2. Fill in `src/config/site.ts` (name, url, description, social, OG image).
3. Set the `Sitemap:` line in `public/robots.txt` to your real domain.
4. Fill in `infra/variables.tf`'s `domain_name` (left blank by `init.ts`).
5. Create the GitHub repo, push, then follow `infra/README.md` to apply
   Terraform and wire up the `gha-deploy`/`gha-terraform` OIDC roles.

## Credits

UI skeleton adapted from
[leoMirandaa/shadcn-landing-page](https://github.com/leoMirandaa/shadcn-landing-page)
(MIT).
