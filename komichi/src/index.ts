import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readJsonBody } from "./body.js";
import { Context } from "./context.js";
import { KomichiError } from "./errors.js";
import { RouteGroup, type Register } from "./group.js";
import { routeGuide } from "./guide.js";
import { invoke, type Handler } from "./handlers.js";
import { compose, type HandlerResult, type Middleware } from "./middleware.js";
import { KomichiResponse } from "./response.js";
import { Router } from "./router.js";
import { Trail } from "./trail.js";

export type KomichiOptions = { trail?: boolean; bodyLimit?: number; routeGuide?: boolean };
export type ErrorHandler = (error: unknown, c: Context) => HandlerResult | Promise<HandlerResult>;
export type NotFoundHandler = (c: Context) => HandlerResult | Promise<HandlerResult>;

export class Komichi extends RouteGroup<""> {
  private readonly router: Router<Handler>;
  private readonly middleware: Middleware[] = [];
  private readonly trail: Trail;
  private readonly bodyLimit: number;
  private readonly guideEnabled: boolean;
  private errorHandler?: ErrorHandler;
  private notFoundHandler?: NotFoundHandler;

  constructor(options: KomichiOptions = {}) {
    const router = new Router<Handler>();
    // Erase route literals only at storage; registration retains inferred params.
    super(((method, path, handler, description) => {
      router.add(method, path, handler as unknown as Handler, description);
    }) as Register, "");
    this.router = router;
    this.trail = new Trail(options.trail ?? false);
    this.bodyLimit = options.bodyLimit ?? 1024 * 1024;
    if (!Number.isSafeInteger(this.bodyLimit) || this.bodyLimit < 0) throw new RangeError("bodyLimit must be a non-negative integer in bytes");
    this.guideEnabled = options.routeGuide ?? true;
  }

  use(middleware: Middleware): this { this.middleware.push(middleware); return this; }
  onError(handler: ErrorHandler): this { this.errorHandler = handler; return this; }
  notFound(handler: NotFoundHandler): this { this.notFoundHandler = handler; return this; }
  json(data: unknown, statusCode = 200): KomichiResponse { return new KomichiResponse(data, statusCode, "json"); }
  text(data: string, statusCode = 200): KomichiResponse { return new KomichiResponse(data, statusCode, "text"); }
  html(data: string, statusCode = 200): KomichiResponse { return new KomichiResponse(data, statusCode, "html"); }

  printRoutes(): void {
    console.log("\nKomichi Route Map\n------------------------------");
    const routes = this.router.list();
    const methodWidth = Math.max(6, ...routes.map(route => route.method.length));
    const pathWidth = Math.max(4, ...routes.map(route => route.path.length));
    for (const route of routes) {
      console.log(`${route.method.padEnd(methodWidth)}  ${route.path.padEnd(pathWidth)}${route.description ? `  ${route.description}` : ""}`);
    }
    if (!routes.length) console.log("登録されているルートはありません");
    console.log(`------------------------------\n${routes.length} routes registered\n`);
  }

