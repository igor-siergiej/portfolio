// @ts-ignore
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
    loader: glob({ pattern: '**/*.{md,mdoc}', base: './src/content/posts' }),
    schema: z.object({
        title: z.string(),
        description: z.string().optional(),
        publishDate: z.coerce.date().optional(),
        coverImage: z.string().optional(),
        tags: z.array(z.string()).default([]),
        draft: z.boolean().default(false),
    }),
});

const projects = defineCollection({
    loader: glob({ pattern: '**/*.{md,mdoc}', base: './src/content/projects' }),
    schema: z.object({
        title: z.string(),
        summary: z.string(),
        role: z.string(),
        period: z.string(),
        stack: z.array(z.string()).default([]),
        repo: z.string().url().optional(),
        live: z.string().url().optional(),
        status: z.enum(['active', 'maintained', 'archived']),
        featured: z.number().optional(),
        cover: z.string().optional(),
        screenshots: z.array(z.string()).default([]),
    }),
});

export const collections = { posts, projects };
