export interface LocalBusinessConfig {
    /** schema.org type — 'LocalBusiness' or a more specific subtype e.g. 'SportsActivityLocation', 'Restaurant'. */
    type: string;
    telephone: string;
    address: {
        streetAddress: string;
        addressLocality: string;
        addressRegion: string;
        postalCode: string;
        addressCountry: string;
    };
    /** schema.org opening hours spec strings, e.g. "Mo-Fr 09:00-18:00". */
    openingHours: string[];
    aggregateRating?: {
        ratingValue: number;
        reviewCount: number;
    };
}

export const siteConfig = {
    name: 'Portfolio',
    title: 'Portfolio',
    description: 'A short description of Portfolio.',
    // Guarded with `typeof process !== 'undefined'` because this module is also imported by
    // client-hydrated islands (Navbar, FAQ), where `process` doesn't exist and a bare
    // `process.env` access throws `ReferenceError: process is not defined` on hydration.
    // `|| ` (not `??`): an unset `vars.SITE_URL` in CI is passed through as `''`, not
    // undefined — `??` wouldn't fall back for that. Guarded with `typeof process !==
    // 'undefined'` because this module is also imported by client-hydrated islands
    // (Navbar, FAQ), where `process` doesn't exist and a bare `process.env` access
    // throws `ReferenceError: process is not defined` on hydration.
    url: (typeof process !== 'undefined' ? process.env.SITE_URL : undefined) || 'http://localhost:4321',
    locale: 'en',
    social: {
        twitter: '',
    },
    defaultOgImage: '/og-default.png',
    /**
     * Set this for a local-business site (address/hours/phone/rating) to get
     * LocalBusiness JSON-LD instead of generic Organization — leave undefined
     * for a non-local-business content site.
     */
    business: undefined as LocalBusinessConfig | undefined,
    faqs: [] as { question: string; answer: string }[],
};

export type SiteConfig = typeof siteConfig;
