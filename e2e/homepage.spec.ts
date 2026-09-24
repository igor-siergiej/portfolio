import { expect, test } from '@playwright/test';

test('homepage has a title and no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');

    await expect(page).toHaveTitle(/.+/);
    expect(errors).toEqual([]);
});
