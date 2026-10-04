import type { Context, JsonBody, PathParams } from "./context.js";
import type { HandlerResult } from "./middleware.js";
import type { Params } from "./router.js";

// The intersection preserves old params.id access while c.params stays strict.
export type Handler<Path extends string = string> = (
  c: Context<Path> & PathParams<Path>, query: URLSearchParams, body: JsonBody,
) => HandlerResult | Promise<HandlerResult>;
export type LegacyHandler = (params: Params, query: URLSearchParams, body: JsonBody) => HandlerResult | Promise<HandlerResult>;

/** Explicit adapter for old handlers that enumerate params or use reserved names. */
export function legacy(handler: LegacyHandler): Handler {
  return (c) => handler(c.params, c.query, c.body);
}

export function invoke(handler: Handler, c: Context): ReturnType<Handler> {
  const compatible = new Proxy(c, {
    get(target, key, receiver) {
      if (typeof key === "string" && !(key in target)) return target.params[key];
      return Reflect.get(target, key, receiver);
    },
  });
  return handler(compatible as Context & Params, c.query, c.body);
}
