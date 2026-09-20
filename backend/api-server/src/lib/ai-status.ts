let unavailableUntil = 0;

export function isAiAvailable(): boolean {
  return (
    Boolean(process.env.OPENAI_API_KEY) &&
    process.env.OPENAI_PROVIDER_READY !== "false" &&
    Date.now() >= unavailableUntil
  );
}

export function markAiTemporarilyUnavailable(durationMs = 5 * 60_000): void {
  unavailableUntil = Date.now() + durationMs;
}