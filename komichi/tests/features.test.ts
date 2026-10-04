import assert from "node:assert/strict";
import { once } from "node:events";
import { request } from "node:http";
import test from "node:test";
import { Komichi, KomichiError, BadRequestError, Router, legacy, type KomichiOptions } from "../src/index.js";

async function withApp(setup: (app: Komichi) => void, check: (base: string) => Promise<void>, options: KomichiOptions = {}) {
  const app = new Komichi(options);
  setup(app);
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try { await check(`http://localhost:${address.port}`); }
  finally {
    const closed = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closed;
  }
}

test("Context exposes params, query, JSON body and raw request", async () => {
  await withApp(app => {
    app.use(async (c, next) => {
      assert.equal(c.body.name, "Komichi");
      await next();
    });
    app.post("/users/:id", c => c.status(201).header("X-Komichi", "guide").json({
      id: c.params.id, q: c.query.getAll("q"), body: c.body, method: c.req.method,
    }));
  }, async base => {
    const res = await fetch(`${base}/users/a%20b?q=one&q=two`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: '{"name":"Komichi"}',
    });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get("x-komichi"), "guide");
    assert.deepEqual(await res.json(), { id: "a b", q: ["one", "two"], body: { name: "Komichi" }, method: "POST" });
  });
});

test("Context text and html helpers; status and headers can change after creation", async () => {
  await withApp(app => {
    app.get("/text", c => { c.text("hello"); c.status(202).header("X-After", "yes"); });
    app.get("/html", c => c.html("<h1>Komichi</h1>"));
  }, async base => {
    const text = await fetch(`${base}/text`);
    assert.equal(text.status, 202);
    assert.equal(text.headers.get("x-after"), "yes");
    assert.equal(await text.text(), "hello");
    const html = await fetch(`${base}/html`);
    assert.match(html.headers.get("content-type")!, /text\/html/);
    assert.equal(await html.text(), "<h1>Komichi</h1>");
  });
});

test("Middleware follows registration order and unwinds after awaited next", async () => {
  const order: string[] = [];
  await withApp(app => {
    app.use(async (c, next) => {
      order.push("a:before"); c.header("X-Before", "yes");
      await next(); order.push("a:after"); c.header("X-After", "yes").status(202);
    });
    app.use(async (_c, next) => { order.push("b:before"); await next(); order.push("b:after"); });
    app.get("/", async c => { await Promise.resolve(); order.push("handler"); return c.json({ ok: true }); });
  }, async base => {
    const res = await fetch(base);
    assert.deepEqual(order, ["a:before", "b:before", "handler", "b:after", "a:after"]);
    assert.equal(res.status, 202);
    assert.equal(res.headers.get("x-before"), "yes");
    assert.equal(res.headers.get("x-after"), "yes");
  });
});

test("Middleware can short circuit and return or set a response", async () => {
  let called = false;
  await withApp(app => {
    app.use(c => c.json({ message: "auth required" }, 401));
    app.use(() => { called = true; });
    app.get("/", () => { called = true; return "handler"; });
  }, async base => {
    const res = await fetch(base);
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { message: "auth required" });
    assert.equal(called, false);
  });
});

test("Middleware can catch downstream errors", async () => {
  await withApp(app => {
    app.use(async (c, next) => {
      try { await next(); } catch (error) {
        assert.ok(error instanceof KomichiError); c.json({ caught: true }, 409);
      }
    });
    app.get("/", () => { throw new KomichiError(403, "forbidden"); });
  }, async base => {
    const res = await fetch(base); assert.equal(res.status, 409); assert.deepEqual(await res.json(), { caught: true });
  });
});

