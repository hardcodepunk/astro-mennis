# De Mennis

Astro portfolio frontend with a Sanity Studio backend.

## Project Structure

- `frontend`: Astro 6 static site.
- `backend`: Sanity Studio 5 content backend.

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
- `SANITY_STUDIO_SITE_URL`: Production frontend URL used for Studio preview links. Defaults to `https://www.demennis.be`.

## Quality Gates

Run these before pushing changes:

```sh
cd frontend
npm run check

cd ../backend
npm run check
```

The frontend check runs Astro diagnostics and a production static build. The backend check runs ESLint, TypeScript, and a Sanity Studio build.

GitHub Actions runs the same checks on pushes and pull requests targeting `main`.

## Deployment

Deploy the frontend as a static Astro site:

```sh
cd frontend
npm run build
```

The generated output is `frontend/dist`.

Deploy the Studio with Sanity:

```sh
cd backend
npm run deploy
```

The frontend is statically generated, so content changes in Sanity are not visible on production until the frontend is rebuilt and redeployed.

## Preview Strategy

Sanity Studio includes production URL preview links for:

- Works: `/works/:slug`
- Categories: `/projects/:slug`
- About page: `/about`
- Global singleton documents: homepage

For production, set `SANITY_STUDIO_SITE_URL` to the deployed frontend URL. For staging, set it to the staging frontend URL in that Studio environment.

Draft preview is not currently enabled. If draft previews become necessary, add a token-protected preview route or server-rendered preview environment before exposing unpublished content.
