// Serves the CMS config with backend.base_url set to the address the editor
// was actually opened on.
//
// Decap builds its login URL as `${base_url}/${auth_endpoint}`, so base_url
// has to be an absolute origin. Baking one in at build time would mean the
// editor only worked on whichever domain was current when the site was built,
// and this project deliberately keeps the domain out of everything except
// SITE_URL. Reading it off the request instead means the editor works on
// peachtown.pages.dev today and on the real domain after the cutover with no
// rebuild and nothing to remember.
//
// Functions take precedence over static assets on Pages, so this shadows
// public/admin/config.yml. env.ASSETS reads that file directly, bypassing the
// Functions router, so this does not call itself.
//
// Note the GitHub OAuth app still pins its own callback host, so the domain
// is not free of configuration entirely. See docs/deployment.md.

const PLACEHOLDER = /^(\s*)base_url:.*$/m;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const source = await env.ASSETS.fetch(new URL("/admin/config.yml", url));
  if (!source.ok) {
    return new Response("The CMS config could not be read.", { status: 500 });
  }
  const text = await source.text();

  // Cloudflare terminates TLS and forwards the original scheme in a header.
  // Trusting url.protocol here would hand Decap an http:// origin on an
  // https:// page, which the browser blocks as mixed content.
  const proto = (request.headers.get("x-forwarded-proto") || url.protocol.replace(":", ""))
    .split(",")[0]
    .trim();

  const body = text.replace(PLACEHOLDER, `$1base_url: ${proto}://${url.host}`);

  return new Response(body, {
    headers: { "content-type": "text/yaml; charset=utf-8", "cache-control": "no-store" },
  });
}