test("Repeated next is rejected and middleware failures reach onError", async () => {
  await withApp(app => {
    app.onError((error, c) => c.json({ message: (error as Error).message }, 500));
    app.use(async (c, next) => {
      await next();
      if (c.query.has("twice")) await next();
      else throw new Error("middleware failed");
    });
    app.get("/", c => c.text("ok"));
  }, async base => {
    const twice = await fetch(`${base}/?twice`);
    assert.equal(twice.status, 500);
    assert.deepEqual(await twice.json(), { message: "next() called more than once" });
    assert.deepEqual(await (await fetch(base)).json(), { message: "middleware failed" });
  });
});

test("Groups share routing, normalize slashes and include parent params", async () => {
  await withApp(app => {
    const users = app.group("/users/");
    users.get("/", c => c.json({ list: true }));
    users.post("/", c => c.json(c.body, 201));
    users.get("/:id", c => c.json(c.params));
    app.group("/teams/:teamId").group("users").get("/:id", c => c.json(c.params));
  }, async base => {
    assert.deepEqual(await (await fetch(`${base}/users`)).json(), { list: true });
    assert.deepEqual(await (await fetch(`${base}/users/42`)).json(), { id: "42" });
    assert.deepEqual(await (await fetch(`${base}/teams/red/users/42`)).json(), { teamId: "red", id: "42" });
    assert.equal((await fetch(`${base}/users`, { method: "POST" })).status, 201);
  });
});

test("KomichiError and BadRequestError preserve safe client messages", async () => {
  await withApp(app => {
    app.get("/missing", () => { throw new KomichiError(404, "User not found"); });
    app.get("/bad", () => { throw new BadRequestError("invalid user"); });
  }, async base => {
    const res = await fetch(`${base}/missing`);
    assert.equal(res.status, 404); assert.deepEqual(await res.json(), { message: "User not found" });
    const bad = await fetch(`${base}/bad`);
    assert.equal(bad.status, 400); assert.deepEqual(await bad.json(), { message: "invalid user" });
  });
  assert.throws(() => new KomichiError(200, "bad"), RangeError);
});

test("Default 500 hides internal messages, including KomichiError 500", async () => {
  await withApp(app => {
    app.get("/plain", () => { throw new Error("database password secret"); });
    app.get("/typed", () => { throw new KomichiError(503, "private infrastructure"); });
  }, async base => {
    for (const path of ["plain", "typed"]) {
      const res = await fetch(`${base}/${path}`);
      assert.equal(res.status, path === "plain" ? 500 : 503);
      assert.deepEqual(await res.json(), { message: "Internal Server Error" });
    }
  });
});

test("Custom error and notFound handlers receive Context", async () => {
  await withApp(app => {
    app.onError((error, c) => {
      assert.ok(error instanceof KomichiError);
      return c.header("X-Error", "custom").json({ id: c.params.id }, 422);
    });
    app.notFound(c => c.text(`Missing ${c.req.url}`));
    app.get("/users/:id", () => { throw new KomichiError(400, "bad"); });
  }, async base => {
    const error = await fetch(`${base}/users/42`);
    assert.equal(error.status, 422); assert.equal(error.headers.get("x-error"), "custom");
    assert.deepEqual(await error.json(), { id: "42" });
    const missing = await fetch(`${base}/unknown`);
    assert.equal(missing.status, 404); assert.equal(await missing.text(), "Missing /unknown");
  });
});

test("A failing onError falls back safely; serialization failures also reach onError", async () => {
  await withApp(app => {
    app.onError(() => { throw new Error("custom failure"); });
    app.get("/", () => { throw new Error("secret"); });
  }, async base => {
    const res = await fetch(base); assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { message: "Internal Server Error" });
  });
  await withApp(app => {
    app.onError((_error, c) => c.text("cannot serialize", 500));
    app.get("/", c => c.json({ number: 1n }));
  }, async base => {
    const res = await fetch(base); assert.equal(res.status, 500); assert.equal(await res.text(), "cannot serialize");
  });
});

