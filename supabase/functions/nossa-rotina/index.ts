import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const FUNCTION_SLUG = "nossa-rotina";
const GITHUB_BASE = "https://raw.githubusercontent.com/JonathanCosta23/couple-milestone-planner-a38bd5a6/main/nossa-rotina/";
const SUPABASE_UMD = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js";

let bundlePromise: Promise<string> | null = null;

function escapeClosingTag(source: string, tag: string): string {
  return source.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Nossa-Rotina-Supabase-Host" },
  });
  if (!response.ok) throw new Error(`Falha ao carregar ${url}: ${response.status}`);
  return await response.text();
}

async function buildBundle(): Promise<string> {
  const [indexHtml, styles, appJs, supabaseJs] = await Promise.all([
    fetchText(`${GITHUB_BASE}index.html`),
    fetchText(`${GITHUB_BASE}styles.css`),
    fetchText(`${GITHUB_BASE}app.js`),
    fetchText(SUPABASE_UMD),
  ]);

  const nonce = crypto.randomUUID().replaceAll("-", "");
  let html = indexHtml
    .replace(/\s*<link[^>]+rel=["']manifest["'][^>]*>/gi, "")
    .replace(/\s*<link[^>]+href=["']\.\/styles\.css["'][^>]*>/gi, "")
    .replace(/\s*<script[^>]+src=["']https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js[^"']*["'][^>]*><\/script>/gi, "")
    .replace(/\s*<script[^>]+src=["']\.\/app\.js["'][^>]*><\/script>/gi, "");

  html = html.replace(
    "</head>",
    `<meta name="nossa-rotina-build" content="edge-inline-v3" /><style nonce="${nonce}">${escapeClosingTag(styles, "style")}</style></head>`,
  );

  html = html.replace(
    "</body>",
    `<script nonce="${nonce}">${escapeClosingTag(supabaseJs, "script")}</script><script nonce="${nonce}">${escapeClosingTag(appJs, "script")}</script></body>`,
  );

  return JSON.stringify({ html, nonce });
}

async function getBundle(): Promise<{ html: string; nonce: string }> {
  bundlePromise ??= buildBundle();
  try {
    return JSON.parse(await bundlePromise);
  } catch (error) {
    bundlePromise = null;
    throw error;
  }
}

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);

  if (url.searchParams.get("health") === "1") {
    return Response.json(
      { ok: true, service: FUNCTION_SLUG, version: 3, delivery: "single-html" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Método não permitido", { status: 405 });
  }

  try {
    const { html, nonce } = await getBundle();
    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self' https://ytuzerdwjffqgzltjnoo.supabase.co wss://ytuzerdwjffqgzltjnoo.supabase.co; img-src data:; font-src data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
    });
    return new Response(request.method === "HEAD" ? null : html, { status: 200, headers });
  } catch (error) {
    console.error("Nossa Rotina bundle error", error);
    return new Response(
      "Não foi possível carregar o aplicativo. Recarregue a página.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } },
    );
  }
});
