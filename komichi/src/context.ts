import type { IncomingMessage } from "node:http";
import { KomichiResponse, type ResponseType } from "./response.js";
import type { Params } from "./router.js";

export type JsonBody = Record<string, unknown>;
type ParamNames<Path extends string> =
  Path extends `${infer Segment}/${infer Rest}`
    ? (Segment extends `:${infer Name}` ? Name : never) | ParamNames<Rest>
    : Path extends `:${infer Name}` ? Name : never;
export type PathParams<Path extends string> = string extends Path
  ? Params : { [Name in ParamNames<Path>]: string };
export type CookieOptions = {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
};

/** Request state and response helpers; nothing is sent until middleware unwinds. */
export class Context<Path extends string = string> {
  response?: KomichiResponse;
  private statusCode = 200;
  private readonly headers: Record<string, string | string[]> = {};

  constructor(
    public readonly req: IncomingMessage,
    public readonly params: PathParams<Path>,
    public readonly query: URLSearchParams,
    public body: JsonBody = {},
  ) {}

  status(code: number): this {
    if (!Number.isInteger(code) || code < 200 || code > 599) {
      throw new RangeError("Response status must be between 200 and 599");
    }
    this.statusCode = code;
    if (this.response) this.response.statusCode = code;
    return this;
  }

  header(name: string, value: string | string[]): this {
    const key = name.toLowerCase();
    this.headers[key] = value;
    if (this.response) this.response.headers[key] = value;
    return this;
  }

  json(data: unknown, status?: number): KomichiResponse {
    return this.create(data, "json", status);
  }
  text(data: string, status?: number): KomichiResponse {
    return this.create(data, "text", status);
  }
  html(data: string, status?: number): KomichiResponse {
    return this.create(data, "html", status);
  }
  redirect(location: string, status: 301 | 302 | 303 | 307 | 308 = 302): KomichiResponse {
    this.header("Location", location);
    return this.text("", status);
  }

  cookie(name: string): string | undefined;
  cookie(name: string, value: string, options?: CookieOptions): this;
  cookie(name: string, value?: string, options: CookieOptions = {}): string | undefined | this {
    if (value === undefined) {
      for (const part of (this.req.headers.cookie ?? "").split(";")) {
        const separator = part.indexOf("=");
        if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
        try { return decodeURIComponent(part.slice(separator + 1).trim()); }
        catch { return undefined; }
      }
      return undefined;
    }
    if (!/^[!#$%&'*+\-.^_`|~\w]+$/.test(name)) throw new TypeError("Invalid cookie name");
    const parts = [`${name}=${encodeURIComponent(value)}`];
    for (const [key, field] of [["Path", options.path ?? "/"], ["Domain", options.domain]] as const) {
      if (field === undefined) continue;
      if (/[;\r\n]/.test(field)) throw new TypeError(`Invalid cookie ${key}`);
      parts.push(`${key}=${field}`);
    }
    if (options.maxAge !== undefined) {
      if (!Number.isFinite(options.maxAge)) throw new TypeError("Invalid cookie Max-Age");
      parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
    }
    if (options.expires) {
      if (!Number.isFinite(options.expires.getTime())) throw new TypeError("Invalid cookie Expires");
      parts.push(`Expires=${options.expires.toUTCString()}`);
    }
    if (options.httpOnly) parts.push("HttpOnly");
    if (options.secure) parts.push("Secure");
    if (options.sameSite) {
      if (!["Strict", "Lax", "None"].includes(options.sameSite)) throw new TypeError("Invalid cookie SameSite");
      parts.push(`SameSite=${options.sameSite}`);
    }
    const previous = this.headers["set-cookie"] ?? this.response?.headers["set-cookie"];
    return this.header("Set-Cookie", [
      ...(Array.isArray(previous) ? previous : previous ? [previous] : []), parts.join("; "),
    ]);
  }

  /** Normalize plain returns and merge settings made before or after next(). */
  accept(result: unknown): void {
    if (result === undefined) return;
    if (result instanceof KomichiResponse) {
      // app.json() responses may be reused across requests. Keep request settings local.
      if (result !== this.response) {
        const headers = Object.fromEntries(Object.entries(result.headers).map(([key, value]) => [key.toLowerCase(), value]));
        this.response = new KomichiResponse(result.body, result.statusCode, result.type, { ...headers, ...this.headers });
      } else Object.assign(result.headers, this.headers);
      this.statusCode = this.response.statusCode;
    } else if (typeof result === "string") this.text(result);
    else this.json(result);
  }

  reset(): void {
    this.response = undefined;
    this.statusCode = 200;
    for (const key of Object.keys(this.headers)) delete this.headers[key];
  }

  private create(body: unknown, type: ResponseType, status?: number): KomichiResponse {
    if (status !== undefined) this.status(status);
    return this.response = new KomichiResponse(body, this.statusCode, type, { ...this.headers });
  }
}
