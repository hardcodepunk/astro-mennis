# CMS-triggered frontend deployments

This repository contains an inactive-by-default production deployment scaffold:

1. Sanity sends published document events to `frontend/api/sanity-deploy.mjs`.
2. The Vercel function verifies the untouched request body with the official
   `@sanity/webhook` toolkit, rejects stale signatures, and checks both the signed payload and
   Sanity headers against one configured project and dataset.
3. A read-only `deploymentStatus` singleton stores the latest event and a bounded set of recent
   signed event keys. The function dispatches a fixed GitHub repository event; no target is read
   from the webhook payload.
4. `.github/workflows/cms-content-deploy.yml` waits 60 seconds for repository-dispatch events.
   GitHub concurrency cancels an older run when newer content arrives. The workflow then acquires
   a uniquely owned, 12-minute claim on the latest event before it can call the Vercel deploy hook.
   The claim transaction itself verifies that the newest event is at least 60 seconds old, so a
   watchdog cannot bypass the quiet period. A 15-minute watchdog and manual dispatch recover failed
   events and claims abandoned by canceled runs.
5. Editors can open **Frontend deployment** in Studio to see whether an event is waiting,
   requesting a deployment, accepted by Vercel, or needs attention.

`Deployment requested` deliberately means that Vercel accepted its deploy hook and returned a job
id. It does not claim that the deployment is live. The linked GitHub run and Vercel dashboard are
the final source of truth.

The implementation follows Sanity's documented signed raw-body and Delta-GROQ behavior, GitHub's
`repository_dispatch` and concurrency behavior, and Vercel's deploy-hook response model:

- <https://www.sanity.io/docs/content-lake/webhooks>
- <https://github.com/sanity-io/webhook-toolkit>
- <https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event>
- <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#concurrency>
- <https://vercel.com/docs/deploy-hooks>
- <https://vercel.com/docs/functions/runtimes/node-js>

## Security and delivery behavior

- Only `POST application/json` requests are accepted.
- Signatures are checked against the raw text, before JSON parsing, and must be no more than five
  minutes old.
- Project, dataset, operation, document id, document type, stable revision identity, and transaction
  time come from the approved signed projection. Relevant delivery headers must agree with those
  signed values. Draft/version ids and unlisted content types are rejected.
- A SHA-256 event key is derived only from the signed project, dataset, revision identity, document,
  type, and operation. Fifty recent hashes are retained; unsigned delivery ids cannot alter them.
- Older transaction times cannot replace a newer queued event.
- If GitHub dispatch fails before its failure state can be saved, the still-pending event is safe
  to retry. The watchdog also claims events whose GitHub dispatch or deployment workflow failed.
- A workflow receiving HTTP `202` or `409` from the claim endpoint does not call Vercel. Only a
  `200` response containing `{"updated":true,"eventKey":"..."}` grants the claim. Repository
  dispatches must receive their exact event key back; watchdog runs use the authoritative returned
  key.
- Every claim is fenced by a GitHub run/attempt owner id. Only that owner can record a deploy-hook
  request or failure. A canceled run's claim cannot be taken over until its 12-minute lease expires,
  which is longer than the workflow's 10-minute timeout.
- The quiet-period age is checked inside the revision-guarded claim. Content arriving while a
  workflow sleeps changes the authoritative event key, and a scheduled/manual run receives `202`
  until the latest event has been quiet for 60 seconds. A retry of the same signed event preserves
  its original receipt time, so provider redelivery cannot continually restart that window.
- Delivery is at least once, not exactly once. If Vercel accepts the hook but the status callback is
  lost, a recovery run may request the same static build again. Repeating a build is safe; Studio
  and the Vercel dashboard must not be interpreted as proving exactly one external request.
- All automation fields are read-only in Studio, and the automation-owned singleton exposes no
  document actions. The status document contains no credentials.
- Status-document writes must be excluded from the Sanity webhook filter to prevent a loop.
- Deploy-hook URLs, Sanity tokens, callback secrets, and GitHub tokens are secrets. Never commit or
  print them.

## External activation required

Nothing in this change creates a Sanity webhook, token, GitHub secret, or Vercel deploy hook. An
administrator must complete every step below after the code and workflow exist on the default
branch.

### 1. Create secrets

Generate two independent random secrets, for example with `openssl rand -base64 32`:

- one Sanity webhook signing secret;
- one GitHub-to-Vercel status callback secret.

Create a Sanity robot token with the least write access available to the `production` dataset and
the `deploymentStatus` document type. It is used only by the two Vercel functions. If the Sanity
plan supports custom roles, restrict the token to reading and mutating that one type.

Create a fine-grained GitHub token scoped only to `hardcodepunk/astro-mennis`, with **Contents:
write**, which GitHub requires for `POST /repos/{owner}/{repo}/dispatches`.

### 2. Configure and deploy the Vercel functions

Confirm that the Vercel project root directory is `frontend`, Node.js is 24.x, and **Include source
files outside of the Root Directory in the Build Step** is enabled. The frontend installs the
checked-in `../shared/media-contract` package, so a deployment without that setting cannot install
or build the application. Add these production environment variables:

