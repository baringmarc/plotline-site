// CORS and JSON helpers for the public Edge Functions. Set ALLOWED_ORIGIN to the site's origin in
// production; it falls back to '*' for local development.

function allowedOrigin(): string {
  const deno = (globalThis as { Deno?: { env: { get(key: string): string | undefined } } }).Deno
  return deno?.env.get('ALLOWED_ORIGIN') ?? '*'
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  })
}

export function preflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405)
  return null
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}
