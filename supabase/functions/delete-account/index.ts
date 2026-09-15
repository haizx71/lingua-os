import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
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
  try {
    const body = (await request.json()) as { confirmationEmail?: unknown };
    confirmationEmail = typeof body.confirmationEmail === "string"
      ? body.confirmationEmail.trim().toLowerCase()
      : "";
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  if (confirmationEmail !== user.email.trim().toLowerCase()) {
    return json({ error: "confirmation_mismatch" }, 400);
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
