// Password gate in front of /admin on Cloudflare Pages.
//
// This runs on Cloudflare's edge, before any admin file is served, so the
// check cannot be bypassed by reading the page source. Credentials live in
// environment variables, never in the repository.
//
// Set these in the Pages project settings:
//   ADMIN_USERS   jackie:<sha256 of password>,debug:<sha256 of password>
//   ADMIN_SECRET  a long random string used to sign the session cookie
//
// Generate a password hash with:
//   printf '%s' 'the-password' | sha256sum
//
// Local `astro dev` does not run Functions, so the admin is open locally.
// To exercise this gate, run `npx wrangler pages dev dist`.

const COOKIE = "pt_admin";
const MAX_AGE = 60 * 60 * 12;

const encoder = new TextEncoder();

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Comparing byte by byte over the full length, so a wrong password cannot be
// narrowed down by timing the response.
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseUsers(raw) {
  return (raw || "")
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const at = pair.indexOf(":");
      return { user: pair.slice(0, at).trim(), hash: pair.slice(at + 1).trim().toLowerCase() };
    });
}

function loginPage(message) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Sign in | Peachtown</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
    background:#0b2116; color:#f5f1e6;
    font-family: system-ui, -apple-system, sans-serif; }
  form { width:min(100% - 2.5rem, 22rem); }
  h1 { font-size:1.5rem; margin:0 0 .25rem; }
  p.sub { margin:0 0 1.5rem; color:#b6c4ba; font-size:.95rem; }
  label { display:block; font-size:.8rem; letter-spacing:.08em;
    text-transform:uppercase; margin-bottom:.35rem; color:#b6c4ba; }
  input { width:100%; padding:.7rem .8rem; margin-bottom:1rem; font-size:1rem;
    font-family:inherit; border:1px solid #2e5540; border-radius:2px;
    background:#f5f1e6; color:#14231a; }
  button { width:100%; padding:.75rem 1rem; font-size:1rem; font-weight:700;
    font-family:inherit; cursor:pointer; border:2px solid #c8791f;
    border-radius:2px; background:#c8791f; color:#0b2116; }
  button:hover { background:#e8a24a; border-color:#e8a24a; }
  .error { background:#3a1d14; border-left:3px solid #e8a24a;
    padding:.6rem .8rem; margin-bottom:1rem; font-size:.9rem; }
  a { color:#e8a24a; font-size:.85rem; }
  :focus-visible { outline:3px solid #e8a24a; outline-offset:2px; }
</style>
</head><body>
<form method="post">
  <h1>Peachtown site editor</h1>
  <p class="sub">Sign in to edit the website.</p>
  ${message ? `<p class="error">${message}</p>` : ""}
  <label for="u">Username</label>
  <input id="u" name="username" autocomplete="username" required autofocus>
  <label for="p">Password</label>
  <input id="p" name="password" type="password" autocomplete="current-password" required>
  <button type="submit">Sign in</button>
  <p><a href="/">Back to the website</a></p>
</form>
</body></html>`;
}

function htmlResponse(body, status, headers = {}) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const users = parseUsers(env.ADMIN_USERS);
  const secret = env.ADMIN_SECRET;

  // With nothing configured the gate stays shut rather than failing open.
  if (users.length === 0 || !secret) {
    return htmlResponse(
      loginPage("The editor is not configured yet. Set ADMIN_USERS and ADMIN_SECRET."),
      503
    );
  }

  if (request.method === "POST") {
    const form = await request.formData();
    const username = String(form.get("username") || "").trim();
    const password = String(form.get("password") || "");
    const match = users.find((u) => u.user === username);
    const hash = await sha256Hex(password);

    if (!match || !safeEqual(hash, match.hash)) {
      return htmlResponse(loginPage("That username or password is not right."), 401);
    }

    const expires = Date.now() + MAX_AGE * 1000;
    const payload = `${username}.${expires}`;
    const token = `${payload}.${await sign(payload, secret)}`;

    return new Response(null, {
      status: 303,
      headers: {
        location: new URL(request.url).pathname,
        "set-cookie":
          `${COOKIE}=${encodeURIComponent(token)}; Path=/admin; HttpOnly; Secure; ` +
          `SameSite=Lax; Max-Age=${MAX_AGE}`,
      },
    });
  }

  const cookies = request.headers.get("cookie") || "";
  const raw = cookies
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`));

  if (raw) {
    const token = decodeURIComponent(raw.slice(COOKIE.length + 1));
    const at = token.lastIndexOf(".");
    const payload = token.slice(0, at);
    const provided = token.slice(at + 1);
    const [username, expires] = payload.split(".");

    const expected = await sign(payload, secret);
    const live = Number(expires) > Date.now();
    const known = users.some((u) => u.user === username);

    if (live && known && safeEqual(provided, expected)) return next();
  }

  return htmlResponse(loginPage(""), 401);
}
