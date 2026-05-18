// v1
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

//v3 -
// const backend = "https://crm.linkscdn.net";

// export default {
//   async fetch(request, env, ctx) {
//     const url = new URL(request.url);
//     const clientIP = request.headers.get("CF-Connecting-IP");
//     const backendUrl = new URL(backend);
//     backendUrl.pathname = url.pathname;
//     backendUrl.search = url.search;

//     const headers = new Headers(request.headers);
//     headers.delete("x-forwarded-for");
//     headers.delete("x-real-ip");
//     headers.set("X-Real-IP", clientIP);
//     headers.set("X-Forwarded-For", clientIP);
//     headers.set("Host", backendUrl.hostname);
//     headers.set("X-Forwarded-Host", url.hostname);
//     headers.set("X-Forwarded-Proto", "https");

//     const resp = await fetch(backendUrl.toString(), {
//       method: request.method,
//       headers,
//       body: request.body,
//       redirect: "manual"
//     });

//     const rHeaders = new Headers(resp.headers);

//     // Rewrite redirects
//     if (rHeaders.has("Location")) {
//       let loc = rHeaders.get("Location");
//       loc = loc.replace(backendUrl.origin, url.origin);
//       rHeaders.set("Location", loc);
//     }

//     // Rewrite content (HTML / JS / JSON)
//     const ct = rHeaders.get("content-type") || "";
//     if (ct.includes("text/html") || ct.includes("application/javascript") || ct.includes("application/json")) {
//       let text = await resp.text();
//       text = text.replaceAll(backendUrl.origin, url.origin);
//       return new Response(text, { status: resp.status, headers: rHeaders });
//     }

//     // Rewrite Set-Cookie domain if needed
//     if (rHeaders.has("Set-Cookie")) {
//       let cookies = rHeaders.get("Set-Cookie").split(",");
//       cookies = cookies.map(c => c.replace(backendUrl.hostname, url.hostname));
//       rHeaders.set("Set-Cookie", cookies.join(","));
//     }

//     return new Response(resp.body, { status: resp.status, headers: rHeaders });
//   }
// };

// Worker v3 - Hardened for SaaS backend
const BACKEND = "https://crm.linkscdn.net";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const clientIP = request.headers.get("CF-Connecting-IP");

    // Build backend URL
    const backendUrl = new URL(BACKEND);
    backendUrl.pathname = url.pathname;
    backendUrl.search = url.search;

    // Prepare headers for forwarding
    const headers = new Headers(request.headers);
    headers.delete("x-forwarded-for");
    headers.delete("x-real-ip");
    headers.set("X-Real-IP", clientIP);
    headers.set("X-Forwarded-For", clientIP);
    headers.set("Host", backendUrl.hostname);
    headers.set("X-Forwarded-Host", url.hostname);
    headers.set("X-Forwarded-Proto", "https");

    // Forward request to backend
    const resp = await fetch(backendUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual"
    });

    // Copy response headers and remove identifying info
    const rHeaders = new Headers(resp.headers);
    rHeaders.delete("Server");
    rHeaders.delete("X-Powered-By");
    rHeaders.delete("Via");

    // Rewrite Location headers (redirects) to Worker domain
    if (rHeaders.has("Location")) {
      let loc = rHeaders.get("Location");
      loc = loc.replace(backendUrl.origin, url.origin);
      rHeaders.set("Location", loc);
    }

    // Rewrite Set-Cookie domains
    if (rHeaders.has("Set-Cookie")) {
      let cookies = rHeaders.get("Set-Cookie").split(",");
      cookies = cookies.map(c => c.replace(backendUrl.hostname, url.hostname));
      rHeaders.set("Set-Cookie", cookies.join(","));
    }

    // Rewrite content for HTML, JS, JSON, CSS, XML
    const ct = rHeaders.get("content-type") || "";
    if (
      ct.includes("text/html") ||
      ct.includes("application/javascript") ||
      ct.includes("application/json") ||
      ct.includes("text/css") ||
      ct.includes("application/xml") ||
      ct.includes("text/xml")
    ) {
      let text = await resp.text();
      text = text.replaceAll(backendUrl.origin, url.origin);
      return new Response(text, {
        status: resp.status,
        headers: rHeaders
      });
    }

    // Stream other content (images, fonts, etc.) unmodified
    return new Response(resp.body, {
      status: resp.status,
      headers: rHeaders
    });
  }
};