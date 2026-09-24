# Portfolio Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static Astro portfolio-and-blog for Igor Siergiej, deployed to AWS S3 + CloudFront alongside `taisei-karate`, with project case studies, a writing surface, and no CMS or server.

**Architecture:** Scaffold from `igor-siergiej/content-website-template`, strip Keystatic in the first commit, author content as files in two Astro content collections (`posts`, `projects`), render static pages with React islands only where interactivity is required, and deploy via GitHub Actions assuming an IAM role through the account's existing GitHub OIDC provider.

**Tech Stack:** Bun · Astro 7 (static output) · React 19 islands · Tailwind v4 · shadcn (trimmed) · Vitest · Playwright · Biome · semantic-release · Terraform (S3 + CloudFront + OAC + IAM OIDC)

**Spec:** `docs/superpowers/specs/2026-09-24-portfolio-website-design.md`

## Global Constraints

- Package manager and runtime: **Bun**. Never `npm`/`yarn`/`pnpm`.
- Astro `output: 'static'`. No SSR adapter, no server at runtime.
- Formatting is Biome: **4-space indent, single quotes, 120-char lines**. Run `bun run lint:fix`, never hand-format.
- Commits are **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). commitlint runs in a husky `commit-msg` hook and will reject anything else.
- AWS account `777799876926`, region `eu-west-2`. CloudFront metrics and ACM certs are `us-east-1` only.
- Terraform `project = "portfolio"`; state bucket `portfolio-tfstate-777799876926`, key `portfolio/terraform.tfstate`.
- Existing OIDC provider ARN (shared, owned by taisei-karate): `arn:aws:iam::777799876926:oidc-provider/token.actions.githubusercontent.com`
- `domain_name = ""` at launch. The site ships on its `*.cloudfront.net` URL.
- No Keystatic, no contact form, no WAF, no analytics, no comments.
- Fonts are self-hosted via `@fontsource-variable/*` at version `5.3.0`. No runtime Google Fonts request.
- `SITE_URL` must be set in CI or every canonical URL, OG tag, sitemap and RSS entry silently becomes `http://localhost:4321`.
- Working directory for all tasks: `/home/home/imapps/portfolio`.

---

### Task 1: Scaffold and strip Keystatic

**Files:**
- Create: entire tree via degit (into the existing repo, which currently holds only `docs/` and `.gitignore`)
- Delete: `keystatic.config.ts`, `src/pages/keystatic/`
- Modify: `astro.config.mjs`, `package.json`, `public/robots.txt`, `.github/workflows/ci-cd.yml`, `infra/cloudfront.tf`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a building Astro project at repo root; `bun run build` exits 0; `siteConfig` importable from `@/config/site`.

- [ ] **Step 1: Scaffold into a temp dir and move it in**

The repo already exists with a `docs/` tree and a spec commit — degit refuses to write into a non-empty directory, so scaffold beside it and move the files across.

```bash
cd /home/home/imapps
bunx degit igor-siergiej/content-website-template portfolio-scaffold
cp -r portfolio-scaffold/. portfolio/
rm -rf portfolio-scaffold
cd portfolio
```

- [ ] **Step 2: Run the template's init script**

```bash
bun run init portfolio
```

This replaces `__APP_NAME__`/`__APP_TITLE__` tokens across the tree and deletes itself. Verify no tokens survive:

```bash
grep -rn "__APP_NAME__\|__APP_TITLE__" --exclude-dir=node_modules . || echo "clean"
```

Expected: `clean`.

- [ ] **Step 3: Install dependencies**

```bash
bun install
```

- [ ] **Step 4: Verify the untouched scaffold builds**

```bash
bun run build
```

Expected: exit 0, `dist/` created. This is the baseline — if it fails here, the problem is the template, not your edits.

- [ ] **Step 5: Commit the raw scaffold**

```bash
git add -A
git commit -m "chore: scaffold from content-website-template"
```

- [ ] **Step 6: Delete the Keystatic files**

```bash
rm -f keystatic.config.ts
rm -rf src/pages/keystatic
bun remove @keystatic/astro @keystatic/core
```

- [ ] **Step 7: Remove the Keystatic integration from `astro.config.mjs`**

Replace the whole file with this. The custom `keystatic()` integration (its `mkdirSync`/`writeFileSync` virtual-module shim and the `node:fs` import that only existed for it) and the sitemap filter for `/keystatic` all go.

```javascript
import markdoc from '@astrojs/markdoc';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
    // `|| ` (not `??`): an unset `vars.SITE_URL` in CI is passed through as `''`, not
    // undefined — `??` wouldn't fall back for that, and astro build fails on `site: ''`.
    site: process.env.SITE_URL || 'http://localhost:4321',
    output: 'static',
    integrations: [react(), markdoc(), sitemap()],
    vite: {
        plugins: [tailwindcss()],
    },
});
```

- [ ] **Step 8: Remove the Keystatic line from `public/robots.txt`**

Delete the `Disallow: /keystatic` line. The file should end up as:

```
User-agent: *
Allow: /

Sitemap: http://localhost:4321/sitemap-index.xml
```

(The `Sitemap:` line gets its real value in Task 11, once the CloudFront URL exists.)

- [ ] **Step 9: Fix the CI deploy comment that references Keystatic**

In `.github/workflows/ci-cd.yml`, the "Upload everything else" step's comment (around line 151) names `/keystatic/index.html`. Replace that comment block with:

```yaml
          # Every page (including nested routes like /blog/first-post/index.html),
          # sitemap-*.xml, rss.xml, robots.txt and favicon.svg — anything NOT
          # content-hashed — must be revalidated on every request, or a CloudFront
          # invalidation can't reach a visitor's browser cache.
```

Also update the "Upload editable images" step's comment, which justifies the short cache by Keystatic's media manager. Replace with:

```yaml
          # Project screenshots and OG images are committed by hand at stable paths, not
          # content-hashed, so a replaced image must reach returning visitors well before
          # a year. --delete is scoped to this prefix only, so it cannot remove anything
          # the hashed-assets sync above just uploaded.
```

- [ ] **Step 10: Remove the Keystatic CloudFront Function**

In `infra/cloudfront.tf`:

1. Delete the entire `resource "aws_cloudfront_function" "keystatic_index"` block (lines 44-75, including the leading comment block starting `# /keystatic is a directory...`) — **but** that function also implements `var.domain_hidden` host gating. Since `domain_name` is empty at launch and the spec drops the hidden-domain workflow, also delete `variable "domain_hidden"` from `infra/variables.tf` and the `function_association` block that references the function (around line 104).
2. Change the `frame_options` block (lines 17-22) to:

```hcl
    frame_options {
      frame_option = "DENY"
      override     = true
    }
```

- [ ] **Step 11: Verify nothing references Keystatic**

```bash
grep -rn "keystatic\|Keystatic\|domain_hidden" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs . || echo "clean"
```

Expected: `clean`. (`docs/` is excluded: the spec legitimately documents the removal.)

- [ ] **Step 12: Verify the build still passes**

```bash
bun install && bun run build && cd infra && terraform fmt -check && terraform validate; cd ..
```

Expected: build exits 0; `terraform validate` reports success. If `terraform validate` complains about an uninitialised backend, run `terraform init -backend=false` first — the real backend is bootstrapped in Task 11.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: remove keystatic cms"
```

---

### Task 2: Design tokens, typography and layout shell

**Files:**
- Modify: `src/styles.css`, `src/layouts/Layout.astro`, `src/config/site.ts`
- Create: `src/components/SiteHeader.astro`, `src/components/SiteFooter.astro`
- Delete: `src/components/sections/` (all of it), `src/components/ui/accordion.tsx`, `src/components/ui/avatar.tsx`, `src/components/ui/input.tsx`, `src/components/ui/navigation-menu.tsx`

**Interfaces:**
- Consumes: `siteConfig` from Task 1.
- Produces: `Layout.astro` accepting `{ title, description?, image?, wide?: boolean }` and rendering header + footer around its slot; CSS custom properties `--font-display`, `--font-sans`, `--font-mono` and the light/dark token set; `SiteHeader`/`SiteFooter` components.

- [ ] **Step 1: Install the fonts**

```bash
bun add @fontsource-variable/fraunces @fontsource-variable/inter @fontsource-variable/jetbrains-mono
bun remove @fontsource-variable/geist
```

- [ ] **Step 2: Swap the font imports and theme fonts in `src/styles.css`**

Replace line 4 (`@import "@fontsource-variable/geist";`) with:

```css
@import "@fontsource-variable/fraunces";
@import "@fontsource-variable/inter";
@import "@fontsource-variable/jetbrains-mono";
```

Then in the `@theme inline` block, replace the two font lines (currently `--font-heading: var(--font-sans);` and `--font-sans: "Geist Variable", sans-serif;`) with:

```css
    --font-display: "Fraunces Variable", Georgia, serif;
    --font-sans: "Inter Variable", system-ui, sans-serif;
    --font-mono: "JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace;
    --font-heading: var(--font-display);
