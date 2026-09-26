import { expect, test } from '@playwright/test';

// The toggle is a `client:idle` island: its markup ships server-rendered, so a click that
// lands before hydration is silently dropped. Astro's island element drops its `ssr`
// attribute once hydrated, which is the only reliable signal that the handler is attached.
const HYDRATED_TOGGLE = 'astro-island[component-export="ThemeToggle"]:not([ssr])';

test.describe('theme', () => {
    // Pins the system preference so the starting state is light regardless of the runner,
    // which is what makes "reload is still dark" prove the stored choice won rather than the
    // media query happening to agree.
    test.use({ colorScheme: 'light' });

    test('toggling switches the theme and the choice survives a reload', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector(HYDRATED_TOGGLE);

        const html = page.locator('html');
        const isDark = () => html.evaluate((el) => el.classList.contains('dark'));

        expect(await isDark()).toBe(false);

        const toggle = page.getByRole('button', { name: 'Toggle theme' });
        await toggle.click();
        expect(await isDark()).toBe(true);
        expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toBe('dark');

        await page.reload();
        expect(await isDark()).toBe(true);

        await page.waitForSelector(HYDRATED_TOGGLE);
        await toggle.click();
        expect(await isDark()).toBe(false);
        expect(await page.evaluate(() => window.localStorage.getItem('theme'))).toBe('light');

        await page.reload();
        expect(await isDark()).toBe(false);
    });

    test('a stored preference is applied on a cold load of any page', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => window.localStorage.setItem('theme', 'dark'));

        await page.goto('/projects');
        expect(await page.locator('html').evaluate((el) => el.classList.contains('dark'))).toBe(true);
    });
});
