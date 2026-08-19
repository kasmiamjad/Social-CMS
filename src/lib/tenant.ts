/**
 * All logins share one CRM dataset — data is scoped by this fixed tenant id
 * rather than by whichever real Supabase Auth user is currently logged in.
 * Session auth (resolveUserId / auth.getUser()) still gates access; this only
 * decides which rows are read/written.
 */
export function getTenantId(): string {
  const id = process.env.TENANT_ID;
  if (!id) throw new Error("TENANT_ID env var is not set");
  return id;
}
