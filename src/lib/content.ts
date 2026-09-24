import type { CollectionEntry } from 'astro:content';

const STATUS_ORDER: Record<string, number> = { active: 0, maintained: 1, archived: 2 };

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

export function orderedProjects(projects: CollectionEntry<'projects'>[]): CollectionEntry<'projects'>[] {
    return [...projects].sort((a, b) => {
        const byStatus = (STATUS_ORDER[a.data.status] ?? 9) - (STATUS_ORDER[b.data.status] ?? 9);
        if (byStatus !== 0) return byStatus;

        const aFeatured = a.data.featured !== undefined;
        const bFeatured = b.data.featured !== undefined;
        if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;
        if (aFeatured && bFeatured) return (a.data.featured ?? 0) - (b.data.featured ?? 0);

        return a.data.title.localeCompare(b.data.title);
    });
}
