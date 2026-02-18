// v1
export default {
  async fetch(request, env, ctx) {
    // Get real client IP from the Worker request
    const clientIP = request.headers.get("CF-Connecting-IP");

    // Backend URLs (HTTPS)
    const primaryBackend = 'https://crm.linkscdn.net';
    const backupBackend = 'https://crm.linkscdn.net';
    const originalUrl = new URL(request.url);
    const workerOrigin = originalUrl.origin; // dynamically capture requested Worker domain
    const tryBackends = [primaryBackend, backupBackend];

    for (let backend of tryBackends) {
      const backendUrl = new URL(backend);
      backendUrl.pathname = originalUrl.pathname;
      backendUrl.search = originalUrl.search;

      const newHeaders = new Headers(request.headers);
      newHeaders.set('Host', backendUrl.hostname);

      // Remove CF internal headers
      newHeaders.delete('cf-connecting-ip');
      newHeaders.delete('cf-ipcountry');
      newHeaders.delete('cf-ray');

      // Remove any previous proxy-generated IP headers
      newHeaders.delete('x-forwarded-for');
      newHeaders.delete('x-real-ip');

      // 🔹 Inject true client IP (Worker cannot override CF-Connecting-IP,
      //    but origin can use these safely)
      newHeaders.set('X-Real-IP', clientIP);
      newHeaders.set('X-Forwarded-For', clientIP);

      const backendRequest = new Request(backendUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        body: request.body,
        redirect: 'manual', // manual redirect handling

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

    return new Response('All backends failed.', { status: 502 });
  }
};
//v2
// export default {
//   async fetch(request) {

//     const backend = "https://crm.linkscdn.net";
//     const url = new URL(request.url);
//     const backendUrl = new URL(backend);

//     backendUrl.pathname = url.pathname;
//     backendUrl.search = url.search;
//     const clientIP = request.headers.get("CF-Connecting-IP");
//     const headers = new Headers(request.headers);
//     headers.delete("x-forwarded-for");
//     headers.delete("x-real-ip");
    
//    // headers.set("CF-Connecting-IP", clientIP);
//     headers.set("X-Forwarded-For", clientIP);
//     headers.set("X-Real-IP", clientIP);

//     // Preserve original host context
//     headers.set("Host", backendUrl.hostname);
//     headers.set("X-Forwarded-Host", url.hostname);
//     headers.set("X-Forwarded-Proto", "https");

//     // DO NOT delete cookies
//     // DO NOT modify body
//     // DO NOT cache login endpoints

//     const response = await fetch(backendUrl.toString(), {
//       method: request.method,
//       headers,
//       body: request.body,
//       redirect: "manual"
//     });

//     const responseHeaders = new Headers(response.headers);

//     // Rewrite redirect location only
//     if (responseHeaders.has("Location")) {
//       let loc = responseHeaders.get("Location");
//       if (loc.startsWith(backend)) {
//         loc = loc.replace(backend, url.origin);
//         responseHeaders.set("Location", loc);
//       }
//     }

//     return new Response(response.body, {
//       status: response.status,
//       headers: responseHeaders
//     });
//   }
// };

