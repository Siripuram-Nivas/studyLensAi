export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function relativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  for (const [unit, amount] of units) {
    if (Math.abs(seconds) >= amount) {
      return formatter.format(Math.round(seconds / amount), unit);
    }
  }
  return "just now";
}

export function contentTypeLabel(type: string): string {
  if (type === "pdf") return "PDF";
  if (type === "image") return "Image";
  return "Pasted text";
}

export function sessionLabel(type: string): string {
  const labels: Record<string, string> = {
    summary: "Summary generated",
    explanation: "Concept explained",
    concepts: "Key concepts extracted",
    quiz_generation: "Quiz generated",
    quiz_attempt: "Quiz completed",
  };
  return labels[type] || type.replace(/_/g, " ");
}

export function scoreTone(percentage: number | null): string {
  if (percentage === null) return "text-ink-500";
  if (percentage >= 80) return "text-emerald-700";
  if (percentage >= 50) return "text-amber-700";
  return "text-rose-700";
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}
