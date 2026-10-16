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

// Resume is a singleton collection (single file `profile.md` in `src/content/resume/`).
// The schema is option A from the spec: experience / education / skills are
// `{ items: [...] }` arrays so the page can render them in any order.
const resume = defineCollection({
    loader: glob({ pattern: 'profile.md', base: './src/content/resume' }),
    schema: z.object({
        title: z.string(),
        headline: z.string(),
        location: z.string().optional(),
        summary: z.string(),
        experience: z.array(
            z.object({
                company: z.string(),
                role: z.string(),
                period: z.string(),
                location: z.string().optional(),
                highlights: z.array(z.string()).default([]),
            })
        ),
        skills: z.array(
            z.object({
                category: z.string(),
                items: z.array(z.string()),
            })
        ),
        education: z.array(
            z.object({
                institution: z.string(),
                qualification: z.string(),
                period: z.string(),
                details: z.string().optional(),
            })
        ),
    }),
});

export const collections = { posts, projects, resume };
