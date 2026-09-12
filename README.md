# dylanpicart.com — rebuilt from scratch 🚀

Static Astro site. To be hosted on GitHub Pages.

## The stack

- **Astro 5** — assembles the pages, renders Markdown posts, highlights code at build time
- **GSAP + ScrollTrigger** — hero stagger, pipeline spine, project hover reveal, timeline reveals
- **Zero backend** — contact form via Formspree (free tier)
- **Design tokens** — gradient (`#FFD0FB → #FFFFCC → #CFFFE9`, 135°) and Inter, sampled from the original site, all in `src/styles/global.css`

## Ship it (one-time setup, ~15 minutes)

1. Create a GitHub repo (e.g. `dylanpicart-site`) and push this folder to `main`.
2. In the repo: **Settings → Pages → Source: GitHub Actions.** The included
   workflow (`.github/workflows/deploy.yml`) builds and deploys on every push.
   You never need Node installed locally.
3. Point DNS at GitHub Pages (at your domain registrar):
   - Four **A records** for `dylanpicart.com` → `185.199.108.153`,
     `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - One **CNAME record** for `www` → `<your-github-username>.github.io`
4. In **Settings → Pages → Custom domain**, enter `dylanpicart.com` and check
   **Enforce HTTPS** (the `public/CNAME` file is already in place).
5. Once the site is live and verified, cancel WordPress hosting. 🎉

## Daily workflow

**New project post:** add a Markdown file to `src/content/projects/`:

```md
---
title: "Post Title"
description: "One or two sentences — this appears in the hover preview card."
date: 2026-08-12
langs: [Python, SQL]
tags: [Data Engineering, Neuroscience, Data Science]
published: true
---

Your post. Code fences (```python, ```sql, ```js, ```bash) get
syntax highlighting and color-coded language tags automatically.
```

Push to `main`. The site rebuilds and deploys itself in ~2 minutes.

**Update the resume:** replace `public/resume.pdf` with real PDF. The embed and download button pick it up
automatically. Update the timeline bullets in `src/pages/index.astro`.

## EDIT ME checklist (before going live)

- [ ] Replace `public/resume.pdf` with your real resume
- [ ] Finalize the About paragraphs in `src/pages/index.astro`
- [ ] Replace the resume timeline scaffolding bullets with your master-document bullets
- [ ] Create a free form at formspree.io and paste the form ID into the contact form
- [ ] Port the seven stub posts' full text from WordPress (each is marked `EDIT ME`)
- [ ] Export/save any WordPress content you want to keep BEFORE canceling hosting

## Local preview (optional)

```bash
npm install
npm run dev      # http://localhost:4321
```

## Where things live

```
src/styles/global.css        ← all design tokens (gradient, colors, chips)
src/layouts/Base.astro       ← nav, spine, fonts, GSAP includes
src/pages/index.astro        ← Hero / About / Projects / Resume / Contact
src/pages/projects/[slug].astro ← blog post template
src/content/projects/*.md    ← the posts themselves
public/js/main.js            ← all GSAP animation logic
public/resume.pdf            ← your resume (replace the placeholder!)
```

The pipeline spine on the left is the site's quiet signature: source →
extract → transform → load → sink, one node per section, drawn as you scroll.
