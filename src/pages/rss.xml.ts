import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { siteConfig } from '@/config/site';
import { publishedPosts } from '@/lib/content';

export async function GET(context: APIContext) {
    const posts = publishedPosts(await getCollection('posts'));

    return rss({
        title: siteConfig.title,
        description: siteConfig.description,
        site: context.site ?? siteConfig.url,
        items: posts.map((post) => ({
            title: post.data.title,
            description: post.data.description,
            pubDate: post.data.publishDate,
            link: `/blog/${post.id}/`,
        })),
    });
}
