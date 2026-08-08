export function serializeJsonLd(value: unknown): string {
  const serialized = JSON.stringify(value)

  if (typeof serialized !== "string") {
    throw new TypeError("JSON-LD must be serializable")
  }

  return serialized.replaceAll("<", "\\u003c")
}
