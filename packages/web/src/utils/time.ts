export function formatDateTime(value: number | string | Date): string {
  try {
    const date = value instanceof Date ? value : new Date(value);
    const now = new Date();
    const sameYear = date.getFullYear() === now.getFullYear();

    return date.toLocaleString(undefined, {
      ...(sameYear ? {} : { year: "numeric" }),
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
