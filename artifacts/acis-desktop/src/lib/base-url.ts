export function getBaseUrl(): string {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  return base ? `${base}/` : "/";
}
