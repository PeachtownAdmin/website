// Finishes the GitHub sign in for the CMS and hands the token to Decap.
//
// GitHub sends the browser here with a one time code. This swaps that code for
// an access token using the client secret, which never leaves the server, then
// closes the loop with the handshake Decap listens for:
//
//   popup  -> opener   "authorizing:github"
//   opener -> popup    (any reply, which is how the popup learns the origin)
//   popup  -> opener   "authorization:github:success:{json}"
//
// The token is passed to the opener and never stored anywhere by us. Decap
// keeps it in the browser from then on.
//
// The redirect_uri sent here must match the one functions/auth.js sent, and
// both must match the callback URL registered on the GitHub OAuth app.

const STATE_COOKIE = "pt_oauth_state";

const CLEAR_STATE = `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

function readCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  const hit = raw
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
}

// The payload goes inside a <script> block, so the one sequence that could
// break out of it is neutralised. JSON.stringify handles quotes and newlines.
function embed(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function handshake(status, payload) {
  const body = `<!doctype html>
<meta charset="utf-8">
<title>Signing in</title>
<p style="font:16px/1.5 system-ui,sans-serif;padding:2rem">Signing in to the editor...</p>
<script>
(function () {
  var message = "authorization:github:${status}:" + ${embed(JSON.stringify(payload))};
  function receive(e) {
    window.removeEventListener("message", receive, false);
    window.opener.postMessage(message, e.origin);
  }
  if (!window.opener) {
    document.body.textContent =
      "This page was not opened by the editor. Close it and sign in from /admin/ again.";
    return;
  }
  window.addEventListener("message", receive, false);
  window.opener.postMessage("authorizing:github", "*");
})();
</script>`;

  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "set-cookie": CLEAR_STATE,
    },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return handshake("error", { message: "The editor's GitHub connection is not configured." });
  }

  const denied = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (denied) {
    return handshake("error", { message: String(denied) });
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return handshake("error", { message: "GitHub did not send an authorisation code." });
  }

  const state = url.searchParams.get("state");
  const expected = readCookie(request, STATE_COOKIE);
  if (!state || !expected || state !== expected) {
    return handshake("error", {
      message: "This sign in did not start on this site, or it took too long. Try again.",
    });
  }

  const proto = (request.headers.get("x-forwarded-proto") || url.protocol.replace(":", ""))
    .split(",")[0]
    .trim();

  let token;
  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${proto}://${url.host}/callback`,
      }),
    });
    const data = await res.json();
    // GitHub answers 200 with an error body rather than an error status.
    if (data.error) {
      return handshake("error", { message: data.error_description || data.error });
    }
    token = data.access_token;
  } catch (err) {
    return handshake("error", { message: "GitHub could not be reached to complete sign in." });
  }

  if (!token) {
    return handshake("error", { message: "GitHub did not return an access token." });
  }

  return handshake("success", { token, provider: "github" });
}