```

- [ ] **Step 3: Replace the colour tokens**

Find the `:root { ... }` and `.dark { ... }` blocks further down `src/styles.css` (they define `--background`, `--foreground`, `--primary` etc. in oklch) and replace **only those two blocks' values** with the warm-paper palette. Keep every variable name — shadcn components reference all of them.

```css
:root {
    --radius: 0.25rem;
    --background: oklch(0.977 0.006 85);
    --foreground: oklch(0.18 0.012 75);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.18 0.012 75);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.18 0.012 75);
    --primary: oklch(0.52 0.15 40);
    --primary-foreground: oklch(0.99 0.005 85);
    --secondary: oklch(0.95 0.008 85);
    --secondary-foreground: oklch(0.26 0.012 75);
    --muted: oklch(0.95 0.008 85);
    --muted-foreground: oklch(0.52 0.012 75);
    --accent: oklch(0.95 0.02 50);
    --accent-foreground: oklch(0.32 0.08 40);
    --destructive: oklch(0.55 0.19 27);
    --border: oklch(0.9 0.008 85);
    --input: oklch(0.9 0.008 85);
    --ring: oklch(0.52 0.15 40);
}

.dark {
    --background: oklch(0.16 0.008 75);
    --foreground: oklch(0.94 0.006 85);
    --card: oklch(0.2 0.009 75);
    --card-foreground: oklch(0.94 0.006 85);
    --popover: oklch(0.2 0.009 75);
    --popover-foreground: oklch(0.94 0.006 85);
    --primary: oklch(0.72 0.13 45);
    --primary-foreground: oklch(0.16 0.008 75);
    --secondary: oklch(0.26 0.009 75);
    --secondary-foreground: oklch(0.94 0.006 85);
    --muted: oklch(0.26 0.009 75);
    --muted-foreground: oklch(0.68 0.01 80);
    --accent: oklch(0.3 0.03 45);
    --accent-foreground: oklch(0.9 0.04 60);
    --destructive: oklch(0.62 0.18 27);
    --border: oklch(0.29 0.009 75);
    --input: oklch(0.29 0.009 75);
    --ring: oklch(0.72 0.13 45);
}
```

Dark is a warm near-black with a lightened accent, not an inversion — `--primary` moves from `0.52` to `0.72` lightness so it keeps AA contrast on a dark ground.

- [ ] **Step 4: Delete the template's promo components**

```bash
rm -rf src/components/sections
rm -f src/components/ui/accordion.tsx src/components/ui/avatar.tsx src/components/ui/input.tsx src/components/ui/navigation-menu.tsx
```

These are a landing-page kit (`Hero`, `HeroCards`, `Features`, `FAQ`, `ScrollToTop`, `Navbar`, `Footer`, `Icons`) for a promo site. The portfolio's header/footer are written fresh in the next steps. `button`, `card`, `badge`, `dropdown-menu` and `sheet` stay.

- [ ] **Step 5: Create `src/components/SiteHeader.astro`**

```astro
---
import { ThemeToggle } from '@/components/theme-toggle';

const links = [
    { href: '/projects', label: 'Projects' },
    { href: '/blog', label: 'Writing' },
    { href: '/about', label: 'About' },
];

const path = Astro.url.pathname;
---

<header class="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
    <div class="container flex h-18 items-center justify-between gap-6">
        <a href="/" class="font-display text-xl font-semibold tracking-tight">
            Igor <span class="text-primary italic">Siergiej</span>
        </a>
        <nav aria-label="Primary" class="hidden items-center gap-7 text-sm sm:flex">
            {
                links.map((link) => (
                    <a
                        href={link.href}
                        aria-current={path.startsWith(link.href) ? 'page' : undefined}
                        class="border-b border-transparent pb-0.5 text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:text-foreground"
                    >
                        {link.label}
                    </a>
                ))
            }
        </nav>
        <div class="flex items-center gap-2">
            <a
                href="/cv.pdf"
                class="hidden rounded-full border border-foreground px-4 py-2 text-sm transition-colors hover:border-primary hover:text-primary sm:inline-block"
            >
                Download CV
            </a>
            <ThemeToggle client:idle />
        </div>
    </div>
</header>
```

`client:idle`, not `client:load`: the toggle is not above-the-fold-critical, and the inline script in `Layout.astro` already applies the stored theme before paint.

- [ ] **Step 6: Create `src/components/SiteFooter.astro`**

```astro
---
const year = new Date().getFullYear();
---

<footer class="mt-24 border-t border-border">
    <div class="container flex flex-col gap-3 py-8 font-mono text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>© {year} Igor Siergiej — built with Astro, deployed on CloudFront</span>
        <nav aria-label="Footer" class="flex gap-5">
            <a href="/rss.xml" class="transition-colors hover:text-foreground">RSS</a>
            <a href="https://github.com/igor-siergiej" class="transition-colors hover:text-foreground">GitHub</a>
            <a href="mailto:igorsiergiej@gmail.com" class="transition-colors hover:text-foreground">Email</a>
        </nav>
    </div>
</footer>
```

- [ ] **Step 7: Wire header and footer into `src/layouts/Layout.astro`**

Add the imports below the existing ones (after line 5):

```astro
import SiteHeader from '@/components/SiteHeader.astro';
import SiteFooter from '@/components/SiteFooter.astro';
```

Extend `Props` and the destructure:

```astro
export interface Props {
    title: string;
    description?: string;
    image?: string;
    wide?: boolean;
}

const { title, description, image, wide = false } = Astro.props;
```

Replace the `<body>` contents (lines 52-62) with:

```astro
	<body class="bg-background font-sans text-foreground antialiased">
		<a
			href="#main-content"
			class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:outline focus:outline-2 focus:outline-ring"
		>
			Skip to content
		</a>
		<SiteHeader />
		<main id="main-content" class={wide ? 'container py-16' : 'container max-w-3xl py-16'}>
			<slot />
		</main>
		<SiteFooter />
	</body>
```

Replace the `orgSchema` block (lines 15-34) with a `Person` schema — this is a personal site, not a business:

```astro
const personSchema = {
    '@type': 'Person',
    name: siteConfig.name,
    url: siteConfig.url,
    jobTitle: 'Full-stack engineer',
    email: `mailto:${siteConfig.email}`,
    sameAs: [siteConfig.social.github, siteConfig.social.linkedin].filter(Boolean),
};
```

and change the `<JsonLd schema={orgSchema} />` usage to `<JsonLd schema={personSchema} />`.

- [ ] **Step 8: Rewrite `src/config/site.ts`**

Delete the `LocalBusinessConfig` interface, the `business` field and the `faqs` field — all promo-site scaffolding with no consumer left after Step 4.

```typescript
export const siteConfig = {
    name: 'Igor Siergiej',
    title: 'Igor Siergiej — Full-stack engineer',
    description:
        'Full-stack engineer building and operating TypeScript products end-to-end — React and Astro front ends, Hono and Bun APIs, Terraform and AWS underneath.',
    // Guarded with `typeof process !== 'undefined'` because this module is also imported by
    // client-hydrated islands, where `process` doesn't exist and a bare `process.env` access
    // throws `ReferenceError: process is not defined` on hydration.
    // `|| ` (not `??`): an unset `vars.SITE_URL` in CI is passed through as `''`, not
    // undefined — `??` wouldn't fall back for that.
    url: (typeof process !== 'undefined' ? process.env.SITE_URL : undefined) || 'http://localhost:4321',
    locale: 'en',
    email: 'igorsiergiej@gmail.com',
    social: {
        github: 'https://github.com/igor-siergiej',
        linkedin: 'https://www.linkedin.com/in/igor-siergiej',
    },
    defaultOgImage: '/og-default.png',
};

export type SiteConfig = typeof siteConfig;
```

- [ ] **Step 9: Fix every broken import**

Deleting `src/components/sections/` orphans imports in `src/pages/index.astro`. Replace that page with a placeholder for now — Task 6 builds it properly:

```astro
---
import Layout from '@/layouts/Layout.astro';
import { siteConfig } from '@/config/site';
---

<Layout title={siteConfig.title} description={siteConfig.description}>
    <h1 class="font-display text-5xl tracking-tight">Igor Siergiej</h1>
