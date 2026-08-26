import type { APIRoute } from "astro";

// Until IS_PRODUCTION is set, this build is a preview served from a developer's
// machine over a tunnel and must not be crawled at all.
//
// The noindex meta tag on every page is not enough on its own. It only asks a
// crawler not to *index* what it has already fetched, and only once the page
// has been downloaded and parsed. This refuses the fetch, covers images and
// PDFs that have no meta tag to carry, and applies to crawlers that never look
// at the HTML.
//
// Worth knowing: a preview subdomain is not private. Issuing its certificate
// publishes the hostname in the public Certificate Transparency logs, and
// there are bots that read those logs and crawl new names within minutes. A
// tunnel URL nobody was given can still be found this way.

export const GET: APIRoute = () => {
  const body = __IS_PRODUCTION__
    ? ["User-agent: *", "Disallow: /admin/", ""].join("\n")
    : ["# Preview build. Not for indexing.", "User-agent: *", "Disallow: /", ""].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
};
