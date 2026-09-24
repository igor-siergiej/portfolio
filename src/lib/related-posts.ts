import type { CollectionEntry } from 'astro:content';

export function getRelatedPosts(
    posts: CollectionEntry<'posts'>[],
    currentId: string,
    limit = 3
): CollectionEntry<'posts'>[] {
    return posts
        .filter((post) => post.id !== currentId)
        .sort((a, b) => (b.data.publishDate?.getTime() ?? 0) - (a.data.publishDate?.getTime() ?? 0))
        .slice(0, limit);
}
