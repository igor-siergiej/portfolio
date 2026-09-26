/**
 * Syntax-highlighting config shared by the two rendering paths.
 *
 * `.md` goes through Astro's own `markdown.shikiConfig`; `.mdoc` goes through Markdoc's
 * `fence` node, which only picks this up via `@astrojs/markdoc/shiki` in
 * `markdoc.config.mjs`. Both root configs import this object so the two can't drift.
 *
 * `defaultColor: false` is the load-bearing part. With a default colour, Shiki writes
 * `color` and `background-color` straight onto the rendered `<pre>` — and an inline style
 * beats `.prose-content pre { background: var(--muted) }`, so code blocks stay pinned to
 * the theme's own palette and read as a dark slab in light mode. Disabling it emits only
 * `--shiki-light` / `--shiki-dark` custom properties, which `src/styles.css` resolves per
 * theme.
 *
 * Plain `.mjs`, not `.ts`: `markdoc.config.mjs` is bundled by esbuild outside the Astro
 * TypeScript pipeline.
 */
export const shikiConfig = {
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
};
