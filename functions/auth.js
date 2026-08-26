// Starts the GitHub sign in for the CMS.
//
// Decap's github backend has no credentials of its own. It opens a popup at
// `${base_url}/${auth_endpoint}` and waits for that window to hand back an
// access token. This is that endpoint. The matching half is functions/callback.js.
//
// Hosting it here rather than on a separate Cloudflare Worker means one
// deployment, one set of secrets, and an origin that always matches the site
// the editor was opened from.
//
// Set in the Pages project settings, as encrypted secrets:
//   GITHUB_CLIENT_ID      from the GitHub OAuth app
//   GITHUB_CLIENT_SECRET  from the GitHub OAuth app
//
// This route is deliberately not behind the /admin password gate: the popup is
// a fresh window and the session cookie is scoped to /admin. It is not a hole.
// Reaching GitHub proves nothing on its own; the token GitHub issues is only
// useful to an account that already has write access to the repository.

const STATE_COOKIE = "pt_oauth_state";

// Decap asks for "repo" so it can write to a private repository. Anything
// outside this list is a malformed or tampered request, not a wider grant.
const ALLOWED_SCOPES = new Set(["repo", "public_repo"]);

function errorPage(message) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Sign in failed</title>` +
      `<p style="font:16px/1.5 system-ui,sans-serif;padding:2rem">${message}</p>`,
    { status: 500, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return errorPage(
      "The editor's GitHub connection is not configured. " +
        "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are missing from the Pages project settings."
    );
  }

  const requested = url.searchParams.get("scope") || "repo";
  const scope = ALLOWED_SCOPES.has(requested) ? requested : "repo";

  // Signed into a cookie and checked on the way back, so a callback that was
  // not started from this site is refused.
  const state = crypto.randomUUID().replace(/-/g, "");

  const proto = (request.headers.get("x-forwarded-proto") || url.protocol.replace(":", ""))
    .split(",")[0]
    .trim();
  const origin = `${proto}://${url.host}`;

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${origin}/callback`);
  authorize.searchParams.set("scope", scope);
  authorize.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      "cache-control": "no-store",
      "set-cookie":
        `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}
