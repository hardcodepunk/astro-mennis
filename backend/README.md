# De Mennis Sanity Studio

Sanity Studio for the De Mennis portfolio.

## Setup

```sh
npm install
cp .env.example .env
npm run dev
```

## Scripts

- `npm run dev`: start local Studio.
- `npm run build`: build Studio.
- `npm run lint`: run ESLint.
- `npm run typecheck`: run TypeScript.
- `npm run check`: run lint, typecheck, and build.
- `npm run deploy`: deploy Studio to Sanity.

## Content Model Notes

The Studio uses singleton document entries for:

- SEO
- Site settings
- About page
- Logo marquee

These are exposed through a custom structure in `structure.ts` and hidden from normal new-document creation to avoid accidental duplicates.

Media URL fields are intentionally strict:

- Cloudinary media fields require HTTPS Cloudinary delivery URLs.
- MP4 fields require direct `.mp4` URLs.
- WEBM fields require direct `.webm` URLs.
- YouTube fields require YouTube or `youtu.be` URLs with a video id.

## Preview Links

Production preview links are configured in `sanity.config.ts`. Set `SANITY_STUDIO_SITE_URL` for the target frontend environment.
