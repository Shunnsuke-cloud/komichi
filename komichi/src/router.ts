import { comparePaths, type RouteSuggestion } from "./guide.js";
export type { RouteSuggestion, PathDifference } from "./guide.js";
export type Params = Record<string, string>;
export type Route<Handler> = { method: string; path: string; handler: Handler; description?: string };

export function normalizePath(path: string): string {
  return `/${path.split("/").filter(Boolean).join("/")}`;
}

export class Router<Handler> {
  private readonly routes: Route<Handler>[] = [];

  add(method: string, path: string, handler: Handler, description?: string): void {
    method = method.toUpperCase();
    path = normalizePath(path);
    const names = path.split("/").filter(part => part.startsWith(":")).map(part => part.slice(1));
    if (names.some(name => !name) || new Set(names).size !== names.length) {
      throw new Error(`Invalid route parameters: ${method} ${path}`);
    }
    const shape = (value: string) => value.split("/").map(part => part.startsWith(":") ? ":" : part).join("/");
    if (this.routes.some(route => route.method === method && shape(route.path) === shape(path))) {
      throw new Error(`Duplicate route detected: ${method} ${path}`);
    }
    this.routes.push({ method, path, handler, description });
  }

  list(): readonly Route<Handler>[] { return this.routes.slice(); }

  find(method: string, requestPath: string): { route: Route<Handler>; params: Params } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const params = this.matchPath(route.path, requestPath);
      if (params !== null) return { route, params };
    }
    return null;
  }

  // Explicit registrations only; the HTTP layer adds automatic HEAD and OPTIONS.
  findAllowedMethods(requestPath: string): string[] {
    return [...new Set(this.routes.filter(route => this.matchPath(route.path, requestPath) !== null).map(route => route.method))];
  }

  findSuggestions(method: string, requestPath: string): RouteSuggestion[] {
    return this.routes.map(route => ({ method: route.method, path: route.path, ...comparePaths(requestPath, route.path) }))
      .filter(route => route.score >= 0.45)
      .sort((a, b) => Number(b.method === method) - Number(a.method === method) || b.score - a.score)
      .slice(0, 3);
  }

  private matchPath(routePath: string, requestPath: string): Params | null {
    const routeParts = routePath.split("/").filter(Boolean);
    const requestParts = requestPath.split("/").filter(Boolean);
    if (routeParts.length !== requestParts.length) return null;
    const params: Params = {};
    for (let index = 0; index < routeParts.length; index++) {
      const routePart = routeParts[index];
      const requestPart = requestParts[index];
      if (routePart.startsWith(":")) {
        try {
          Object.defineProperty(params, routePart.slice(1), {
            value: decodeURIComponent(requestPart), enumerable: true, configurable: true, writable: true,
          });
        } catch { return null; }
      } else if (routePart !== requestPart) return null;
    }
    return params;
  }
}
