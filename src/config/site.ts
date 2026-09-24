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
