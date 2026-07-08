const fallbackReturnPath = "/account";

function decodeRepeatedly(value: string): string {
  let current = value;
  for (let index = 0; index < 3; index += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
}

export function safeReturnPath(value: string | null | undefined): string {
  if (!value) return fallbackReturnPath;
  const trimmed = value.trim();
  const decoded = decodeRepeatedly(trimmed);

  if (!decoded.startsWith("/")) return fallbackReturnPath;
  if (decoded.startsWith("//")) return fallbackReturnPath;
  if (decoded.includes("\\")) return fallbackReturnPath;

  try {
    const parsed = new URL(decoded, "https://pfseeker.com");
    if (parsed.origin !== "https://pfseeker.com") return fallbackReturnPath;
    if (parsed.pathname.startsWith("/auth/discord/callback")) {
      return fallbackReturnPath;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallbackReturnPath;
  }
}
