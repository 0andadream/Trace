import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";

const COOKIE = "trace_user";
const als = new AsyncLocalStorage<{ tenant: string }>();

export function currentTenant() {
  return als.getStore()?.tenant || process.env.SIBYL_TENANT || "trace-alex";
}

export function withTenant<T>(tenant: string, fn: () => T): T {
  return als.run({ tenant }, fn);
}

export async function tenantFromCookie() {
  const id = (await cookies()).get(COOKIE)?.value;
  return id ? `user-${id}` : currentTenant();
}

export async function withRequestTenant<T>(fn: () => Promise<T>): Promise<T> {
  const tenant = await tenantFromCookie();
  return withTenant(tenant, fn);
}
