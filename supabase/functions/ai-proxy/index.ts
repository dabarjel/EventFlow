// Thin authenticated pass-through to Anthropic / OpenAI. Holds the org's real API
// keys server-side (Supabase secrets) so they never reach the browser. Callers must
// present a valid Supabase user session — the platform's default JWT check alone is
// not enough, since the public anon key is itself a structurally valid JWT.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const UPSTREAM_URL: Record<string, string> = {
  anthropic: "https://api.anthropic.com/v1/messages",
  openai: "https://api.openai.com/v1/images/generations",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing Authorization header" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return json({ error: "Not authenticated" }, 401);

  let body: { provider?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { provider, payload } = body;
  if (provider !== "anthropic" && provider !== "openai") {
    return json({ error: "provider must be 'anthropic' or 'openai'" }, 400);
  }
  if (!payload || typeof payload !== "object") {
    return json({ error: "Missing payload" }, 400);
  }

  const upstreamHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (provider === "anthropic") {
    upstreamHeaders["x-api-key"] = ANTHROPIC_API_KEY;
    upstreamHeaders["anthropic-version"] = "2023-06-01";
  } else {
    upstreamHeaders["Authorization"] = `Bearer ${OPENAI_API_KEY}`;
  }

  const upstreamResp = await fetch(UPSTREAM_URL[provider], {
    method: "POST",
    headers: upstreamHeaders,
    body: JSON.stringify(payload),
  });

  const respBody = await upstreamResp.text();
  return new Response(respBody, {
    status: upstreamResp.status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
});