</Layout>
```

- [ ] **Step 10: Verify build and types**

```bash
bunx astro sync && bun run tsc --noEmit && bun run lint && bun run build
```

Expected: all four exit 0. A `Property 'business' does not exist` error means a template component survived Step 4 — delete it.

- [ ] **Step 11: Visually verify both themes**

```bash
bun run dev
```

Open `http://localhost:4321`, confirm: serif heading renders in Fraunces, body in Inter, warm paper background; the theme toggle flips to the dark palette and the choice survives a reload.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: editorial design tokens, typography and layout shell"
```

---

### Task 3: Content collections and content helpers (TDD)

**Files:**
- Modify: `src/content.config.ts`
- Create: `src/lib/content.ts`, `src/lib/content.test.ts`
- Delete: `src/lib/related-posts.ts`, `src/lib/related-posts.test.ts`

**Interfaces:**
- Consumes: nothing beyond Astro's `astro:content`.
- Produces:
  - collections `posts` (adds `tags: string[]`, `draft: boolean`) and `projects`
  - `publishedPosts(posts: CollectionEntry<'posts'>[]): CollectionEntry<'posts'>[]` — drafts removed, newest first
  - `featuredProjects(projects: CollectionEntry<'projects'>[]): CollectionEntry<'projects'>[]` — only entries with a numeric `featured`, ascending
  - `orderedProjects(projects: CollectionEntry<'projects'>[]): CollectionEntry<'projects'>[]` — `active`, then `maintained`, then `archived`; within a status, featured first then alphabetical
  - `estimateReadingMinutes` (unchanged, from `src/lib/reading-time.ts`)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/content.test.ts`. The fixtures are cast because `CollectionEntry` carries loader-generated fields these functions never touch — the cast keeps the test about behaviour, not about satisfying a generated type.

```typescript
import type { CollectionEntry } from 'astro:content';
import { describe, expect, it } from 'vitest';
import { featuredProjects, orderedProjects, publishedPosts } from './content';

const post = (id: string, publishDate: string, draft = false) =>
    ({ id, data: { title: id, publishDate: new Date(publishDate), draft, tags: [] } }) as unknown as CollectionEntry<'posts'>;

const project = (id: string, status: string, featured?: number) =>
    ({ id, data: { title: id, status, featured, stack: [] } }) as unknown as CollectionEntry<'projects'>;

describe('publishedPosts', () => {
    it('removes drafts', () => {
        const result = publishedPosts([post('a', '2026-01-01'), post('b', '2026-02-01', true)]);
        expect(result.map((p) => p.id)).toEqual(['a']);
    });

    it('orders newest first', () => {
        const result = publishedPosts([post('old', '2025-01-01'), post('new', '2026-01-01')]);
        expect(result.map((p) => p.id)).toEqual(['new', 'old']);
    });
});

describe('featuredProjects', () => {
    it('keeps only featured entries, in ascending featured order', () => {
        const result = featuredProjects([project('c', 'active', 2), project('a', 'active'), project('b', 'active', 1)]);
        expect(result.map((p) => p.id)).toEqual(['b', 'c']);
    });

    it('does not treat featured 0 as absent', () => {
        const result = featuredProjects([project('first', 'active', 0), project('second', 'active', 1)]);
        expect(result.map((p) => p.id)).toEqual(['first', 'second']);
    });
});

describe('orderedProjects', () => {
    it('groups active, then maintained, then archived', () => {
        const result = orderedProjects([
            project('old', 'archived'),
            project('kept', 'maintained'),
            project('live', 'active'),
        ]);
        expect(result.map((p) => p.id)).toEqual(['live', 'kept', 'old']);
    });

    it('puts featured entries before unfeatured ones within a status', () => {
        const result = orderedProjects([project('zeta', 'active'), project('alpha', 'active', 3)]);
        expect(result.map((p) => p.id)).toEqual(['alpha', 'zeta']);
    });
});
```

The `featured 0` test exists because `featured ? ... : ...` and `featured !== undefined` differ exactly there — the naive implementation silently drops the top-ranked project.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/lib/content.test.ts`
Expected: FAIL — `Failed to resolve import "./content"`.

- [ ] **Step 3: Implement `src/lib/content.ts`**

```typescript
import type { CollectionEntry } from 'astro:content';

const STATUS_ORDER: Record<string, number> = { active: 0, maintained: 1, archived: 2 };

export function publishedPosts(posts: CollectionEntry<'posts'>[]): CollectionEntry<'posts'>[] {
    return posts
        .filter((post) => !post.data.draft)
        .sort((a, b) => (b.data.publishDate?.getTime() ?? 0) - (a.data.publishDate?.getTime() ?? 0));
}

export function featuredProjects(projects: CollectionEntry<'projects'>[]): CollectionEntry<'projects'>[] {
    return projects
        .filter((project) => project.data.featured !== undefined)
        .sort((a, b) => (a.data.featured ?? 0) - (b.data.featured ?? 0));
}