test("Route Guide returns closest route, segment differences and scores", async () => {
  await withApp(app => {
    app.get("/users/:id", c => c.json(c.params));
    app.post("/user/:id", c => c.json(c.params));
  }, async base => {
    const res = await fetch(`${base}/userr/123`);
    assert.equal(res.status, 404);
    const guide = await res.json();
    assert.equal(guide.closestRoute.method, "GET");
    assert.equal(guide.closestRoute.path, "/users/:id");
    assert.deepEqual(guide.closestRoute.differences, [{ segment: 1, from: "userr", to: "users" }]);
    assert.equal(guide.closestRoute.similarity, 0.9);
    assert.equal(guide.closestRoute.similarityPercent, 90);
    assert.equal(guide.suggestions[1].method, "POST");
  });
});

test("Route Guide has an empty state and can be disabled", async () => {
  await withApp(() => {}, async base => {
    const guide = await (await fetch(base)).json();
    assert.equal(guide.closestRoute, null); assert.deepEqual(guide.suggestions, []);
  });
  await withApp(app => app.get("/users", c => c.text("ok")), async base => {
    assert.deepEqual(await (await fetch(`${base}/user`)).json(), { message: "Route not found" });
  }, { routeGuide: false });
});

test("Duplicate detection includes equivalent params and normalized group paths", () => {
  const app = new Komichi();
  app.get("/users", c => c.text("a"));
  assert.throws(() => app.get("/users/", c => c.text("b")), /Duplicate route detected: GET \/users/);
  assert.throws(() => app.group("/users").get("/", c => c.text("b")), /Duplicate route/);
  app.post("/users", c => c.text("allowed"));
  app.get("/users/:id", c => c.text("a"));
  assert.throws(() => app.get("/users/:name", c => c.text("b")), /Duplicate route/);
  const router = new Router<() => string>();
  assert.throws(() => router.add("GET", "/users/:", () => ""), /Invalid route/);
  assert.throws(() => router.add("GET", "/:id/:id", () => ""), /Invalid route/);
});

test("HEAD falls back to GET with matching headers and no body; explicit HEAD wins", async () => {
  await withApp(app => {
    app.get("/", c => c.text("日本語"));
    app.get("/explicit", c => c.text("get"));
    app.head("/explicit", c => c.header("X-Head", "yes").text("head", 202));
  }, async base => {
    const get = await fetch(base);
    const head = await fetch(base, { method: "HEAD" });
    assert.equal(head.status, get.status);
    assert.equal(head.headers.get("content-length"), get.headers.get("content-length"));
    assert.equal(await head.text(), "");
    const explicit = await fetch(`${base}/explicit`, { method: "HEAD" });
    assert.equal(explicit.status, 202); assert.equal(explicit.headers.get("x-head"), "yes");
    assert.equal(await explicit.text(), "");
    const missing = await fetch(`${base}/unknown`, { method: "HEAD" });
    assert.equal(missing.status, 404); assert.equal(await missing.text(), "");
  });
});

test("Automatic OPTIONS and 405 advertise HEAD/OPTIONS; explicit OPTIONS wins", async () => {
  await withApp(app => {
    app.get("/users", c => c.text("ok"));
    app.post("/users", c => c.text("ok"));
    app.options("/custom", c => c.header("X-Options", "yes").text("options"));
  }, async base => {
    const options = await fetch(`${base}/users`, { method: "OPTIONS" });
    assert.equal(options.status, 204);
    assert.equal(options.headers.get("allow"), "GET, POST, HEAD, OPTIONS");
    assert.equal(await options.text(), "");
    const wrong = await fetch(`${base}/users`, { method: "PUT" });
    assert.equal(wrong.status, 405);
    assert.deepEqual((await wrong.json()).allowedMethods, ["GET", "POST", "HEAD", "OPTIONS"]);
    const custom = await fetch(`${base}/custom`, { method: "OPTIONS" });
    assert.equal(custom.headers.get("x-options"), "yes"); assert.equal(await custom.text(), "options");
    assert.equal((await fetch(`${base}/unknown`, { method: "OPTIONS" })).status, 404);
  });
});

