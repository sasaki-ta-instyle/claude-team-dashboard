const ADMIN_BASE = "https://api.anthropic.com";
const API_VERSION = "2023-06-01";

function getAdminKey(): string {
  const key = process.env.ANTHROPIC_ADMIN_API_KEY;
  if (!key) throw new Error("ANTHROPIC_ADMIN_API_KEY is not set");
  return key;
}

async function adminFetch<T>(pathname: string, query?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(pathname, ADMIN_BASE);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== "") url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      "x-api-key": getAdminKey(),
      "anthropic-version": API_VERSION,
      "User-Agent": "claude-team-dashboard/0.1 (https://app.instyle.group/claude-team-dashboard/)",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic Admin API ${res.status} ${res.statusText}: ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

// ===== Organization Members =====

export interface OrgMember {
  email: string;
  role?: string;
  added_at?: string;
  // seat 種別が API レスポンスに含まれるかは未確認。含まれていれば自動取得に切り替える
  seat?: "premium" | "standard" | null;
  raw: Record<string, unknown>;
}

type RawMember = {
  email?: string;
  email_address?: string;
  role?: string;
  added_at?: string;
  created_at?: string;
  seat?: string;
  seat_type?: string;
  subscription_seat_type?: string;
} & Record<string, unknown>;

interface MembersResponse {
  data: RawMember[];
  has_more?: boolean;
  next_page?: string | null;
}

export async function fetchAllMembers(): Promise<OrgMember[]> {
  const out: OrgMember[] = [];
  let page: string | undefined;
  for (let i = 0; i < 100; i++) {
    const res = await adminFetch<MembersResponse>("/v1/organizations/users", {
      limit: "100",
      page,
    });
    for (const m of res.data || []) {
      const email = (m.email ?? m.email_address ?? "").toString();
      if (!email) continue;
      const seatRaw = (m.seat ?? m.seat_type ?? m.subscription_seat_type ?? "")
        .toString()
        .toLowerCase();
      const seat: OrgMember["seat"] =
        seatRaw === "premium" ? "premium" : seatRaw === "standard" ? "standard" : null;
      out.push({
        email,
        role: m.role,
        added_at: (m.added_at ?? m.created_at) as string | undefined,
        seat,
        raw: m,
      });
    }
    if (!res.has_more || !res.next_page) break;
    page = res.next_page;
  }
  return out;
}

// ===== Claude Code Usage Report =====

export interface ClaudeCodeActor {
  type: "user_actor" | "api_actor";
  email_address?: string;
  api_key_name?: string;
}

export interface ClaudeCodeModelBreakdown {
  model: string;
  tokens: {
    input: number;
    output: number;
    cache_read: number;
    cache_creation: number;
  };
  estimated_cost: { amount: number; currency: string };
}

export interface ClaudeCodeRecord {
  date: string;
  actor: ClaudeCodeActor;
  organization_id: string;
  customer_type: "api" | "subscription";
  subscription_type?: "team" | "enterprise" | null;
  terminal_type?: string;
  core_metrics: {
    num_sessions: number;
    lines_of_code: { added: number; removed: number };
    commits_by_claude_code: number;
    pull_requests_by_claude_code: number;
  };
  tool_actions: Record<string, { accepted: number; rejected: number }>;
  model_breakdown: ClaudeCodeModelBreakdown[];
}

interface ClaudeCodeResponse {
  data: ClaudeCodeRecord[];
  has_more?: boolean;
  next_page?: string | null;
}

export async function fetchClaudeCodeUsage(date: string): Promise<ClaudeCodeRecord[]> {
  const out: ClaudeCodeRecord[] = [];
  let page: string | undefined;
  for (let i = 0; i < 100; i++) {
    const res = await adminFetch<ClaudeCodeResponse>("/v1/organizations/usage_report/claude_code", {
      starting_at: date,
      limit: "1000",
      page,
    });
    for (const r of res.data || []) out.push(r);
    if (!res.has_more || !res.next_page) break;
    page = res.next_page;
  }
  return out;
}
