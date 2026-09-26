import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

interface PostFrontmatter {
    title: string;
    draft: boolean;
}

/**
 * Reads the post collection straight off disk so the feed can be checked against the posts
 * that exist, not against a title hard-coded in the test. Frontmatter here is flat scalars,
 * so a line scan is enough and keeps the spec free of a YAML dependency.
 */
function readPosts(): PostFrontmatter[] {
    // Playwright transpiles specs to CommonJS, so `import.meta.url` is unavailable; the
    // configured test directory is the stable anchor for repo-relative paths.
    const postsDir = join(test.info().project.testDir, '..', 'src', 'content', 'posts');

    return readdirSync(postsDir)
        .filter((file) => file.endsWith('.mdoc') || file.endsWith('.md'))
        .map((file) => {
            const source = readFileSync(join(postsDir, file), 'utf8');
            const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1];
            if (!frontmatter) throw new Error(`No frontmatter in ${file}`);

            const title = /^title:\s*(.+)$/m
                .exec(frontmatter)?.[1]
                ?.trim()
                .replace(/^['"]|['"]$/g, '');
            if (!title) throw new Error(`No title in ${file}`);

            return { title, draft: /^draft:\s*true\s*$/m.test(frontmatter) };
        });
}

async function readFeed(page: Page, xml: string) {
    return page.evaluate((body) => {
        const doc = new DOMParser().parseFromString(body, 'application/xml');
        const error = doc.querySelector('parsererror')?.textContent ?? null;

        return {
            error,
            channelLink: doc.querySelector('channel > link')?.textContent ?? null,
            items: [...doc.querySelectorAll('channel > item')].map((item) => ({
                title: item.querySelector('title')?.textContent ?? null,
                link: item.querySelector('link')?.textContent ?? null,
            })),
        };
    }, xml);
}

test('rss feed is well-formed and every link is absolute on the site origin', async ({ page, request, baseURL }) => {
    const response = await request.get('/rss.xml');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('xml');

    // `about:blank` gives a DOMParser without loading site markup that could influence it.
    await page.goto('about:blank');
    const feed = await readFeed(page, await response.text());

    expect(feed.error).toBeNull();
    expect(feed.items.length).toBeGreaterThan(0);

    // The failure this exists for: an unset `SITE_URL` ships `http://localhost:4321` links to
    // every subscriber. Under test both are localhost, so the assertion is on the origins
    // agreeing, which is what breaks when the build's `site` is wrong or a link goes relative.
    const expected = new URL(baseURL ?? '').origin;

    for (const item of feed.items) {
        expect(item.link).toMatch(/^https?:\/\//);
        expect(new URL(item.link ?? '').origin).toBe(expected);
    }

    expect(new URL(feed.channelLink ?? '').origin).toBe(expected);
});

test('feed carries every published post and no drafts', async ({ page, request }) => {
    const posts = readPosts();
    const published = posts.filter((post) => !post.draft).map((post) => post.title);
    const drafts = posts.filter((post) => post.draft).map((post) => post.title);

    expect(published.length).toBeGreaterThan(0);
    // With no draft on disk the exclusion below would hold vacuously, so the collection keeps a
    // permanently-unpublished fixture; this asserts it is still there to be excluded.
    expect(drafts.length).toBeGreaterThan(0);

    await page.goto('about:blank');
    const feed = await readFeed(page, await (await request.get('/rss.xml')).text());

    // Exact set equality covers both directions: a published post missing from the feed fails
    // it, and so does a draft leaking in, since draft titles are absent from `published`.
    expect(feed.items.map((item) => item.title).sort()).toEqual([...published].sort());
});
