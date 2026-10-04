import { Komichi, KomichiError } from "../src/index.js";

const app = new Komichi({ trail: true, bodyLimit: 1024 * 1024 });

app.use(async (c, next) => {
  const start = Date.now();
  await next();
  c.header("X-Response-Time", `${Date.now() - start}ms`);
});

app.get("/", c => c.json({ framework: "Komichi", message: "Hello Komichi" }), "Komichiの基本情報");

const users = app.group("/users");
users.get("/", c => c.json({ users: [] }), "ユーザー一覧");
users.get("/:id", c => {
  if (c.params.id === "missing") throw new KomichiError(404, "User not found");
  return c.json({ id: c.params.id });
}, "ユーザー詳細");
users.post("/", c => c.json({ user: c.body }, 201), "ユーザー登録");
users.put("/:id", c => c.json({ id: c.params.id, user: c.body }));
users.patch("/:id", c => c.json({ id: c.params.id, updates: c.body }));
users.delete("/:id", c => c.text("", 204));
users.group("/:id/posts").get("/:postId", c => c.json({ userId: c.params.id, postId: c.params.postId }));

app.get("/search", c => c.json({ keyword: c.query.get("keyword"), page: c.query.get("page") }));
app.get("/hello", c => c.text("こんにちは、Komichiです"));
app.get("/page", c => c.html("<h1>Komichi</h1>"));
app.get("/old", c => c.redirect("/users", 307));
app.get("/cookie", c => {
  const previous = c.cookie("visitor");
  c.cookie("visitor", "Komichi", { httpOnly: true, sameSite: "Lax" });
  return c.json({ previous: previous ?? null });
});

app.printRoutes();
app.listen(3000);
