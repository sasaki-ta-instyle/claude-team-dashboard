import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "ctd_session";
const SESSION_DAYS = 7;

function getSecretKey(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET must be set (>=16 chars). Generate: openssl rand -hex 32");
  }
  return new TextEncoder().encode(s);
}

export interface Session {
  user: string; // 共通パスワード認証では固定値 "admin"
  iat: number;
  exp: number;
}

export async function createSessionToken(user: string): Promise<string> {
  return await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.sub || !payload.exp || !payload.iat) return null;
    return { user: payload.sub, iat: payload.iat, exp: payload.exp };
  } catch {
    return null;
  }
}

export async function getSession(req: NextRequest): Promise<Session | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/claude-team-dashboard",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/claude-team-dashboard",
    maxAge: 0,
  });
}

export { COOKIE_NAME };