test("Redirect sets Location and supports custom redirect status", async () => {
  await withApp(app => {
    app.get("/old", c => c.redirect("/new", 307));
    app.get("/default", c => c.redirect("/new"));
  }, async base => {
    const res = await fetch(`${base}/old`, { redirect: "manual" });
    assert.equal(res.status, 307); assert.equal(res.headers.get("location"), "/new");
    assert.equal((await fetch(`${base}/default`, { redirect: "manual" })).status, 302);
  });
});

test("Cookies decode request values and append multiple Set-Cookie headers", async () => {
  await withApp(app => {
    app.get("/", c => {
      c.cookie("session", "a b", { httpOnly: true, secure: true, sameSite: "Lax", maxAge: 60 });
      c.cookie("theme", "dark");
      return c.json({ incoming: c.cookie("incoming"), missing: c.cookie("missing"), invalid: c.cookie("invalid") });
    });
  }, async base => {
    const res = await fetch(base, { headers: { Cookie: "incoming=hello%20world; invalid=%ZZ" } });
    assert.deepEqual(await res.json(), { incoming: "hello world" });
    const cookies = res.headers.get("set-cookie")!;
    assert.match(cookies, /session=a%20b; Path=\/; Max-Age=60; HttpOnly; Secure; SameSite=Lax/);
    assert.match(cookies, /theme=dark; Path=\//);
    // Raw Node headers verify these are separate fields rather than a comma joined cookie.
    await new Promise<void>((resolve, reject) => {
      request(base, response => {
        assert.equal(response.headers["set-cookie"]?.length, 2);
        response.resume(); response.on("end", resolve);
      }).on("error", reject).end();
    });
  });
});

test("Explicit incorrect Content-Type returns 415; JSON suffix and absent header work", async () => {
  await withApp(app => app.post("/", c => c.json(c.body)), async base => {
    for (const type of ["text/plain", "application/x-www-form-urlencoded"]) {
      const res = await fetch(base, { method: "POST", headers: { "Content-Type": type }, body: "{}" });
      assert.equal(res.status, 415);
    }
    const res = await fetch(base, { method: "POST", headers: { "Content-Type": "Application/Problem+JSON; charset=utf-8" }, body: '{"ok":true}' });
    assert.deepEqual(await res.json(), { ok: true });
    const absent = await fetch(base, { method: "POST", body: new Uint8Array(Buffer.from("{}")) });
    assert.equal(absent.status, 200);
    assert.equal((await fetch(base, { method: "POST" })).status, 200);
  });
});

test("Body limit measures bytes, accepts boundary, rejects declared and chunked oversize", async () => {
  await withApp(app => app.post("/", c => c.json(c.body)), async base => {
    const boundary = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"a":12}' });
    assert.equal(boundary.status, 200);
    const large = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"a":"あ"}' });
    assert.equal(large.status, 413); assert.deepEqual(await large.json(), { message: "Payload Too Large" });
    await new Promise<void>((resolve, reject) => {
      const req = request(base, { method: "POST", headers: { "Content-Type": "application/json", "Transfer-Encoding": "chunked" } }, res => {
        assert.equal(res.statusCode, 413); res.resume(); res.on("end", resolve);
      });
      req.on("error", reject); req.write('{"a":'); req.write('123456789}'); req.end();
    });
  }, { bodyLimit: 8 });
  assert.throws(() => new Komichi({ bodyLimit: -1 }), RangeError);
});

test("DELETE JSON bodies and invalid JSON object shapes", async () => {
  await withApp(app => {
    app.delete("/", c => c.json(c.body));
    app.post("/", c => c.json(c.body));
  }, async base => {
    const res = await fetch(base, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: '{"id":42}' });
    assert.deepEqual(await res.json(), { id: 42 });
    for (const body of ["[]", "null", "42", '"string"', "{"]) {
      assert.equal((await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body })).status, 400);
    }
  });
});

