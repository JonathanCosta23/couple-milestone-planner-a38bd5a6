import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const FUNCTION_PATH = "/functions/v1/nossa-rotina";
const GITHUB_BASE =
  "https://raw.githubusercontent.com/JonathanCosta23/couple-milestone-planner-a38bd5a6/main/nossa-rotina/";

const files: Record<string, string> = {
  "index.html": "text/html; charset=utf-8",
  "styles.css": "text/css; charset=utf-8",
  "app.js": "application/javascript; charset=utf-8",
  "manifest.webmanifest": "application/manifest+json; charset=utf-8",
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      },
    });
  }

  const url = new URL(request.url);

  if (url.searchParams.get("health") === "1") {
    return Response.json(
      { ok: true, service: "nossa-rotina" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const markerIndex = url.pathname.indexOf(FUNCTION_PATH);
  let path = markerIndex >= 0
    ? url.pathname.slice(markerIndex + FUNCTION_PATH.length).replace(/^\/+/, "")
    : "";

  if (!path) path = "index.html";
  if (!(path in files)) {
    return new Response("Arquivo não encontrado", { status: 404 });
  }

  try {
    const upstream = await fetch(`${GITHUB_BASE}${path}`, {
      headers: { "User-Agent": "Nossa-Rotina-Supabase-Host" },
    });

    if (!upstream.ok) {
      return new Response("Aplicativo temporariamente indisponível", {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      });
    }

    let body: BodyInit;
    if (path === "index.html") {
      const html = await upstream.text();
      const baseUrl = `${url.origin}${FUNCTION_PATH}/`;
      body = html.replace("<head>", `<head><base href="${baseUrl}">`);
    } else {
      body = await upstream.arrayBuffer();
    }

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": files[path],
        "Cache-Control": path === "index.html"
          ? "no-store"
          : "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https://ytuzerdwjffqgzltjnoo.supabase.co wss://ytuzerdwjffqgzltjnoo.supabase.co; img-src 'self' data:; font-src 'self' data:; base-uri 'self'; frame-ancestors 'none'",
      },
    });
  } catch (error) {
    console.error("Static host error", error);
    return new Response("Erro ao carregar o aplicativo", {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
});
