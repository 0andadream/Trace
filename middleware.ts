import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "trace_user";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get(COOKIE)?.value) {
    res.cookies.set(COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|png|svg)$).*)"],
};
