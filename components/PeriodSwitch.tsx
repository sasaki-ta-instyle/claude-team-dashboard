"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const PERIODS = [
  { value: "month", label: "月 (30日)" },
  { value: "week", label: "週 (7日)" },
  { value: "day", label: "日 (1日)" },
] as const;

export function PeriodSwitch({ current }: { current: string }) {
  const pathname = usePathname();
  const params = useSearchParams();

  function href(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("period", value);
    return `${pathname}?${next.toString()}`;
  }

  return (
    <div className="period-switch" role="group" aria-label="期間">
      {PERIODS.map((p) => (
        <Link key={p.value} href={href(p.value)} className={p.value === current ? "is-active" : ""} prefetch={false} style={{ display: "inline-block" }}>
          <button className={p.value === current ? "is-active" : ""} type="button">{p.label}</button>
        </Link>
      ))}
    </div>
  );
}