test("Legacy adapter handles reserved parameter names and enumeration", async () => {
  await withApp(app => {
    app.get("/users/:id", (params, query, body) => ({ id: params.id, q: query.get("q"), body }));
    app.get("/reserved/:json/:params", legacy(params => ({ params, keys: Object.keys(params) })));
  }, async base => {
    assert.deepEqual(await (await fetch(`${base}/users/42?q=yes`)).json(), { id: "42", q: "yes", body: {} });
    assert.deepEqual(await (await fetch(`${base}/reserved/a/b`)).json(), { params: { json: "a", params: "b" }, keys: ["json", "params"] });
  });
});

test("Prototype-like params are captured as ordinary own properties", async () => {
  await withApp(app => {
    app.get("/:__proto__/:constructor", c => c.json(c.params));
  }, async base => {
    assert.deepEqual(await (await fetch(`${base}/safe/name`)).json(), JSON.parse('{"__proto__":"safe","constructor":"name"}'));
  });
});

test("Bodyless status codes suppress response payloads", async () => {
  await withApp(app => {
    app.get("/", c => c.text("must not be sent", 204));
    app.get("/cached", c => c.text("must not be sent", 304));
  }, async base => {
    for (const path of ["/", "/cached"]) {
      const res = await fetch(`${base}${path}`);
      assert.equal(await res.text(), ""); assert.equal(res.headers.get("content-length"), null);
    }
  });
});

test("Reused responses do not leak request headers and middleware preserves their status", async () => {
  await withApp(app => {
    const shared = app.json({ ok: true }, 201);
    app.use(async (c, next) => {
      await next();
      if (c.query.has("header")) c.header("X-Only-Once", "yes");
      if (c.query.has("replace")) c.json({ replaced: true });
    });
    app.get("/", () => shared);
  }, async base => {
    const first = await fetch(`${base}/?header`);
    assert.equal(first.headers.get("x-only-once"), "yes");
    const second = await fetch(base);
    assert.equal(second.headers.get("x-only-once"), null);
    const replaced = await fetch(`${base}/?replace`);
    assert.equal(replaced.status, 201);
    assert.deepEqual(await replaced.json(), { replaced: true });
  });
});

test("Buffered response framing overrides conflicting user headers", async () => {
  await withApp(app => {
    app.get("/", c => c.header("Transfer-Encoding", "chunked").header("Content-Length", "999").text("ok"));
  }, async base => {
    const res = await fetch(base);
    assert.equal(res.headers.get("transfer-encoding"), null);
    assert.equal(res.headers.get("content-length"), "2");
    assert.equal(await res.text(), "ok");
  });
});

test("Unserializable custom error responses fall back to generic 500", async () => {
  await withApp(app => {
    app.get("/", () => { throw new Error("original"); });
    app.onError((_error, c) => c.json({ value: 1n }));
  }, async base => {
    const res = await fetch(base);
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { message: "Internal Server Error" });
  });
});

test("Route Map includes nested prefixes and Trail reports final middleware status", async t => {
  const lines: string[] = [];
  t.mock.method(console, "log", (...args: unknown[]) => lines.push(args.join(" ")));
  await withApp(app => {
    app.group("/users").get("/:id", c => c.json(c.params), "user detail");
    app.printRoutes();
    app.use(async (c, next) => { await next(); c.status(202); });
  }, async base => {
    await fetch(`${base}/users/42?q=test`);
    assert.match(lines.join("\n"), /Komichi Route Map/);
    assert.match(lines.join("\n"), /GET\s+\/users\/:id\s+user detail/);
    assert.match(lines.join("\n"), /Route: \/users\/:id/);
    assert.match(lines.join("\n"), /Params: id="42"/);
    assert.match(lines.join("\n"), /Query: q="test"/);
    assert.match(lines.join("\n"), /Response: 202 JSON/);
  }, { trail: true });
});
