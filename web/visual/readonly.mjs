export const academicOrigin = "http://127.0.0.1:15173";

// Fail closed for every method, not only /api. No mutation-capable APIRequestContext.
export function requestDecision(rawURL, method, loginAvailable = false) {
  let url;
  try {
    url = new URL(rawURL);
  } catch {
    return "block";
  }
  if (url.origin !== academicOrigin || url.username || url.password)
    return "block";
  if (/\/(download|export|exports)\b|\.xlsx?\b/i.test(url.pathname))
    return "block";
  if (url.pathname.startsWith("/api/")) {
    if (
      loginAvailable &&
      method === "POST" &&
      url.pathname === "/api/v1/auth/login/" &&
      !url.search
    )
      return "login";
    return ["GET", "HEAD", "OPTIONS"].includes(method) ? "read" : "block";
  }
  return ["GET", "HEAD"].includes(method) ? "read" : "block";
}

export async function protectContext(context) {
  let loginAvailable = true;
  const blocked = [];
  // Vite HMR and other WebSockets are unnecessary during a frozen capture.
  await context.routeWebSocket(/.*/, (socket) => socket.close());
  await context.route("**/*", async (route) => {
    const request = route.request();
    const decision = requestDecision(
      request.url(),
      request.method(),
      loginAvailable,
    );
    if (decision === "login") loginAvailable = false;
    if (decision === "block") {
      // No queries, headers, request bodies, responses or credentials in evidence.
      blocked.push({
        method: request.method(),
        path: new URL(request.url()).pathname,
      });
      return route.abort("blockedbyclient");
    }
    // Redirects must be intercepted individually; never follow an unchecked origin.
    const response = await route.fetch({ maxRedirects: 0 });
    if (response.status() >= 300 && response.status() < 400) {
      blocked.push({
        method: request.method(),
        path: new URL(request.url()).pathname,
      });
      return route.abort("blockedbyclient");
    }
    return route.fulfill({ response });
  });
  return {
    blocked,
    sealLogin: () => {
      loginAvailable = false;
    },
  };
}
