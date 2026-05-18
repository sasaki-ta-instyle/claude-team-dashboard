export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  if (dollars === 0) return "$0";
  if (dollars < 1) return `$${dollars.toFixed(2)}`;
  if (dollars < 100) return `$${dollars.toFixed(2)}`;
  return `$${dollars.toFixed(0)}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatDateJP(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function formatDateOnly(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export function daysAgo(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00Z" : ""));
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / (24 * 3600 * 1000));
  if (diff <= 0) return "今日";
  if (diff === 1) return "昨日";
  if (diff < 7) return `${diff}日前`;
  return iso.slice(0, 10);
}
