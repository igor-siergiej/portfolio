import type { APIRoute } from 'astro';
import { siteConfig } from '@/config/site';

// Dynamic OG image as SVG. SVG is lighter than PNG and renders crisp at any
// size, and Twitter/Facebook scrapers accept image/svg+xml from image URLs
// declared as og:image. Title and subtitle are URL-encoded to keep the SVG
// XML-safe. The accent palette is the site's `var(--primary)` so the image
// matches the rest of the brand.
const WIDTH = 1200;
const HEIGHT = 630;

const xmlEscape = (value: string): string =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');

const wrap = (text: string, maxChars: number): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        if (!current) {
            current = word;
            continue;
        }
        if (`${current} ${word}`.length <= maxChars) {
            current = `${current} ${word}`;
        } else {
            lines.push(current);
            current = word;
        }
    }
    if (current) lines.push(current);
    return lines.slice(0, 4);
};

export const GET: APIRoute = ({ url }) => {
    const title = (url.searchParams.get('title') ?? siteConfig.name).trim() || siteConfig.name;
    const subtitle = (url.searchParams.get('subtitle') ?? siteConfig.description).trim() || siteConfig.description;

    const titleLines = wrap(title, 22);
    const subtitleLines = wrap(subtitle, 60);
    const titleStartY = HEIGHT / 2 - (titleLines.length - 1) * 36;

    const titleSvg = titleLines
        .map(
            (line, i) =>
                `<text x="80" y="${titleStartY + i * 72}" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="68" font-weight="700" fill="#0b0b0c">${xmlEscape(line)}</text>`
        )
        .join('');
    const subtitleSvg = subtitleLines
        .map(
            (line, i) =>
                `<text x="80" y="${titleStartY + titleLines.length * 72 + 24 + i * 36}" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="30" font-weight="400" fill="#4a4a4f">${xmlEscape(line)}</text>`
        )
        .join('');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
    <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fdfcf7"/>
            <stop offset="100%" stop-color="#f0ece1"/>
        </linearGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />
    <rect x="80" y="80" width="6" height="${HEIGHT - 160}" fill="#c2410c" />
    ${titleSvg}
    ${subtitleSvg}
    <text x="${WIDTH - 80}" y="${HEIGHT - 56}" text-anchor="end" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="22" font-weight="500" fill="#0b0b0c">${xmlEscape(siteConfig.name)}</text>
</svg>`;

    return new Response(svg, {
        headers: {
            'content-type': 'image/svg+xml; charset=utf-8',
            'cache-control': 'public, max-age=3600',
        },
    });
};
