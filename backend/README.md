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
deployment. The wrapper accepts explicit values from `.env.<target>`, an optional
`.env.<target>.local`, or the invoking process environment. Generic `.env` and `.env.local` files
are ignored for deployment authorization, even though normal local Studio builds retain the
checked production defaults.

Run a guarded GraphQL dry-run to validate the schema and inspect breaking changes without
deploying:

```sh
npm run deploy-graphql:staging -- --dry-run
npm run deploy-graphql:production -- --dry-run
```

After reviewing the dry-run output, an intentional breaking deployment can use `--force`:

```sh
npm run deploy-graphql:staging -- --force
npm run deploy-graphql:production -- --force
```

Warning: `--force` performs a real deployment and suppresses Sanity's breaking-change
confirmation. Use it only after reviewing the dry-run output. It does not bypass target validation
or production confirmation.

The wrapper validates the project, dataset, hosted Studio application, and preview URL before it
starts the Sanity CLI. A staging command is rejected if it resolves to a production target. A
production command prints the resolved target and requires typing `production` before continuing.
For non-interactive production automation, set `SANITY_DEPLOY_CONFIRM=production` explicitly.

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
