import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Every project post is a Markdown file in src/content/projects/.
// Add a new post = add a new .md file. That's the whole workflow.
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    // Languages shown as color-coded chips (Python, SQL, JavaScript, Bash...)
    langs: z.array(z.string()).default([]),
    // Topic tags displayed as outlined pills on project pages
    tags: z.array(z.string()).default([]),
    // Optional: set false to hide a post while drafting
    published: z.boolean().default(true),
    // Set true for the 4 posts featured on the homepage
    featured: z.boolean().default(false),
    // Groups posts on the /projects page: 'professional' or 'research'
    section: z.enum(['professional', 'research']).default('professional'),
  }),
});

export const collections = { projects };
