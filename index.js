export default {
  async fetch(request, env, ctx) {
    const primaryBackend = 'https://cpranking.linkscdn.net';
    const backupBackend = 'https://cpranking.linkscdn.net';
    const originalUrl = new URL(request.url);
    const tryBackends = [primaryBackend, backupBackend];

    for (let backend of tryBackends) {
      const backendUrl = new URL(backend);
      backendUrl.pathname = originalUrl.pathname;
      backendUrl.search = originalUrl.search;

      const newHeaders = new Headers(request.headers);
      newHeaders.set('Host', backendUrl.hostname);
      newHeaders.delete('cf-connecting-ip');
      newHeaders.delete('cf-ipcountry');
      newHeaders.delete('cf-ray');
      newHeaders.delete('x-forwarded-for');
      newHeaders.delete('x-real-ip');

      const backendRequest = new Request(backendUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        body: request.body,
        redirect: 'follow',
        cf: { cacheEverything: false, scrapeShield: false, apps: false }
      });

      try {
        const backendResponse = await fetch(backendRequest);
        //if (!backendResponse.ok) throw new Error('Backend responded with status: ' + backendResponse.status);

        const responseHeaders = new Headers(backendResponse.headers);
        responseHeaders.delete('Server');
        responseHeaders.delete('X-Powered-By');
        responseHeaders.delete('Via');
        responseHeaders.set('X-Worker-Proxy', 'Cloudflare Stealth Proxy');
        responseHeaders.set('X-Used-Backend', backendUrl.hostname);

        // Log full client IP
        ctx.waitUntil(logEvent(originalUrl.pathname, backendUrl.hostname, request.headers.get('cf-connecting-ip')));

        return new Response(backendResponse.body, {
          status: backendResponse.status,
          headers: responseHeaders
        });

      } catch (err) {
        // Try next backend
      }
    }

    return new Response('All backends failed.', { status: 502 });
  }
}

// Simple logging function (full IP)
async function logEvent(path, backendUsed, clientIp) {
  console.log(`[${new Date().toISOString()}] Path: ${path}, Backend: ${backendUsed}, ClientIP: ${clientIp || 'unknown'}`);
}