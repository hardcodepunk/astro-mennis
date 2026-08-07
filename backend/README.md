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
- `npm test`: run deployment safety tests.
- `npm run check`: run lint, typecheck, deployment safety tests, and build.

## Deployments

Deployments must go through an explicit guarded command:

- `npm run deploy:staging`: deploy the Studio configured by `.env.staging`.
- `npm run deploy:production`: deploy the approved production Studio.
- `npm run deploy-graphql:staging`: deploy GraphQL to the staging content target.
- `npm run deploy-graphql:production`: deploy GraphQL to the approved production content target.

Copy `.env.staging.example` to `.env.staging` and replace every placeholder before the first
staging deployment. Copy `.env.production.example` to `.env.production` before a production
deployment. Deployment values must be present explicitly even though normal local Studio builds
retain the checked production defaults.

The wrapper validates the project, dataset, hosted Studio application, and preview URL before it
starts the Sanity CLI. A staging command is rejected if it resolves to a production target. A
production command prints the resolved target and requires typing `production` before continuing.
For non-interactive production CI, set `SANITY_DEPLOY_CONFIRM=production` explicitly.

Direct `sanity deploy` and `sanity graphql deploy` calls are blocked by `sanity.cli.ts` so their
target cannot silently fall back to production.

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
