import type { CollectionEntry } from 'astro:content';
import { describe, expect, it } from 'vitest';
import { featuredProjects, orderedProjects, publishedPosts } from './content';

const post = (id: string, publishDate: string, draft = false) =>
    ({
        id,
        data: { title: id, publishDate: new Date(publishDate), draft, tags: [] },
    }) as unknown as CollectionEntry<'posts'>;

const project = (id: string, status: string, featured?: number) =>
    ({ id, data: { title: id, status, featured, stack: [] } }) as unknown as CollectionEntry<'projects'>;

describe('publishedPosts', () => {
    it('removes drafts', () => {
        const result = publishedPosts([post('a', '2026-01-01'), post('b', '2026-02-01', true)]);
        expect(result.map((p) => p.id)).toEqual(['a']);
    });

    it('orders newest first', () => {
        const result = publishedPosts([post('old', '2025-01-01'), post('new', '2026-01-01')]);
        expect(result.map((p) => p.id)).toEqual(['new', 'old']);
    });
});

describe('featuredProjects', () => {
    it('keeps only featured entries, in ascending featured order', () => {
        const result = featuredProjects([project('c', 'active', 2), project('a', 'active'), project('b', 'active', 1)]);
        expect(result.map((p) => p.id)).toEqual(['b', 'c']);
    });

    it('does not treat featured 0 as absent', () => {
        const result = featuredProjects([project('first', 'active', 0), project('second', 'active', 1)]);
        expect(result.map((p) => p.id)).toEqual(['first', 'second']);
    });
});

describe('orderedProjects', () => {
    it('groups active, then maintained, then archived', () => {
        const result = orderedProjects([
            project('old', 'archived'),
            project('kept', 'maintained'),
            project('live', 'active'),
        ]);
        expect(result.map((p) => p.id)).toEqual(['live', 'kept', 'old']);
    });

    it('puts featured entries before unfeatured ones within a status', () => {
        const result = orderedProjects([project('zeta', 'active'), project('alpha', 'active', 3)]);
        expect(result.map((p) => p.id)).toEqual(['alpha', 'zeta']);
    });
});
