import type { Context } from "./context.js";
import type { KomichiResponse } from "./response.js";

export type HandlerResult = Record<string, unknown> | string | KomichiResponse | void;
export type Next = () => Promise<void>;
export type Middleware = (c: Context, next: Next) => HandlerResult | Promise<HandlerResult>;

export async function compose(c: Context, middleware: readonly Middleware[], handler: () => Promise<void>): Promise<void> {
  let lastIndex = -1;
  async function dispatch(index: number): Promise<void> {
    if (index <= lastIndex) throw new Error("next() called more than once");
    lastIndex = index;
    const current = middleware[index];
    if (!current) return handler();
    c.accept(await current(c, () => dispatch(index + 1)));
  }
  await dispatch(0);
}
