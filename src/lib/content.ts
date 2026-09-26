import type { CollectionEntry } from 'astro:content';

const STATUS_ORDER: Record<CollectionEntry<'projects'>['data']['status'], number> = {
    active: 0,
    maintained: 1,
    archived: 2,
};

export function publishedPosts(posts: CollectionEntry<'posts'>[]): CollectionEntry<'posts'>[] {
    return posts
        .filter((post) => !post.data.draft)
        .sort((a, b) => (b.data.publishDate?.getTime() ?? 0) - (a.data.publishDate?.getTime() ?? 0));
}

export function featuredProjects(projects: CollectionEntry<'projects'>[]): CollectionEntry<'projects'>[] {
    return projects
        .filter((project) => project.data.featured !== undefined)
        .sort((a, b) => (a.data.featured ?? 0) - (b.data.featured ?? 0));
}

const featuredRank = (project: CollectionEntry<'projects'>): number => project.data.featured ?? Number.MAX_SAFE_INTEGER;

export function orderedProjects(projects: CollectionEntry<'projects'>[]): CollectionEntry<'projects'>[] {
    return [...projects].sort(
        (a, b) =>
            STATUS_ORDER[a.data.status] - STATUS_ORDER[b.data.status] ||
            featuredRank(a) - featuredRank(b) ||
            a.data.title.localeCompare(b.data.title)
    );
}
