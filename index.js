export default {
  async fetch(request, env, ctx) {
    // Backend URLs (HTTPS)
    const primaryBackend = 'https://me.camarketscn.net';
    const backupBackend = 'https://me.camarketscn.net';
    const originalUrl = new URL(request.url);
    const workerOrigin = originalUrl.origin; // dynamically capture requested Worker domain
    const tryBackends = [primaryBackend, backupBackend];

    for (let backend of tryBackends) {
      const backendUrl = new URL(backend);
      backendUrl.pathname = originalUrl.pathname;
      backendUrl.search = originalUrl.search;

      const newHeaders = new Headers(request.headers);
      newHeaders.set('Host', backendUrl.hostname);
      // Remove sensitive headers
      newHeaders.delete('cf-connecting-ip');
      newHeaders.delete('cf-ipcountry');
      newHeaders.delete('cf-ray');
      newHeaders.delete('x-forwarded-for');
      newHeaders.delete('x-real-ip');

      const backendRequest = new Request(backendUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        body: request.body,
        redirect: 'manual', // manual redirect handling
        cf: { cacheEverything: true, cacheTtl: 3600 }, // cache all content for 1 hour
      });

      try {
        const backendResponse = await fetch(backendRequest);
        const responseHeaders = new Headers(backendResponse.headers);

        // Remove identifying headers
        responseHeaders.delete('Server');
        responseHeaders.delete('X-Powered-By');
        responseHeaders.delete('Via');

        // Custom headers
        responseHeaders.set('X-Worker-Proxy', 'Cloudflare Stealth Proxy');
        responseHeaders.set('X-Used-Backend', backendUrl.hostname);

        // 🔹 Rewrite redirects to use Worker origin
        if (responseHeaders.has("Location")) {
          let loc = responseHeaders.get("Location");
          loc = loc.replace(backendUrl.origin, workerOrigin);
          responseHeaders.set("Location", loc);
        }

        const ct = responseHeaders.get("content-type") || "";

        // 🔹 Rewrite content for HTML, CSS, JS, JSON, XML
        if (
          ct.includes("text/html") ||
          ct.includes("text/css") ||
          ct.includes("application/javascript") ||
          ct.includes("application/json") ||
          ct.includes("application/xml") ||
          ct.includes("text/xml")
        ) {
          let text = await backendResponse.text();
          // Replace backend origin with Worker origin
          text = text.replaceAll(backendUrl.origin, workerOrigin);
          return new Response(text, {
            status: backendResponse.status,
            headers: responseHeaders,
          });
        }

        // 🔹 Stream other content (images, fonts, etc.) without modification
        return new Response(backendResponse.body, {
          status: backendResponse.status,
          headers: responseHeaders,
        });

      } catch (err) {
        // Try next backend if this one fails
      }
    }

    return new Response('All backends failed.', { status: 5