| Variable | Purpose |
| --- | --- |
| `SANITY_WEBHOOK_SECRET` | Sanity webhook signing secret |
| `SANITY_WEBHOOK_PROJECT_ID` | `454gxa26` |
| `SANITY_WEBHOOK_DATASET` | `production` |
| `SANITY_WEBHOOK_ID` | Optional extra scope; set to the webhook id after creation |
| `SANITY_DEPLOY_STATUS_TOKEN` | Least-privilege Sanity robot token |
| `SANITY_DEPLOY_STATUS_CALLBACK_SECRET` | Independent GitHub callback secret |
| `GITHUB_DISPATCH_TOKEN` | Fine-grained repository token |
| `GITHUB_REPOSITORY` | `hardcodepunk/astro-mennis` |

Deploy the merged revision manually once. Verify that these routes exist; unauthenticated requests
must fail:

- `https://www.demennis.be/api/sanity-deploy`
- `https://www.demennis.be/api/sanity-deploy-status`

### 3. Configure GitHub and Vercel

Create one Vercel deploy hook for the production project and the repository's default branch.
Treat its generated URL as a credential.

Add these GitHub Actions values:

- repository secret `VERCEL_DEPLOY_HOOK_URL`: the generated Vercel URL;
- repository secret `CMS_DEPLOY_STATUS_SECRET`: the same value as
  `SANITY_DEPLOY_STATUS_CALLBACK_SECRET`;
- repository variable `CMS_DEPLOY_STATUS_URL`:
  `https://www.demennis.be/api/sanity-deploy-status`;
- repository variable `CMS_DEPLOY_ENABLED`: keep this set to `false` until every activation and
  verification step below is complete.

The `cms-content-deploy.yml` workflow must already be present on the default branch because GitHub
only receives `repository_dispatch` events for workflows on that branch. The explicit enable
variable keeps repository, scheduled, and manual runs from using incomplete configuration.

### 4. Create the Sanity webhook

In the Sanity project API settings, create a document webhook with:

- URL: `https://www.demennis.be/api/sanity-deploy`
- Dataset: `production` (never `*`)
- Method: `POST`
- Trigger on: create, update, and delete
- Drafts: off
- Versions: off
- API version: `v2026-08-06`
- Secret: the value configured as `SANITY_WEBHOOK_SECRET`

Filter:

```groq
coalesce(after()._type, before()._type) in [
  "seo",
  "siteSettings",
  "bioWithPreview",
  "contactPage",
  "logoMarquee",
  "work",
  "category"
]
```

Projection:

```groq
{
  "projectId": sanity::projectId(),
  "dataset": sanity::dataset(),
  "documentId": coalesce(after()._id, before()._id),
  "documentType": coalesce(after()._type, before()._type),
  "operation": delta::operation(),
  "eventId": coalesce(after()._rev, before()._rev),
  "transactionTime": now()
}
```

`eventId` is the revision produced by a create/update or the last revision present before a delete;
combining it with the signed operation keeps those events distinct. In a webhook projection,
Sanity defines `now()` as the event's transaction time. The receiver compares the corresponding
delivery timestamp header for consistency, but never uses unsigned headers for identity or order.

After Sanity creates the webhook, copy its id into Vercel as `SANITY_WEBHOOK_ID` and redeploy the
functions to enable the optional webhook-id check. As the final activation step, set the GitHub
repository variable `CMS_DEPLOY_ENABLED` to `true`, then enable the Sanity webhook if it was created
disabled. A verified event queued while the workflow was disabled will be recovered by the next
watchdog run.

## Verification checklist

Use staging equivalents first when a staging Sanity dataset and Vercel project are available.

1. Run `npm test` and `npm run typecheck` in `frontend`, then `npm test`, `npm run lint`, and
   `npm run typecheck` in `backend`.
2. Send an unsigned or incorrectly signed request to `/api/sanity-deploy`; expect `401` and no
   GitHub workflow.
3. Publish a harmless content edit. In Studio, **Frontend deployment** should move to **Waiting for
   quiet period**, then **Requesting deployment**, then **Deployment requested**.
4. Publish two edits less than 60 seconds apart. The first GitHub run should be canceled or refused
   as stale. The latest event must own the claim before requesting Vercel; an already accepted hook
   cannot be recalled, so an edge-timed duplicate build remains possible.
5. In staging, cancel a workflow after it claims an event. Confirm that it cannot be taken over
   during the 12-minute lease and that a later scheduled or manual run recovers it.
6. Confirm the GitHub run links to a Vercel deploy-hook job and check the production deployment in
   Vercel before treating the content as live.
7. Inspect Sanity's webhook attempt log. Signature/scope errors are non-retryable 4xx responses;
   transient status/dispatch errors are 5xx responses. A successful failure callback appears as
   **Action required**; if the status service itself is unavailable, rely on the provider logs and
   the next watchdog retry instead.

To disable the pipeline, set `CMS_DEPLOY_ENABLED` to `false`, then disable the Sanity webhook.
Revoke the Vercel deploy hook and the two write tokens when the shutdown is permanent. Existing
site delivery is unaffected; content simply returns to requiring a manual frontend deployment.
