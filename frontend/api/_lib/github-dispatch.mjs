export async function dispatchContentDeployment({
  repository,
  token,
  event,
  fetchImplementation = fetch,
}) {
  const [owner, name] = repository.split("/")
  const response = await fetchImplementation(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/dispatches`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": "astro-mennis-sanity-deploy-webhook",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({
        event_type: "sanity-content-published",
        client_payload: {
          event_key: event.eventKey,
          transaction_time: event.transactionTime,
          document_id: event.documentId,
          document_type: event.documentType,
          operation: event.operation,
        },
      }),
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    },
  )

  if (response.status !== 204) {
    throw new Error(`GitHub repository dispatch returned HTTP ${response.status}`)
  }
}
