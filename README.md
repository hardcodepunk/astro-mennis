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

- `PUBLIC_SANITY_PROJECT_ID`: Sanity project id. Current project: `454gxa26`.
- `PUBLIC_SANITY_DATASET`: Sanity dataset. Current dataset: `production`.

Backend:

- `SANITY_STUDIO_PROJECT_ID`: Sanity project id. Defaults to `454gxa26` if unset.
- `SANITY_STUDIO_DATASET`: Sanity dataset. Defaults to `production` if unset.
- `SANITY_STUDIO_APP_ID`: hosted Studio application id. Production uses `st7zms5txswv66ebr4184g2g`.
- `SANITY_STUDIO_SITE_URL`: frontend origin used for Studio preview links. Defaults to `https://www.demennis.be`.

Deployment commands require their target values explicitly in `.env.staging` or `.env.production`;
copy the corresponding checked example file before deploying.

## Quality Gates

Run these before pushing changes:

```sh
cd frontend
npm run check

cd ../backend
npm run check
```

The frontend check runs Astro diagnostics and a production static build. The backend check runs
ESLint, TypeScript, deployment safety and bundle tests, and a Sanity Studio build.

GitHub Actions runs the same checks on pushes and pull requests targeting `main`.

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
```

Staging commands reject the production dataset and hosted application. Production commands require
the exact approved target plus an independent `production` confirmation. Direct Sanity deployment
commands are blocked; see `backend/README.md` for non-interactive CI confirmation details.

The frontend is statically generated, so content changes in Sanity are not visible on production until the frontend is rebuilt and redeployed.

## Preview Strategy

Sanity Studio includes production URL preview links for:

- Works: `/works/:slug`
- Categories: `/projects/:slug`
- About page: `/about`
- Global singleton documents: homepage

For production, set `SANITY_STUDIO_SITE_URL` to the deployed frontend URL. For staging, set it to the staging frontend URL in that Studio environment.

Draft preview is not currently enabled. If draft previews become necessary, add a token-protected preview route or server-rendered preview environment before exposing unpublished content.
