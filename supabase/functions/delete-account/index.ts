import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const MAX_REQUEST_BYTES = 4096;
const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function defaultKey(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.default ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  // Account deletion is intentionally server-to-server only. Browser traffic
  // must use the same-origin Next.js route, so this function exposes no CORS
  // surface and cannot be invoked directly by a hostile website.
  if (request.headers.has("Origin")) {
    return json({ error: "browser_direct_call_forbidden" }, 403);
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json({ error: "unsupported_media_type" }, 415);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    defaultKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")) ??
    Deno.env.get("SUPABASE_ANON_KEY") ??
    null;
  const secretKey =
    defaultKey(Deno.env.get("SUPABASE_SECRET_KEYS")) ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    null;

  if (!supabaseUrl || !publishableKey || !secretKey) {
    return json({ error: "server_configuration_error" }, 500);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const user = userData.user;
  if (userError || !user?.id || !user.email) {
    return json({ error: "unauthorized" }, 401);
  }

  let confirmationEmail = "";
  let currentPassword = "";
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return json({ error: "request_too_large" }, 413);
    }

    const body = JSON.parse(rawBody) as {
      confirmationEmail?: unknown;
      currentPassword?: unknown;
    };
    confirmationEmail = typeof body.confirmationEmail === "string"
      ? body.confirmationEmail.trim().toLowerCase()
      : "";
    currentPassword = typeof body.currentPassword === "string"
      ? body.currentPassword
      : "";
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  if (
    !confirmationEmail ||
    confirmationEmail.length > MAX_EMAIL_LENGTH ||
    confirmationEmail !== user.email.trim().toLowerCase()
  ) {
    return json({ error: "confirmation_mismatch" }, 400);
  }
  if (!currentPassword || currentPassword.length > MAX_PASSWORD_LENGTH) {
    return json({ error: "recent_authentication_required" }, 403);
  }

  // A valid access token alone is not sufficient for a destructive action.
  // Reauthenticate the same identity with its current password immediately
  // before revoking sessions and deleting the account.
  const reauthClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: reauthData, error: reauthError } = await reauthClient.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError || reauthData.user?.id !== user.id) {
    return json({ error: "recent_authentication_required" }, 403);
  }

  const { error: signOutError } = await userClient.auth.signOut({ scope: "global" });
  if (signOutError) {
    console.error("delete-account session revocation failed", signOutError.message);
    return json({ error: "session_revoke_failed" }, 500);
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("delete-account failed", deleteError.message);
    return json({ error: "delete_failed" }, 500);
  }

  return json({ deleted: true });
});
