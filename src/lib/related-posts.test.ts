import type { CollectionEntry } from 'astro:content';
import { describe, expect, it } from 'vitest';
import { getRelatedPosts } from './related-posts';

const makePost = (id: string, publishDate: Date): CollectionEntry<'posts'> =>
    ({ id, data: { title: id, publishDate } }) as CollectionEntry<'posts'>;

describe('getRelatedPosts', () => {
    it('excludes the current post and orders by most recent first', () => {
        const posts = [
            makePost('a', new Date('2026-01-01')),
            makePost('b', new Date('2026-03-01')),
            makePost('c', new Date('2026-02-01')),
        ];

        expect(getRelatedPosts(posts, 'a').map((p) => p.id)).toEqual(['b', 'c']);
    });

    it('respects the limit', () => {
        const posts = [makePost('a', new Date()), makePost('b', new Date()), makePost('c', new Date())];
        expect(getRelatedPosts(posts, 'a', 1)).toHaveLength(1);
    });
});
