// Small explicit router: routes are declared as (method, pattern, handler)
// where pattern segments starting with ":" bind a named param. No regex
// patterns, no wildcard globbing - keeps matching easy to reason about and
// lets us report an accurate `Allow` header on 405s.

function splitPattern(pattern) {
  return pattern.split('/').filter((s) => s.length > 0);
}

function matchSegments(routeSegments, pathSegments) {
  if (routeSegments.length !== pathSegments.length) return null;
  const params = {};
  for (let i = 0; i < routeSegments.length; i++) {
    const routeSeg = routeSegments[i];
    let pathSeg;
    try {
      pathSeg = decodeURIComponent(pathSegments[i]);
    } catch {
      return null; // malformed percent-encoding
    }
    if (routeSeg.startsWith(':')) {
      params[routeSeg.slice(1)] = pathSeg;
    } else if (routeSeg !== pathSeg) {
      return null;
    }
  }
  return params;
}

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    this.routes.push({
      method: method.toUpperCase(),
      pattern,
      segments: splitPattern(pattern),
      handler,
    });
    return this;
  }

  get(pattern, handler) {
    return this.add('GET', pattern, handler);
  }

  post(pattern, handler) {
    return this.add('POST', pattern, handler);
  }

  /**
   * @returns {{handler, params, pattern} | {methodNotAllowed: true, allowedMethods: string[]} | null}
   */
  match(method, pathname) {
    const pathSegments = splitPattern(pathname);
    const upperMethod = method.toUpperCase();
    const allowedMethods = new Set();
    let matchedOtherMethod = null;

    for (const route of this.routes) {
      const params = matchSegments(route.segments, pathSegments);
      if (!params) continue;
      allowedMethods.add(route.method);
      if (route.method === upperMethod) {
        return { handler: route.handler, params, pattern: route.pattern };
      }
      matchedOtherMethod = route;
    }

    if (matchedOtherMethod) {
      return { methodNotAllowed: true, allowedMethods: [...allowedMethods] };
    }
    return null;
  }
}
