// export default {
//   async fetch(request, env, ctx) {
//     // Get real client IP from the Worker request
//     const clientIP = request.headers.get("CF-Connecting-IP");

//     // Backend URLs (HTTPS)
//     const primaryBackend = 'https://crm.linkscdn.net';
//     const backupBackend = 'https://crm.linkscdn.net';
//     const originalUrl = new URL(request.url);
//     const workerOrigin = originalUrl.origin; // dynamically capture requested Worker domain
//     const tryBackends = [primaryBackend, backupBackend];

//     for (let backend of tryBackends) {
//       const backendUrl = new URL(backend);
//       backendUrl.pathname = originalUrl.pathname;
//       backendUrl.search = originalUrl.search;

//       const newHeaders = new Headers(request.headers);
//       newHeaders.set('Host', backendUrl.hostname);

//       // Remove CF internal headers
//       newHeaders.delete('cf-connecting-ip');
//       newHeaders.delete('cf-ipcountry');
//       newHeaders.delete('cf-ray');

//       // Remove any previous proxy-generated IP headers
//       newHeaders.delete('x-forwarded-for');
//       newHeaders.delete('x-real-ip');

//       // 🔹 Inject true client IP (Worker cannot override CF-Connecting-IP,
//       //    but origin can use these safely)
//       newHeaders.set('X-Real-IP', clientIP);
//       newHeaders.set('X-Forwarded-For', clientIP);

//       const backendRequest = new Request(backendUrl.toString(), {
//         method: request.method,
//         headers: newHeaders,
//         body: request.body,
//         redirect: 'manual', // manual redirect handling
//         cf: { cacheEverything: true, cacheTtl: 3600 }, // cache all content for 1 hour
//       });

//       try {
//         const backendResponse = await fetch(backendRequest);
//         const responseHeaders = new Headers(backendResponse.headers);

//         // Remove identifying headers
//         responseHeaders.delete('Server');
//         responseHeaders.delete('X-Powered-By');
//         responseHeaders.delete('Via');

//         // Custom headers
//         responseHeaders.set('X-Worker-Proxy', 'Cloudflare Stealth Proxy');
//         responseHeaders.set('X-Used-Backend', backendUrl.hostname);

//         // 🔹 Rewrite redirects to use Worker origin
//         if (responseHeaders.has("Location")) {
//           let loc = responseHeaders.get("Location");
//           loc = loc.replace(backendUrl.origin, workerOrigin);
//           responseHeaders.set("Location", loc);
//         }

//         const ct = responseHeaders.get("content-type") || "";

//         // 🔹 Rewrite content for HTML, CSS, JS, JSON, XML
//         if (
//           ct.includes("text/html") ||
//           ct.includes("text/css") ||
//           ct.includes("application/javascript") ||
//           ct.includes("application/json") ||
//           ct.includes("application/xml") ||
//           ct.includes("text/xml")
//         ) {
//           let text = await backendResponse.text();
//           // Replace backend origin with Worker origin
//           text = text.replaceAll(backendUrl.origin, workerOrigin);
//           return new Response(text, {
//             status: backendResponse.status,
//             headers: responseHeaders,
//           });
//         }

//         // 🔹 Stream other content (images, fonts, etc.) without modification
//         return new Response(backendResponse.body, {
//           status: backendResponse.status,
//           headers: responseHeaders,
//         });

//       } catch (err) {
//         // Try next backend if this one fails
//       }
//     }

//     return new Response('All backends failed.', { status: 502 });
//   }
// };

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

export default {
  async fetch(request) {

    const backend = "https://crm.linkscdn.net";
    const url = new URL(request.url);
    const backendUrl = new URL(backend);

    backendUrl.pathname = url.pathname;
    backendUrl.search = url.search;

    // --- REAL CLIENT IP ---
    const clientIP = request.headers.get("CF-Connecting-IP") || "";

    const headers = new Headers(request.headers);

    // Remove hop-by-hop headers (RFC 7230)
    headers.delete("connection");
    headers.delete("keep-alive");
    headers.delete("proxy-authenticate");
    headers.delete("proxy-authorization");
    headers.delete("te");
    headers.delete("trailers");
    headers.delete("transfer-encoding");
    headers.delete("upgrade");

    // --- FIX X-Forwarded-For CHAIN SAFELY ---
    headers.delete("x-forwarded-for");
    headers.delete("x-real-ip");

    if (clientIP) {
      headers.set("X-Forwarded-For", clientIP);
      headers.set("X-Real-IP", clientIP);
    }

    // --- PRESERVE HOST CONTEXT ---
    headers.set("Host", backendUrl.hostname);
    headers.set("X-Forwarded-Host", url.hostname);
    headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

    // DO NOT delete:
    // Origin
    // Referer
    // Cookie

    const response = await fetch(backendUrl.toString(), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
      redirect: "manual",
      cf: {
        cacheEverything: false  // 🔥 Disable caching for SaaS
      }
    });

    const responseHeaders = new Headers(response.headers);

    // Remove identifying headers
    responseHeaders.delete("Server");
    responseHeaders.delete("X-Powered-By");
    responseHeaders.delete("Via");

    // --- SAFE REDIRECT REWRITE ---
    if (responseHeaders.has("Location")) {
      let loc = responseHeaders.get("Location");

      try {
        const redirectUrl = new URL(loc, backendUrl.origin);

        if (redirectUrl.origin === backendUrl.origin) {
          redirectUrl.host = url.host;
          responseHeaders.set("Location", redirectUrl.toString());
        }

      } catch (e) {
        // If invalid URL, leave it untouched
      }
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });
  }
};
