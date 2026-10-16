import type { APIRoute } from 'astro';
import { siteConfig } from '@/config/site';

// Dynamic OG image as SVG. Title and subtitle come from query params; the
// `xmlEscape` function keeps the rendered SVG XML-safe. Splitting the layout
// into `titleLines`, `subtitleLines`, and the response wrapper keeps each
// function under fallow's cyclomatic/cognitive thresholds.
const WIDTH = 1200;
const HEIGHT = 630;

const xmlEscape = (value: string): string =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');

const pushLine = (lines: string[], current: string, word: string, maxChars: number): string => {
    if (!current) return word;
    if (`${current} ${word}`.length <= maxChars) return `${current} ${word}`;
    lines.push(current);
    return word;
};

const wrap = (text: string, maxChars: number): string[] => {
    const lines: string[] = [];
    let current = '';
    for (const word of text.split(/\s+/)) {
        current = pushLine(lines, current, word, maxChars);
    }
    if (current) lines.push(current);
    return lines.slice(0, 4);
};

const renderText = (
    lines: string[],
    x: number,
    startY: number,
    lineHeight: number,
    fontSize: number,
    fill: string,
    fontWeight: string
): string =>
    lines
        .map(
            (line, i) =>
                `<text x="${x}" y="${startY + i * lineHeight}" font-family="ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}">${xmlEscape(line)}</text>`
        )
        .join('');

const renderCard = (title: string, subtitle: string): string => {
    const titleLines = wrap(title, 22);
    const subtitleLines = wrap(subtitle, 60);
    const titleStartY = HEIGHT / 2 - (titleLines.length - 1) * 36;

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">`,
        '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
        '<stop offset="0%" stop-color="#fdfcf7"/>',
        '<stop offset="100%" stop-color="#f0ece1"/>',
        '</linearGradient></defs>',
        `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />`,
        `<rect x="80" y="80" width="6" height="${HEIGHT - 160}" fill="#c2410c" />`,
        renderText(titleLines, 80, titleStartY, 72, 68, '#0b0b0c', '700'),
        renderText(subtitleLines, 80, titleStartY + titleLines.length * 72 + 24, 36, 30, '#4a4a4f', '400'),
        renderText([siteConfig.name], WIDTH - 80, HEIGHT - 56, 0, 22, '#0b0b0c', '500'),
        '</svg>',
    ].join('');
};

const readParam = (url: URL, name: string, fallback: string): string => {
    const value = (url.searchParams.get(name) ?? fallback).trim();
    return value || fallback;
};

export const GET: APIRoute = ({ url }) => {
    const title = readParam(url, 'title', siteConfig.name);
    const subtitle = readParam(url, 'subtitle', siteConfig.description);

    return new Response(renderCard(title, subtitle), {
        headers: {
            'content-type': 'image/svg+xml; charset=utf-8',
            'cache-control': 'public, max-age=3600',
        },
    });
};
