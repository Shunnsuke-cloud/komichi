// Compiled by npm run typecheck; @ts-expect-error asserts rejected API usage.
import { Komichi, legacy, type Context, type PathParams, type JoinPath } from "../src/index.js";
const app = new Komichi();
app.get("/users/:userId/posts/:postId", c => {
  const userId: string = c.params.userId;
  const postId: string = c.params.postId;
  // @ts-expect-error unknown path parameter
  c.params.foo;
  return c.json({ userId, postId });
});
app.get("/health", c => {
  // @ts-expect-error static routes have no params
  c.params.id;
  return c.text("ok");
});
app.group("/teams/:teamId/").group("/users").get("/:userId/", c => {
  const team: string = c.params.teamId;
  const user: string = c.params.userId;
  // @ts-expect-error group params remain strict
  c.params.foo;
  return { team, user };
});
app.post("/users/:id", (params, query, body) => ({ id: params.id, query: query.get("q"), body }));
app.get("/users/:id", legacy(params => ({ params })));
app.get("/context/:id", (c: Context<"/context/:id">) => c.json(c.params));
const dynamicPath: string = "/anything";
app.get(dynamicPath, c => c.json({ value: c.params.anyName }));
const rootJoin: JoinPath<"", "/users/"> = "/users";
const groupJoin: JoinPath<"/teams/", "/users/"> = "/teams/users";
const params: PathParams<"/:one/:two"> = { one: "1", two: "2" };
void [rootJoin, groupJoin, params];
