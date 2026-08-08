# De Mennis

Astro portfolio frontend with a Sanity Studio backend.

## Project Structure

- `frontend`: Astro 7 static site.
- `backend`: Sanity Studio 6 content backend.

Both apps target Node 24 and npm 11. The repo includes `.node-version` for local runtime selection.

## Local Setup

Install dependencies in both apps:

```sh
cd frontend
npm install

cd ../backend
npm install
```

Create local env files from the examples:

```sh
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Run the frontend:

```sh
cd frontend
npm run dev
```

Run Sanity Studio:

```sh
cd backend
npm run dev
```

## Environment Variables

Frontend:

- `SANITY_CONTENT_SOURCE`: `sanity` by default. Use the checked-in `fixture` source for repeatable offline checks; it is rejected on Vercel.
- `PUBLIC_SANITY_PROJECT_ID`: Sanity project id. Current project: `454gxa26`.
- `PUBLIC_SANITY_DATASET`: Sanity dataset. Current dataset: `production`.

Backend:

- `SANITY_STUDIO_PROJECT_ID`: Sanity project id. Defaults to `454gxa26` if unset.
- `SANITY_STUDIO_DATASET`: Sanity dataset. Defaults to `production` if unset.
- `SANITY_STUDIO_APP_ID`: hosted Studio application id. Production uses `st7zms5txswv66ebr4184g2g`.
- `SANITY_STUDIO_SITE_URL`: frontend origin used for Studio preview links. Defaults to `https://www.demennis.be`.

Deployment commands require their target values explicitly in `.env.<target>`, an optional
`.env.<target>.local`, or the invoking process environment; generic `.env` and `.env.local` files
are ignored for deployment authorization. Copy the corresponding checked example file before an
interactive deployment.

## Content Snapshots

`npm run dev` and `npm run build` each prepare one validated, published Sanity snapshot before Astro starts. Every page and static route in that invocation reads the same atomic `.content-snapshot.json` artifact, so a concurrent CMS edit cannot mix content versions within a build. Restart the development server to refresh CMS content.

Set `SANITY_CONTENT_SOURCE=fixture` to build from synthetic checked-in content without Sanity credentials or network access. Fixture mode fails closed on Vercel. Run the npm scripts rather than invoking `astro dev` or `astro build` directly; the direct commands intentionally bypass snapshot preparation.

## Quality Gates

Run these before pushing changes:

```sh
cd frontend
SANITY_CONTENT_SOURCE=fixture npm run check

cd ../backend
npm run check
```

The frontend check runs unit tests, Astro diagnostics, and a production static build using the synthetic fixture. The backend check runs ESLint, TypeScript, deployment safety and bundle tests, and a Sanity Studio build.

## Deployment

Deploy the frontend as a static Astro site:

```sh
cd frontend
npm run build
```

The generated output is `frontend/dist`.

Deploy the Studio or GraphQL schema through an explicit guarded target:

```sh
cd backend
npm run deploy:staging
npm run deploy:production
npm run deploy-graphql:staging
npm run deploy-graphql:production

# Validate GraphQL changes without deploying
npm run deploy-graphql:staging -- --dry-run
```

Staging commands reject the production dataset and hosted application. Production commands require
the exact approved target plus an independent `production` confirmation. Direct Sanity deployment
commands are blocked; see `backend/README.md` for non-interactive automation confirmation details.

To intentionally deploy reviewed breaking GraphQL changes, append `-- --force` to the guarded
GraphQL command, for example `npm run deploy-graphql:staging -- --force`. Warning: `--force`
performs a real deployment and suppresses Sanity's breaking-change confirmation; run a dry-run and
review its output first. It does not bypass target validation or production confirmation.

The frontend is statically generated, so content changes in Sanity are not visible on production until the frontend is rebuilt and redeployed.

## Preview Strategy

Sanity Studio includes production URL preview links for:

- Works: `/works/:slug`
- Categories: `/projects/:slug`
- About page: `/about`
- Global singleton documents: homepage

For production, set `SANITY_STUDIO_SITE_URL` to the deployed frontend URL. For staging, set it to the staging frontend URL in that Studio environment.

Draft preview is not currently enabled. If draft previews become necessary, add a token-protected preview route or server-rendered preview environment before exposing unpublished content.
