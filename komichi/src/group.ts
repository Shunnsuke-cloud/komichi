import type { Handler } from "./handlers.js";
import { normalizePath } from "./router.js";

type TrimLeft<P extends string> = P extends `/${infer Rest}` ? TrimLeft<Rest> : P;
type TrimRight<P extends string> = P extends `${infer Rest}/` ? TrimRight<Rest> : P;
export type JoinPath<Prefix extends string, Path extends string> =
  string extends Prefix | Path ? string : TrimLeft<TrimRight<Prefix>> extends ""
    ? `/${TrimLeft<TrimRight<Path>>}`
    : `/${TrimLeft<TrimRight<Prefix>>}${TrimLeft<TrimRight<Path>> extends "" ? "" : `/${TrimLeft<TrimRight<Path>>}`}`;
export type Register = <P extends string>(method: string, path: P, handler: Handler<P>, description?: string) => void;

/** Prefix-only view: one shared router, no separate application or server. */
export class RouteGroup<Prefix extends string = ""> {
  constructor(private readonly register: Register, private readonly prefix: Prefix) {}

  group<P extends string>(path: P): RouteGroup<JoinPath<Prefix, P>> {
    return new RouteGroup(this.register, this.join(path));
  }
  get<P extends string>(path: P, handler: Handler<JoinPath<Prefix, P>>, description?: string): void {
    this.add("GET", path, handler, description);
  }
  post<P extends string>(path: P, handler: Handler<JoinPath<Prefix, P>>, description?: string): void {
    this.add("POST", path, handler, description);
  }
  put<P extends string>(path: P, handler: Handler<JoinPath<Prefix, P>>, description?: string): void {
    this.add("PUT", path, handler, description);
  }
  patch<P extends string>(path: P, handler: Handler<JoinPath<Prefix, P>>, description?: string): void {
    this.add("PATCH", path, handler, description);
  }
  delete<P extends string>(path: P, handler: Handler<JoinPath<Prefix, P>>, description?: string): void {
    this.add("DELETE", path, handler, description);
  }
  head<P extends string>(path: P, handler: Handler<JoinPath<Prefix, P>>, description?: string): void {
    this.add("HEAD", path, handler, description);
  }
  options<P extends string>(path: P, handler: Handler<JoinPath<Prefix, P>>, description?: string): void {
    this.add("OPTIONS", path, handler, description);
  }
  private join<P extends string>(path: P): JoinPath<Prefix, P> {
    return normalizePath(`${this.prefix}/${path}`) as JoinPath<Prefix, P>;
  }
  private add<P extends string>(method: string, path: P, handler: Handler<JoinPath<Prefix, P>>, description?: string): void {
    this.register(method, this.join(path), handler, description);
  }
}
