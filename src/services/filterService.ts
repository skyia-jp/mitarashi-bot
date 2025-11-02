// Filter service is intentionally removed. Keep a minimal stub for compatibility.
export function isFilterEnabled() {
  return false;
}

export function filterMessage(content: string) {
  // Filtering removed — return content unchanged and a no-op metadata object.
  return { content, blocked: false };
}
