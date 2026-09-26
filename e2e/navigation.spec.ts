import { expect, test } from '@playwright/test';

test('home reaches a case study and links back to the index', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'See selected work' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();

    // Each row's anchor wraps its own `<h2>`; the stack chips sit outside it, so the row is
    // addressed through the heading it contains rather than by the anchor's accessible name.
    await page
        .getByRole('link')
        .filter({ has: page.getByRole('heading', { level: 2, name: 'shoppingo' }) })
        .click();

    await expect(page).toHaveURL(/\/projects\/shoppingo\/?$/);
    await expect(page.getByRole('heading', { level: 1, name: 'shoppingo' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Decisions and trade-offs' })).toBeVisible();

    await page.getByRole('link', { name: '← All projects' }).click();
    await expect(page).toHaveURL(/\/projects\/?$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
});

test('blog index reaches a published post', async ({ page }) => {
    await page.goto('/blog');

    const post = page.getByRole('link', { name: /Static sites on AWS without click-ops/ }).first();
    await expect(post).toBeVisible();
    await post.click();

    await expect(page).toHaveURL(/\/blog\/[^/]+\/?$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Static sites on AWS without click-ops');
});