export function orderedProjects(projects: CollectionEntry<'projects'>[]): CollectionEntry<'projects'>[] {
    return [...projects].sort((a, b) => {
        const byStatus = (STATUS_ORDER[a.data.status] ?? 9) - (STATUS_ORDER[b.data.status] ?? 9);
        if (byStatus !== 0) return byStatus;

        const aFeatured = a.data.featured !== undefined;
        const bFeatured = b.data.featured !== undefined;
        if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;
        if (aFeatured && bFeatured) return (a.data.featured ?? 0) - (b.data.featured ?? 0);

        return a.data.title.localeCompare(b.data.title);
    });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test src/lib/content.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Update `src/content.config.ts`**

```typescript
// @ts-ignore
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
    loader: glob({ pattern: '**/*.{md,mdoc}', base: './src/content/posts' }),
    schema: z.object({
        title: z.string(),
        description: z.string().optional(),
        publishDate: z.coerce.date().optional(),
        coverImage: z.string().optional(),
        tags: z.array(z.string()).default([]),
        draft: z.boolean().default(false),
    }),
});

const projects = defineCollection({
    loader: glob({ pattern: '**/*.{md,mdoc}', base: './src/content/projects' }),
    schema: z.object({
        title: z.string(),
        summary: z.string(),
        role: z.string(),
        period: z.string(),
        stack: z.array(z.string()).default([]),
        repo: z.string().url().optional(),
        live: z.string().url().optional(),
        status: z.enum(['active', 'maintained', 'archived']),
        featured: z.number().optional(),
        cover: z.string().optional(),
        screenshots: z.array(z.string()).default([]),
    }),
});

export const collections = { posts, projects };
```

- [ ] **Step 6: Delete the related-posts helper**

```bash
rm -f src/lib/related-posts.ts src/lib/related-posts.test.ts
```

"Related posts" in the template is just "the 3 most recent other posts" — a relevance claim the code doesn't support. The blog index already lists recent posts; Task 4 drops the section rather than shipping a lie.

- [ ] **Step 7: Create the content directory and verify the schema loads**

```bash
mkdir -p src/content/projects
bunx astro sync && bun run tsc --noEmit && bun run test
```

Expected: all exit 0. `astro sync` regenerates `.astro/types.d.ts` from the new schema; without it `tsc` sees `data` as `any` and the helpers' field access silently stops being checked.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: projects collection and content ordering helpers"
```

---

### Task 4: Rename /posts to /blog and fix the feed

**Files:**
- Create: `src/pages/blog/index.astro`, `src/pages/blog/[slug].astro`
- Delete: `src/pages/posts/`
- Modify: `src/pages/rss.xml.ts`
- Test: `src/lib/content.test.ts` (already covers draft filtering)

**Interfaces:**
- Consumes: `publishedPosts`, `estimateReadingMinutes`, `Layout`.
- Produces: routes `/blog`, `/blog/<slug>`, `/rss.xml`; every post link is `/blog/<id>/`.

- [ ] **Step 1: Create `src/pages/blog/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import Layout from '@/layouts/Layout.astro';
import { publishedPosts } from '@/lib/content';
import { estimateReadingMinutes } from '@/lib/reading-time';

const posts = publishedPosts(await getCollection('posts'));
const formatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
---

<Layout title="Writing — Igor Siergiej" description="Notes on building and operating full-stack TypeScript systems.">
    <h1 class="font-display text-4xl tracking-tight">Writing</h1>
    <p class="mt-3 text-muted-foreground">What broke, what I'd do differently, and why.</p>

    <ul class="mt-12">
        {
            posts.map((post) => (
                <li class="border-t border-border">
                    <a href={`/blog/${post.id}/`} class="group grid grid-cols-[7rem_1fr_4rem] items-baseline gap-5 py-5">
                        <span class="font-mono text-xs text-muted-foreground">
                            {post.data.publishDate ? formatter.format(post.data.publishDate) : '—'}
                        </span>
                        <span class="font-display text-xl transition-colors group-hover:text-primary">
                            {post.data.title}
                        </span>
                        <span class="text-right font-mono text-xs text-muted-foreground">
                            {estimateReadingMinutes(post.body ?? '')} min
                        </span>
                    </a>
                </li>
            ))
        }
    </ul>
</Layout>
```

- [ ] **Step 2: Create `src/pages/blog/[slug].astro`**

Note `getStaticPaths` filters drafts too — otherwise a draft is unlisted but still reachable (and indexable) at its URL.

```astro
---
import { getCollection, getEntry, render } from 'astro:content';
import JsonLd from '@/components/JsonLd.astro';
import { siteConfig } from '@/config/site';
import Layout from '@/layouts/Layout.astro';
import { publishedPosts } from '@/lib/content';
import { estimateReadingMinutes } from '@/lib/reading-time';

export const prerender = true;

export async function getStaticPaths() {
    const posts = publishedPosts(await getCollection('posts'));
    return posts.map((post) => ({ params: { slug: post.id } }));
}

const { slug } = Astro.params;
if (!slug) throw new Error('Slug not found');

const post = await getEntry('posts', slug);
if (!post) throw new Error(`No post found for slug: ${slug}`);

const { Content } = await render(post);
const readingMinutes = estimateReadingMinutes(post.body ?? '');
const formatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
---

<Layout title={post.data.title} description={post.data.description} image={post.data.coverImage}>
    <JsonLd
        schema={{
            '@type': 'Article',
            headline: post.data.title,
            description: post.data.description,
            image: post.data.coverImage ? new URL(post.data.coverImage, siteConfig.url).toString() : undefined,
            datePublished: post.data.publishDate?.toISOString(),
            author: { '@type': 'Person', name: siteConfig.name },
        }}
    />
    <article>
        <p class="font-mono text-xs text-muted-foreground">
            {post.data.publishDate ? formatter.format(post.data.publishDate) : 'Unpublished'} · {readingMinutes} min read
        </p>
        <h1 class="mt-4 font-display text-4xl leading-tight tracking-tight">{post.data.title}</h1>
        <div class="prose-content mt-10">
            <Content />
        </div>
    </article>
    <a href="/blog" class="mt-16 inline-block font-mono text-xs text-muted-foreground hover:text-primary">
        ← All writing
    </a>
</Layout>
```

- [ ] **Step 3: Delete the old route**

```bash
rm -rf src/pages/posts
```

- [ ] **Step 4: Retarget the feed in `src/pages/rss.xml.ts`**

```typescript
import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { siteConfig } from '@/config/site';
import { publishedPosts } from '@/lib/content';

export async function GET(context: APIContext) {
    const posts = publishedPosts(await getCollection('posts'));

    return rss({
        title: siteConfig.title,
        description: siteConfig.description,
        site: context.site ?? siteConfig.url,
        items: posts.map((post) => ({
            title: post.data.title,
            description: post.data.description,
            pubDate: post.data.publishDate,
            link: `/blog/${post.id}/`,
        })),
    });
}
```

- [ ] **Step 5: Add a prose style block for rendered markdown**

Append to `src/styles.css` (the site has no typography plugin; case studies and posts are the only long-form surfaces and need exactly this much):

```css
.prose-content {
    line-height: 1.75;
}
.prose-content > * + * {
    margin-top: 1.25rem;
}
.prose-content h2 {
    font-family: var(--font-display);
    font-size: 1.75rem;
    letter-spacing: -0.02em;
    margin-top: 3rem;
}
.prose-content h3 {
    font-family: var(--font-display);
    font-size: 1.3rem;
    margin-top: 2rem;
}
.prose-content a {
    color: var(--primary);
    text-decoration: underline;
    text-underline-offset: 3px;
}
.prose-content code {
    font-family: var(--font-mono);
    font-size: 0.875em;
    background: var(--muted);
    border-radius: 0.25rem;
    padding: 0.1rem 0.35rem;
}
.prose-content pre {
    font-family: var(--font-mono);
    background: var(--muted);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
    overflow-x: auto;
    font-size: 0.875rem;
}
.prose-content pre code {
    background: none;
    padding: 0;
}
.prose-content ul {
    list-style: disc;
    padding-left: 1.5rem;
}
.prose-content ol {
    list-style: decimal;
    padding-left: 1.5rem;
}
.prose-content blockquote {
    border-left: 2px solid var(--primary);
    padding-left: 1rem;
    color: var(--muted-foreground);
}
```

- [ ] **Step 6: Rename the sample post and mark one draft**

The template ships `src/content/posts/first-post.mdoc`. Replace it with a real draft placeholder so the draft path is exercised end-to-end:

```bash
rm -f src/content/posts/first-post.mdoc
```

Create `src/content/posts/static-sites-without-click-ops.mdoc`:

```markdown
---
title: Static sites on AWS without click-ops
description: S3, CloudFront OAC and GitHub OIDC, wired end-to-end in Terraform.
publishDate: 2026-09-20
tags: [aws, terraform, astro]
draft: true
---

## Why bother

Draft placeholder — replaced with the real post in Task 8.
```

- [ ] **Step 7: Verify the routes and the draft gate**

```bash
bunx astro sync && bun run tsc --noEmit && bun run build
```

Then confirm the draft did **not** ship:

```bash
test ! -d dist/blog/static-sites-without-click-ops && echo "draft correctly excluded"
grep -c "<item>" dist/rss.xml
```

Expected: `draft correctly excluded`, and `0` items in the feed (the only post is a draft).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: blog routes and draft-aware feed"
```

---

### Task 5: Projects index and case-study pages

**Files:**
- Create: `src/pages/projects/index.astro`, `src/pages/projects/[slug].astro`, `src/components/StackChips.astro`

**Interfaces:**
- Consumes: `orderedProjects`, `featuredProjects`, `Layout`, `projects` collection.
- Produces: routes `/projects`, `/projects/<slug>`; `StackChips` accepting `{ items: string[] }`.

- [ ] **Step 1: Create `src/components/StackChips.astro`**

```astro
---
interface Props {
    items: string[];
}

const { items } = Astro.props;
---

<ul class="flex flex-wrap gap-1.5">
    {
        items.map((item) => (
            <li class="rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                {item}
            </li>
        ))
    }
</ul>
```

- [ ] **Step 2: Create `src/pages/projects/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import StackChips from '@/components/StackChips.astro';
import Layout from '@/layouts/Layout.astro';
import { orderedProjects } from '@/lib/content';

const projects = orderedProjects(await getCollection('projects'));
const statusLabel: Record<string, string> = {
    active: 'Active',
    maintained: 'Maintained',
    archived: 'Archived',
};
---

<Layout
    title="Projects — Igor Siergiej"
    description="Case studies of production systems I designed, built and still operate."
    wide
>
    <h1 class="font-display text-4xl tracking-tight">Projects</h1>
    <p class="mt-3 max-w-2xl text-muted-foreground">
        Systems with real users, not tutorial clones. Each one covers the problem, the architecture and the
        trade-offs I'd defend in review.
    </p>

    <ul class="mt-12">
        {
            projects.map((project, index) => (
                <li class="border-t border-border">
                    <a
                        href={`/projects/${project.id}/`}
                        class="group grid gap-5 py-7 md:grid-cols-[9rem_1fr_16rem]"
                    >
                        <div class="font-mono text-xs text-muted-foreground">
                            <div>{String(index + 1).padStart(2, '0')}</div>
                            <div class="mt-1">{project.data.period}</div>
                            <div class="mt-1 text-primary">{statusLabel[project.data.status]}</div>
                        </div>
                        <div>
                            <h2 class="font-display text-2xl tracking-tight transition-colors group-hover:text-primary">
                                {project.data.title}
                            </h2>
                            <p class="mt-2 max-w-prose text-muted-foreground">{project.data.summary}</p>
                            <span class="mt-3 inline-block font-mono text-xs text-primary">Case study →</span>
                        </div>
                        <div class="md:justify-self-end">
                            <StackChips items={project.data.stack} />
                        </div>
                    </a>
                </li>
            ))
        }
    </ul>
</Layout>
```

- [ ] **Step 3: Create `src/pages/projects/[slug].astro`**

```astro
---
import { getCollection, getEntry, render } from 'astro:content';
import JsonLd from '@/components/JsonLd.astro';
import StackChips from '@/components/StackChips.astro';
import { siteConfig } from '@/config/site';
import Layout from '@/layouts/Layout.astro';

export const prerender = true;

export async function getStaticPaths() {
    const projects = await getCollection('projects');
    return projects.map((project) => ({ params: { slug: project.id } }));
}

const { slug } = Astro.params;
if (!slug) throw new Error('Slug not found');

const project = await getEntry('projects', slug);
if (!project) throw new Error(`No project found for slug: ${slug}`);

const { Content } = await render(project);
---

<Layout title={`${project.data.title} — Igor Siergiej`} description={project.data.summary} image={project.data.cover}>
    <JsonLd
        schema={{
            '@type': 'SoftwareApplication',
            name: project.data.title,
            description: project.data.summary,
            applicationCategory: 'WebApplication',
            author: { '@type': 'Person', name: siteConfig.name },
            url: project.data.live ?? siteConfig.url,
        }}
    />
    <article>
        <p class="font-mono text-xs text-muted-foreground">{project.data.period} · {project.data.role}</p>
        <h1 class="mt-4 font-display text-4xl leading-tight tracking-tight">{project.data.title}</h1>
        <p class="mt-4 text-lg text-muted-foreground">{project.data.summary}</p>

        <div class="mt-6"><StackChips items={project.data.stack} /></div>

        <div class="mt-6 flex gap-4 font-mono text-xs">
            {project.data.repo && <a class="text-primary hover:underline" href={project.data.repo}>Source ↗</a>}
            {project.data.live && <a class="text-primary hover:underline" href={project.data.live}>Live ↗</a>}
        </div>

        {
            project.data.screenshots.length > 0 && (
                <div class="mt-10 grid gap-4">
                    {project.data.screenshots.map((shot) => (
                        <img
                            src={shot}
                            alt={`${project.data.title} screenshot`}
                            loading="lazy"
                            decoding="async"
                            class="rounded-lg border border-border"
                        />
                    ))}
                </div>
            )
        }

        <div class="prose-content mt-12">
            <Content />
        </div>
    </article>

    <a href="/projects" class="mt-16 inline-block font-mono text-xs text-muted-foreground hover:text-primary">
        ← All projects
    </a>
</Layout>
```

- [ ] **Step 4: Add a temporary fixture project so the routes render**

Create `src/content/projects/shoppingo.mdoc` with real frontmatter (the body is written properly in Task 8):

```markdown
---
title: shoppingo
summary: Recipe-first shared shopping list — plan meals, auto-generate the list, collaborate in real time.
role: Solo — design, build, operate
period: 2025 — present
stack: [React 19, Hono, MongoDB, Bun, Playwright, Dokploy]
repo: https://github.com/igor-siergiej/shoppingo
status: active
featured: 0
---

## Problem

Placeholder — written in Task 8.
```

- [ ] **Step 5: Verify both routes build and render**

```bash
bunx astro sync && bun run tsc --noEmit && bun run build
test -f dist/projects/index.html && test -f dist/projects/shoppingo/index.html && echo "routes built"
```

Expected: `routes built`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: projects index and case study pages"
```

---

### Task 6: Home page

**Files:**
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `featuredProjects`, `publishedPosts`, `StackChips`, `Layout`, `siteConfig`.
- Produces: the `/` route. No new exports.

- [ ] **Step 1: Replace `src/pages/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import StackChips from '@/components/StackChips.astro';
import { siteConfig } from '@/config/site';
import Layout from '@/layouts/Layout.astro';
import { featuredProjects, publishedPosts } from '@/lib/content';

const projects = featuredProjects(await getCollection('projects')).slice(0, 4);
const posts = publishedPosts(await getCollection('posts')).slice(0, 3);
const formatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const stack = [
    { label: 'Frontend', items: 'React 19, Astro, Tailwind v4, Vite' },
    { label: 'Backend', items: 'Hono, Koa, Bun, MongoDB, Postgres' },
    { label: 'Infra', items: 'Terraform, AWS, Docker, Dokploy' },
    { label: 'Quality', items: 'Vitest, Playwright, Biome, semantic-release' },
];
---

<Layout title={siteConfig.title} description={siteConfig.description} wide>
    <section class="max-w-3xl">
        <p class="font-mono text-xs tracking-widest text-primary uppercase">Full-stack engineer</p>
        <h1 class="mt-6 font-display text-6xl leading-[1.02] tracking-tight">
            I design, build and <span class="text-primary italic">run</span> the whole thing.
        </h1>
        <p class="mt-7 text-lg text-muted-foreground">
            From React interfaces down to the Terraform that provisions them. Production TypeScript services, a
            self-hosted cluster, zero click-ops — and a habit of writing down what I learn.
        </p>
        <div class="mt-9 flex flex-wrap gap-3">
            <a
                href="/projects"
                class="rounded-full bg-foreground px-6 py-3 text-sm text-background transition-colors hover:bg-primary"
            >
                See selected work
            </a>
            <a
                href="/blog"
                class="rounded-full border border-border px-6 py-3 text-sm transition-colors hover:border-primary hover:text-primary"
            >
                Read the writing
            </a>
        </div>
    </section>

    <section class="mt-24">
        <div class="flex items-baseline justify-between border-b border-border pb-4">
            <h2 class="font-display text-2xl tracking-tight">Selected work</h2>
            <a href="/projects" class="font-mono text-xs text-muted-foreground hover:text-primary">All projects →</a>
        </div>
        <ul>
            {
                projects.map((project) => (
                    <li class="border-b border-border">
                        <a href={`/projects/${project.id}/`} class="group grid gap-4 py-6 md:grid-cols-[1fr_16rem]">
                            <div>
                                <h3 class="font-display text-xl transition-colors group-hover:text-primary">
                                    {project.data.title}
                                </h3>
                                <p class="mt-2 max-w-prose text-muted-foreground">{project.data.summary}</p>
                            </div>
                            <div class="md:justify-self-end"><StackChips items={project.data.stack} /></div>
                        </a>
                    </li>
                ))
            }
        </ul>
    </section>

    <section class="mt-20">
        <div class="flex items-baseline justify-between border-b border-border pb-4">
            <h2 class="font-display text-2xl tracking-tight">Writing</h2>
            <a href="/blog" class="font-mono text-xs text-muted-foreground hover:text-primary">Archive · RSS →</a>
        </div>
        <ul>
            {
                posts.map((post) => (
                    <li class="border-b border-border">
                        <a href={`/blog/${post.id}/`} class="group grid grid-cols-[7rem_1fr] gap-5 py-4">
                            <span class="font-mono text-xs text-muted-foreground">
                                {post.data.publishDate ? formatter.format(post.data.publishDate) : '—'}
                            </span>
                            <span class="transition-colors group-hover:text-primary">{post.data.title}</span>
                        </a>
                    </li>
                ))
            }
        </ul>
    </section>

    <section class="mt-20">
        <h2 class="border-b border-border pb-4 font-display text-2xl tracking-tight">Stack</h2>
        <dl class="mt-6 grid gap-5 sm:grid-cols-2">
            {
                stack.map((group) => (
                    <div class="border-b border-dotted border-border pb-4">
                        <dt class="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                            {group.label}
                        </dt>
                        <dd class="mt-1.5">{group.items}</dd>
                    </div>
                ))
            }
        </dl>
    </section>

    <section class="mt-24 text-center">
        <h2 class="font-display text-4xl tracking-tight">Let's build something that stays up.</h2>
        <p class="mt-4 text-muted-foreground">Open to senior full-stack and platform roles. Email is fastest.</p>
        <div class="mt-8 flex flex-wrap justify-center gap-3">
            <a
                href={`mailto:${siteConfig.email}`}
                class="rounded-full bg-foreground px-6 py-3 text-sm text-background transition-colors hover:bg-primary"
            >
                {siteConfig.email}
            </a>
            <a
                href={siteConfig.social.github}
                class="rounded-full border border-border px-6 py-3 text-sm transition-colors hover:border-primary"
            >
                GitHub
            </a>
            <a
                href={siteConfig.social.linkedin}
                class="rounded-full border border-border px-6 py-3 text-sm transition-colors hover:border-primary"
            >
                LinkedIn
            </a>
        </div>
    </section>
</Layout>
```

- [ ] **Step 2: Verify**

```bash
bun run tsc --noEmit && bun run lint && bun run build
bun run dev
```

Open `http://localhost:4321` and confirm: the hero renders in Fraunces, the featured project appears, the writing section is empty (its only post is a draft — expected until Task 8), and the layout holds at 375px, 768px and 1440px widths.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: home page"
```

---

### Task 7: About page and CV

**Files:**
- Create: `src/pages/about.astro`, `public/cv.pdf`
- Modify: `public/robots.txt` (only if the CV should be crawlable — leave as-is; it should)

**Interfaces:**
- Consumes: `Layout`, `siteConfig`.
- Produces: route `/about`; `/cv.pdf` as a static asset.

- [ ] **Step 1: Fetch the CV from the archived repo**

```bash
mkdir -p tmp-cv
gh api repos/igor-siergiej/personal-portfolio/contents/src/IgorSiergiejCV.pdf --jq '.content' \
  | base64 -d > public/cv.pdf
rmdir tmp-cv
file public/cv.pdf
```

Expected: `public/cv.pdf: PDF document`. This is the 2023 CV — flag to Igor that it needs refreshing before launch; do not block on it.

- [ ] **Step 2: Create `src/pages/about.astro`**

```astro
---
import { siteConfig } from '@/config/site';
import Layout from '@/layouts/Layout.astro';

const timeline = [
    {
        period: '2025 — present',
        title: 'Platform of personal products',
        body: 'Designed, built and operate eight services — shoppingo, jewellery-catalogue, kivo, a shared utils monorepo — on a self-hosted cluster and AWS, all deployed from pipelines.',
    },
    {
        period: '2025',
        title: 'Client work — Taisei Karate Academy',
        body: 'Astro site on S3 + CloudFront with Origin Access Control, a Lambda/SES contact pipeline, CloudTrail and alarm-based monitoring, deployed through GitHub OIDC.',
    },
    {
        period: '2023',
        title: 'Graduate projects',
        body: 'A JavaFX diet planner over a nutrition dataset, an Android language-learning app in Kotlin, and a browser-based SQL teaching tool that renders schemas as interactive trees.',
    },
];
---

<Layout title="About — Igor Siergiej" description="Full-stack engineer — background, how I work, and what I'm looking for.">
    <h1 class="font-display text-4xl tracking-tight">About</h1>

    <div class="prose-content mt-8">
        <p>
            I'm a full-stack engineer happiest owning a feature from the first sketch to the production alarm. Most
            of my work is TypeScript — React and Astro on the front, Hono and Bun on the back — but the part I enjoy
            most is the seam between an application and the platform it runs on.
        </p>
        <p>
            Everything I build is infrastructure-as-code: Terraform for AWS, Docker Compose for the homelab, GitHub
            Actions with OIDC so there isn't a long-lived cloud key anywhere. If it can't be rebuilt from the repo,
            it isn't finished.
        </p>
        <p>I'm currently open to senior full-stack and platform roles, UK-based or remote.</p>
    </div>

    <h2 class="mt-16 border-b border-border pb-4 font-display text-2xl tracking-tight">Timeline</h2>
    <ul class="mt-6">
        {
            timeline.map((entry) => (
                <li class="grid gap-3 border-b border-border py-6 md:grid-cols-[10rem_1fr]">
                    <span class="font-mono text-xs text-muted-foreground">{entry.period}</span>
                    <div>
                        <h3 class="font-display text-lg">{entry.title}</h3>
                        <p class="mt-1.5 text-muted-foreground">{entry.body}</p>
                    </div>
                </li>
            ))
        }
    </ul>

    <div class="mt-16 flex flex-wrap gap-3">
        <a
            href="/cv.pdf"
            class="rounded-full bg-foreground px-6 py-3 text-sm text-background transition-colors hover:bg-primary"
        >
            Download CV
        </a>
        <a
            href={`mailto:${siteConfig.email}`}
            class="rounded-full border border-border px-6 py-3 text-sm transition-colors hover:border-primary"
        >
            Email me
        </a>
    </div>
</Layout>
```

- [ ] **Step 3: Verify**

```bash
bun run build
test -f dist/about/index.html && test -f dist/cv.pdf && echo "about + cv shipped"
```

Expected: `about + cv shipped`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: about page and CV download"
```

---

### Task 8: Seed real content

**Files:**
- Create: `src/content/projects/*.mdoc` (9 files), `src/content/posts/static-sites-without-click-ops.mdoc` (replace the draft)
- Modify: `src/content/projects/shoppingo.mdoc` (replace the Task 5 placeholder body)

**Interfaces:**
- Consumes: the `projects`/`posts` schemas from Task 3.
- Produces: content only. No code exports.

- [ ] **Step 1: Gather accurate facts for each project**

For every repo below, read its README and `package.json` before writing — the case studies must describe what the code actually does, not what sounds good.

```bash
for r in shoppingo jewellery-catalogue kivo utils foundry taisei-karate database-visualiser diet-planner PolyLingo; do
  echo "=== $r ==="
  gh repo view "igor-siergiej/$r" --json description,primaryLanguage,pushedAt,isArchived
done
```

- [ ] **Step 2: Write the six current project case studies**

One file per project in `src/content/projects/`, each following the fixed spine. Use this exact structure — `shoppingo.mdoc` shown in full as the model; write the other five the same way with their own facts.

```markdown
---
title: shoppingo
summary: Recipe-first shared shopping list — plan meals, auto-generate the list, collaborate in real time.
role: Solo — design, build, operate
period: 2025 — present
stack: [React 19, Hono, MongoDB, Bun, Playwright, Dokploy]
repo: https://github.com/igor-siergiej/shoppingo
status: active
featured: 0
---

## Problem

[What was actually painful, for whom, and why existing tools didn't solve it.]

## Approach

[The shape of the solution in three or four sentences.]

## Architecture

[Components and how they talk. Name the real services, stores and boundaries.]

## Decisions and trade-offs

[Two or three decisions with the alternative you rejected and why. This is the
section a reviewing engineer reads — it is not optional.]

## Outcome

[What runs today, who uses it, what you'd change next.]
```

Assign `featured` values: `shoppingo: 0`, `jewellery-catalogue: 1`, `foundry: 2`, `kivo: 3`. `utils` and `taisei-karate` get no `featured` key (they appear on `/projects`, not the home page).

Statuses: `shoppingo`, `jewellery-catalogue`, `foundry`, `kivo` → `active`; `utils`, `taisei-karate` → `maintained`.

- [ ] **Step 3: Write the three archived project entries**

`database-visualiser`, `diet-planner`, `PolyLingo` — same spine, shorter bodies, `status: archived`, no `featured` key. Their `period` values are `2023`.

- [ ] **Step 4: Write the first real post**

Replace `src/content/posts/static-sites-without-click-ops.mdoc` — same frontmatter but `draft: false` and a real body covering: why OAC beats a public bucket, how the GitHub OIDC trust policy is scoped to one repo and branch, and the `sub_claim_prefix` trap that breaks deploys after a repo rename. That last one is a genuine, hard-won detail — it is the reason this post is worth publishing.

- [ ] **Step 5: Verify every entry satisfies the schema**

```bash
bunx astro sync && bun run tsc --noEmit && bun run build
ls dist/projects | wc -l   # expect 10 (9 projects + index.html)
grep -c "<item>" dist/rss.xml   # expect 1
```

A schema violation fails the build here rather than shipping a broken page.

- [ ] **Step 6: Visually check a case study and the projects index**

```bash
bun run dev
```

Open `/projects` and one case study. Confirm ordering is active → maintained → archived, and that the home page shows exactly four featured projects in the intended order.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: seed project case studies and first post"
```

---

### Task 9: End-to-end smoke tests

**Files:**
- Modify: `e2e/homepage.spec.ts` → replace with real journeys
- Create: `e2e/navigation.spec.ts`, `e2e/feed.spec.ts`, `e2e/theme.spec.ts`
- Check: `playwright.config.ts` (confirm `webServer` and `baseURL`)

**Interfaces:**
- Consumes: the built site.
- Produces: Playwright specs only.

- [ ] **Step 1: Read the Playwright config**

```bash
cat playwright.config.ts
```

Confirm it starts the preview server and sets `baseURL`. If `webServer` is missing, add:

```typescript
    webServer: {
        command: 'bun run build && bun run preview',
        url: 'http://localhost:4321',
        reuseExistingServer: !process.env.CI,
    },
```

- [ ] **Step 2: Write the navigation journey**

Create `e2e/navigation.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';

test('home to case study and back', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'See selected work' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();

    await page.getByRole('heading', { level: 2, name: 'shoppingo' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'shoppingo' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Decisions and trade-offs' })).toBeVisible();

    await page.getByRole('link', { name: '← All projects' }).click();
    await expect(page).toHaveURL(/\/projects$/);
});

test('blog index reaches a post', async ({ page }) => {
    await page.goto('/blog');
    await page.getByRole('link').filter({ hasText: 'Static sites on AWS' }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Static sites on AWS');
});
```

- [ ] **Step 3: Write the feed test**

Create `e2e/feed.spec.ts`. This catches the failure mode that matters: an unset `SITE_URL` shipping `localhost` links to every subscriber.

```typescript
import { expect, test } from '@playwright/test';

test('rss feed is valid and uses absolute links', async ({ request, baseURL }) => {
    const response = await request.get('/rss.xml');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('<?xml');
    expect(body).toContain('<item>');

    const links = [...body.matchAll(/<link>([^<]+)<\/link>/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
        expect(link).toMatch(/^https?:\/\//);
        expect(link.startsWith(baseURL ?? '')).toBe(true);
    }
});

test('drafts are not published', async ({ request }) => {
    const body = await (await request.get('/rss.xml')).text();
    expect(body).not.toContain('Draft placeholder');
});
```

- [ ] **Step 4: Write the theme persistence test**

Create `e2e/theme.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';

test('theme toggle persists across reload', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const startedDark = await html.evaluate((el) => el.classList.contains('dark'));

    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(html).toHaveClass(startedDark ? /^(?!.*dark).*$/ : /dark/);

    await page.reload();
    await expect(html).toHaveClass(startedDark ? /^(?!.*dark).*$/ : /dark/);
});
```

- [ ] **Step 5: Delete the template's placeholder spec**

```bash
rm -f e2e/homepage.spec.ts
```

It asserts the template's promo copy, which no longer exists.

- [ ] **Step 6: Run the suite**

```bash
bunx playwright install --with-deps chromium
bun run test:e2e
```

Expected: all specs pass. If the theme test flakes, the inline theme script in `Layout.astro` is racing hydration — fix the script, not the test.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: end-to-end smoke coverage for navigation, feed and theme"
```

---

### Task 10: Terraform — shared OIDC provider, monitoring split, trimmed stack

**Files:**
- Modify: `infra/oidc.tf`, `infra/variables.tf`, `infra/backend.tf`, `infra/outputs.tf`
- Create: `infra/monitoring.tf`
- Verify absent: `infra/contact.tf`, `infra/waf.tf`, `infra/lambda.tf` (the template never had them)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `terraform output` keys `bucket_name`, `distribution_id`, `deploy_role_arn`, `aws_region`, `cloudfront_url`.

- [ ] **Step 1: Make the OIDC provider conditional**

In `infra/oidc.tf`, replace lines 1-10 with:

```hcl
# GitHub Actions OIDC federation → short-lived deploy role (no stored AWS keys).
#
# AWS allows exactly one OIDC provider per URL per account, and taisei-karate already owns
# token.actions.githubusercontent.com in account 777799876926. Creating a second one fails
# with EntityAlreadyExists, so this config reuses the existing provider when
# var.existing_oidc_provider_arn is set and only creates one when it isn't.
data "tls_certificate" "github" {
  count = var.existing_oidc_provider_arn == "" ? 1 : 0
  url   = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  count           = var.existing_oidc_provider_arn == "" ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github[0].certificates[0].sha1_fingerprint]
}

locals {
  oidc_provider_arn = var.existing_oidc_provider_arn != "" ? var.existing_oidc_provider_arn : aws_iam_openid_connect_provider.github[0].arn
}
```

- [ ] **Step 2: Repoint every reference to the local**

```bash
cd infra
grep -n "aws_iam_openid_connect_provider.github.arn" oidc.tf
```

Expected: two hits (around lines 18 and 79 in the original file). Replace both with `local.oidc_provider_arn`:

```bash
sed -i 's/aws_iam_openid_connect_provider\.github\.arn/local.oidc_provider_arn/g' oidc.tf
grep -n "local.oidc_provider_arn" oidc.tf
cd ..
```

Expected: three hits — the `locals` definition plus the two principal blocks.

- [ ] **Step 3: Add the new variables**

Append to `infra/variables.tf`:

```hcl
variable "existing_oidc_provider_arn" {
  description = "ARN of an already-created GitHub Actions OIDC provider to reuse instead of creating a new one. AWS allows only one provider per URL per account, and taisei-karate owns it in this account. Leave empty only in an account that has none."
  type        = string
  default     = "arn:aws:iam::777799876926:oidc-provider/token.actions.githubusercontent.com"
}

variable "enable_monitoring" {
  description = "Provisions the SNS alert topics and CloudWatch alarms in monitoring.tf. AWS emails a subscription confirmation on first apply — unconfirmed subscriptions deliver nothing."
  type        = bool
  default     = true
}

variable "enable_cloudtrail" {
  description = "Provisions an account-wide CloudTrail trail for this project. Default false: taisei-karate's trail already captures this account's management events, and AWS bills only one free copy per account — a second trail pays twice for identical data plus its own S3 storage. Set true only if this project's audit trail must outlive the taisei stack."
  type        = bool
  default     = false
}

variable "alert_email" {
  description = "Address subscribed to the SNS alert topics."
  type        = string
  default     = "igorsiergiej@gmail.com"
}
```

Also set the project default in the same file:

```hcl
variable "project" {
  description = "Project name, used to prefix resource names."
  type        = string
  default     = "portfolio"
}
```

And `github_repo`:

```hcl
variable "github_repo" {
  description = "GitHub's OIDC sub-claim prefix for the repo allowed to assume the deploy role. Normally 'owner/repo', but a renamed repo gets an immutable ID-suffixed subject instead — verify with `gh api repos/OWNER/REPO/actions/oidc/customization/sub` before applying, or every AssumeRoleWithWebIdentity call returns 'Not authorized'."
  type        = string
  default     = "igor-siergiej/portfolio"
}
```

- [ ] **Step 4: Point the backend at this project's state bucket**

Replace `infra/backend.tf`:

```hcl
terraform {
  backend "s3" {
    bucket       = "portfolio-tfstate-777799876926" # must match var.tfstate_bucket
    key          = "portfolio/terraform.tfstate"
    region       = "eu-west-2"
    encrypt      = true
    use_lockfile = true # native S3 lock (Terraform >= 1.11), no DynamoDB needed
  }
}
```

Set the matching `tfstate_bucket` default in `infra/variables.tf` to `"portfolio-tfstate-777799876926"`.

- [ ] **Step 5: Create `infra/monitoring.tf`**

Two alarms, not taisei's five — there is no contact Lambda and no Keystatic auth function here, so those alarms have no metric to watch.

```hcl
# Operational alerting: SNS topics (email-subscribed) plus CloudWatch alarms on the traffic
# shapes that mean something is wrong or someone is hammering the distribution. Alarms
# notify; they do not block. A sustained flood still needs a manual response.
#
# CloudTrail is deliberately NOT created here (var.enable_cloudtrail, default false):
# taisei-karate's trail is account-wide and already captures this project's management
# events, and AWS bills only one free copy of management events per account.

locals {
  monitoring_enabled = var.enable_monitoring ? 1 : 0
}

# Two topics: a CloudWatch alarm's actions must target an SNS topic in the alarm's own
# region, and CloudFront publishes metrics only to us-east-1. Same address on both — expect
# two confirmation emails on the first apply.
#
# depends_on the terraform role policy (oidc.tf): a CI apply that grants this role its
# sns:*/cloudwatch:* permissions and then immediately creates these resources would race IAM
# propagation without it.
resource "aws_sns_topic" "alerts" {
  count      = local.monitoring_enabled
  name       = "${var.project}-alerts"
  depends_on = [aws_iam_role_policy.terraform]
}

resource "aws_sns_topic_subscription" "alerts_email" {
  count     = local.monitoring_enabled
  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_sns_topic" "alerts_use1" {
  provider   = aws.us_east_1
  count      = local.monitoring_enabled
  name       = "${var.project}-alerts-use1"
  depends_on = [aws_iam_role_policy.terraform]
}

resource "aws_sns_topic_subscription" "alerts_use1_email" {
  provider  = aws.us_east_1
  count     = local.monitoring_enabled
  topic_arn = aws_sns_topic.alerts_use1[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# A static site behind CloudFront should essentially never 5xx. Sustained errors mean the
# S3 origin or the OAC bucket policy is broken — i.e. the site is down.
resource "aws_cloudwatch_metric_alarm" "cloudfront_5xx" {
  provider            = aws.us_east_1
  count               = local.monitoring_enabled
  alarm_name          = "${var.project}-cloudfront-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "CloudFront 5xx rate above 1% for 10 minutes — origin or bucket policy is broken."
  treat_missing_data  = "notBreaching"

  dimensions = {
    DistributionId = aws_cloudfront_distribution.site.id
    Region         = "Global"
  }

  alarm_actions = [aws_sns_topic.alerts_use1[0].arn]
  ok_actions    = [aws_sns_topic.alerts_use1[0].arn]
}

# Nothing rate-limits the cached static paths (no WAF by design), so an L7 flood runs up
# CloudFront request and data-transfer charges. Shield Standard absorbs L3/L4; this catches
# the request flood so it can be met with a manual response.
resource "aws_cloudwatch_metric_alarm" "cloudfront_requests" {
  provider            = aws.us_east_1
  count               = local.monitoring_enabled
  alarm_name          = "${var.project}-cloudfront-request-flood"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Requests"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Sum"
  threshold           = 50000
  alarm_description   = "More than 50k CloudFront requests in 5 minutes — far above normal portfolio traffic."
  treat_missing_data  = "notBreaching"

  dimensions = {
    DistributionId = aws_cloudfront_distribution.site.id
    Region         = "Global"
  }

  alarm_actions = [aws_sns_topic.alerts_use1[0].arn]
}
```

- [ ] **Step 6: Confirm the terraform role can manage SNS and CloudWatch**

```bash
grep -n "sns\|cloudwatch" infra/oidc.tf
```

If the `terraform` role policy has no `sns:*`/`cloudwatch:*` statements, add them — `monitoring.tf` resources are created by that role in CI and the apply fails with `AccessDenied` otherwise:

```hcl
  statement {
    actions = [
      "sns:CreateTopic",
      "sns:DeleteTopic",
      "sns:GetTopicAttributes",
      "sns:SetTopicAttributes",
      "sns:ListTagsForResource",
      "sns:Subscribe",
      "sns:Unsubscribe",
      "sns:GetSubscriptionAttributes",
      "sns:ListSubscriptionsByTopic",
      "cloudwatch:PutMetricAlarm",
      "cloudwatch:DeleteAlarms",
      "cloudwatch:DescribeAlarms",
      "cloudwatch:ListTagsForResource",
    ]
    resources = ["*"]
  }
```

- [ ] **Step 7: Validate**

```bash
cd infra
terraform fmt
terraform init -backend=false
terraform validate
cd ..
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: terraform for shared oidc provider and cloudfront alarms"
```

---

### Task 11: Create the GitHub repo, bootstrap state, apply, deploy

**Files:**
- Modify: `public/robots.txt` (real sitemap URL), `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a live site on a `*.cloudfront.net` URL.

- [ ] **Step 1: Verify AWS credentials are present**

```bash
aws sts get-caller-identity
```

Expected: `"Account": "777799876926"`. If this fails with `NoCredentials`, stop and get credentials — every remaining step needs them.

- [ ] **Step 2: Create the GitHub repo and push**

```bash
gh repo create igor-siergiej/portfolio --public \
  --description "Personal portfolio and technical blog — Astro, deployed to AWS S3/CloudFront via Terraform." \
  --source . --remote origin
git push -u origin main
```

- [ ] **Step 3: Verify the OIDC subject claim**

```bash
gh api repos/igor-siergiej/portfolio/actions/oidc/customization/sub
```

If `use_default` is `true`, the default `repo:igor-siergiej/portfolio:ref:refs/heads/main` subject applies and `var.github_repo` is already correct. If a `sub_claim_prefix` is returned (the ID-suffixed immutable form), set `var.github_repo` to that exact string in `infra/variables.tf` before applying — otherwise every deploy fails with "Not authorized".

- [ ] **Step 4: Bootstrap the state bucket**

The state bucket cannot be created by the config that stores its state in it.

```bash
aws s3 mb s3://portfolio-tfstate-777799876926 --region eu-west-2
aws s3api put-bucket-versioning --bucket portfolio-tfstate-777799876926 \
  --versioning-configuration Status=Enabled
```

- [ ] **Step 5: Apply**

```bash
cd infra
terraform init
terraform plan -out=tfplan
```

Review the plan. It must show **no** `aws_iam_openid_connect_provider` creation — if it does, `existing_oidc_provider_arn` is empty and the apply will fail with `EntityAlreadyExists`.

```bash
terraform apply tfplan
cd ..
```

- [ ] **Step 6: Confirm the SNS subscriptions**

Two confirmation emails arrive at `igorsiergiej@gmail.com` (one per region). Click both. An unconfirmed subscription silently delivers nothing — the alarms will look healthy and page no one.

- [ ] **Step 7: Set the repository variables**

```bash
cd infra
gh variable set S3_BUCKET                  -b "$(terraform output -raw bucket_name)"
gh variable set CLOUDFRONT_DISTRIBUTION_ID -b "$(terraform output -raw distribution_id)"
gh variable set AWS_DEPLOY_ROLE_ARN        -b "$(terraform output -raw deploy_role_arn)"
gh variable set AWS_REGION                 -b "$(terraform output -raw aws_region)"
gh variable set SITE_URL                   -b "$(terraform output -raw cloudfront_url)"
cd ..
```

- [ ] **Step 8: Put the real sitemap URL in robots.txt**

```bash
SITE=$(cd infra && terraform output -raw cloudfront_url)
printf 'User-agent: *\nAllow: /\n\nSitemap: %s/sitemap-index.xml\n' "$SITE" > public/robots.txt
cat public/robots.txt
```

- [ ] **Step 9: Trigger the deploy**

```bash
git add -A
git commit -m "chore: point robots.txt at the live sitemap"
git push
gh run watch
```

Expected: `lint`, `test`, `build`, `release` and `deploy` all green.

- [ ] **Step 10: Smoke-test the live site**

```bash
SITE=$(cd infra && terraform output -raw cloudfront_url)
curl -sS -o /dev/null -w "home %{http_code}\n" "$SITE/"
curl -sS -o /dev/null -w "projects %{http_code}\n" "$SITE/projects/"
curl -sS -o /dev/null -w "blog %{http_code}\n" "$SITE/blog/"
curl -sS -o /dev/null -w "cv %{http_code}\n" "$SITE/cv.pdf"
curl -sS -o /dev/null -w "404 %{http_code}\n" "$SITE/definitely-not-a-page"
curl -sS "$SITE/rss.xml" | grep -c "<link>$SITE"
```

Expected: `200` for the first four, `404` for the last, and a non-zero count of absolute feed links pointing at the real host — that last check is what proves `SITE_URL` reached the build.

- [ ] **Step 11: Verify in a real browser**

Open the CloudFront URL, confirm both themes render, navigate home → projects → a case study → blog, and check the page at mobile width.

- [ ] **Step 12: Commit any fixes and push**

---

### Task 12: Documentation and cleanup

**Files:**
- Modify: `README.md`, `infra/README.md`
- Delete: any leftover template artefacts

**Interfaces:** none.

- [ ] **Step 1: Rewrite `README.md`**

````markdown
# portfolio

Personal portfolio and technical blog — [live site](<CLOUDFRONT_URL>).

Astro (static) + Tailwind v4 + React islands, content as files, deployed to AWS
S3 + CloudFront via Terraform and GitHub Actions OIDC. No CMS, no server.

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
````

Replace `<CLOUDFRONT_URL>` with the real output.

- [ ] **Step 2: Update `infra/README.md`**

Correct the bucket names and project references to `portfolio`/`portfolio-tfstate-777799876926`, delete the contact-form section (there is no contact Lambda), and add a short section documenting the shared OIDC provider and the `enable_cloudtrail` decision.

- [ ] **Step 3: Check for leftover template artefacts**

```bash
grep -rn "content-website-template\|shadcn-landing-page\|__APP_" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs . || echo "clean"
ls src/components/ui
```

`src/components/ui` should contain only `button.tsx`, `card.tsx`, `badge.tsx`, `dropdown-menu.tsx`, `sheet.tsx` and `Button.astro`. Delete anything else that nothing imports:

```bash
bun run audit   # fallow dead-code audit
```

- [ ] **Step 4: Final full verification**

```bash
bun install && bunx astro sync && bun run lint && bun run tsc --noEmit && bun run test && bun run build && bun run test:e2e
```

Expected: every command exits 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: project and infrastructure readme"
git push
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Repository + scaffold | 1 |
| De-Keystatic (8-file surface) | 1 |
| Content model — `posts` additions, `projects` collection | 3 |
| Routes incl. `/posts` → `/blog` rename | 4, 5, 6, 7 |
| Visual design — fonts, tokens, dark mode, component trim | 2 |
| Case-study spine + seed content | 8 |
| Infrastructure — shared OIDC, sub-claim, monitoring/CloudTrail split, omitted contact/WAF | 10, 11 |
| CI/CD + repo variables | 11 |
| Testing — 3 Vitest units, 3 Playwright smokes | 3, 9 |
| Migration — CV, archived projects | 7, 8 |
| Risks — OIDC collision, sub mismatch, SNS confirmation | 10 step 1, 11 steps 3 and 6 |

**Placeholders:** none. Every code step carries the actual content; the only deliberate `[bracketed]` text is inside the Task 8 case-study template, where the prose is Igor's to write and the structure is what the plan fixes.

**Type consistency:** `publishedPosts`, `featuredProjects`, `orderedProjects` are defined in Task 3 and consumed under those exact names in Tasks 4, 5 and 6. `StackChips` takes `{ items: string[] }` in Task 5 and is called that way in Tasks 5 and 6. `Layout` gains `wide?: boolean` in Task 2 and is used with `wide` in Tasks 5 and 6. `siteConfig.email`/`siteConfig.social.github`/`.linkedin` are defined in Task 2 step 8 and consumed in Tasks 2, 6 and 7.