  listen(port: number): Server {
    const server = createServer((req, res) => { void this.handleRequest(req, res); });
    server.listen(port, () => {
      const address = server.address();
      console.log(`Komichi is running on http://localhost:${typeof address === "object" && address ? address.port : port}`);
    });
    return server;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startedAt = Date.now();
    const method = req.method ?? "GET";
    const c = new Context(req, {}, new URLSearchParams());
    let requestedPath = req.url ?? "/";
    let matchedPath: string | undefined;
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      requestedPath = url.pathname;
      const matched = this.router.find(method, url.pathname)
        ?? (method === "HEAD" ? this.router.find("GET", url.pathname) : null);
      for (const [key, value] of Object.entries(matched?.params ?? {})) {
        Object.defineProperty(c.params, key, { value, enumerable: true, configurable: true, writable: true });
      }
      url.searchParams.forEach((value, key) => c.query.append(key, value));
      matchedPath = matched?.route.path;
      if (matched) c.body = await readJsonBody(req, this.bodyLimit);
      await compose(c, this.middleware, async () => {
        if (matched) {
          c.accept(await invoke(matched.route.handler, c));
          return;
        }
        const allowed = this.router.findAllowedMethods(url.pathname);
        if (allowed.length) {
          if (allowed.includes("GET") && !allowed.includes("HEAD")) allowed.push("HEAD");
          if (!allowed.includes("OPTIONS")) allowed.push("OPTIONS");
          c.header("Allow", allowed.join(", "));
          if (method === "OPTIONS") c.text("", 204);
          else c.json({ message: "Method Not Allowed", requestedMethod: method, requestedPath, allowedMethods: allowed }, 405);
        } else if (this.notFoundHandler) {
          c.status(404);
          c.accept(await this.notFoundHandler(c));
        } else {
          c.json(this.guideEnabled
            ? routeGuide(method, url.pathname, this.router.findSuggestions(method, url.pathname))
            : { message: "Route not found" }, 404);
        }
      });
      if (!c.response) c.text("", 204);
      this.send(res, method, c.response!);
    } catch (error) {
      await this.handleError(error, c);
      try { this.send(res, method, c.response!); }
      catch (sendError) {
        console.error(sendError);
        if (!res.headersSent) {
          for (const name of res.getHeaderNames()) res.removeHeader(name);
          c.reset();
          c.json({ message: "Internal Server Error" }, 500);
          this.send(res, method, c.response!);
        } else res.destroy();
      }
    } finally {
      req.resume();
      this.trail.print({ method, requestedPath, matchedPath, params: c.params, query: c.query,
        statusCode: c.response?.statusCode ?? 500, responseType: c.response?.type ?? "json", startedAt });
    }
  }

  private async handleError(error: unknown, c: Context): Promise<void> {
    c.reset();
    const status = error instanceof KomichiError ? error.statusCode : 500;
    c.status(status);
    if (this.errorHandler) {
      try {
        c.accept(await this.errorHandler(error, c));
        if (c.response) return;
      } catch (handlerError) {
        console.error(handlerError);
        c.reset();
        c.json({ message: "Internal Server Error" }, 500);
        return;
      }
    }
    if (status >= 500) console.error(error);
    c.json({ message: status < 500 && error instanceof KomichiError ? error.message : "Internal Server Error" }, status);
  }

  private send(res: ServerResponse, method: string, result: KomichiResponse): void {
    const body = result.type === "json" ? JSON.stringify(result.body) ?? "" : String(result.body);
    if (!Number.isInteger(result.statusCode) || result.statusCode < 200 || result.statusCode > 599) throw new RangeError("Invalid response status");
    for (const name of res.getHeaderNames()) res.removeHeader(name);
    res.statusCode = result.statusCode;
    const types = { json: "application/json", text: "text/plain", html: "text/html" };
    res.setHeader("Content-Type", `${types[result.type]}; charset=utf-8`);
    for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
    // Buffered responses own framing; never emit both length and transfer encoding.
    res.removeHeader("Transfer-Encoding");
    const empty = result.statusCode === 204 || result.statusCode === 205 || result.statusCode === 304;
    if (empty) {
      res.removeHeader("Content-Length");
    } else res.setHeader("Content-Length", Buffer.byteLength(body));
    res.end(method === "HEAD" || empty ? undefined : body);
  }
}

export { Context, type PathParams, type JsonBody, type CookieOptions } from "./context.js";
export { legacy, type Handler, type LegacyHandler } from "./handlers.js";
export { type HandlerResult, type Middleware, type Next } from "./middleware.js";
export { RouteGroup, type JoinPath } from "./group.js";
export { KomichiResponse, type ResponseType } from "./response.js";
export { BadRequestError, KomichiError } from "./errors.js";
export { Router, type Params, type Route, type RouteSuggestion, type PathDifference } from "./router.js";
export { Trail, type TrailInfo } from "./trail.js";
