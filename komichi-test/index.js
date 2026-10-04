import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { Komichi } from "@shunsuke0429/komichi";

test("package exports serve a Context handler", async () => {
  const app = new Komichi();
  app.get("/users/:id", c => c.json({ id: c.params.id }));
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  try {
    const response = await fetch(`http://localhost:${address.port}/users/123`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: "123" });
  } finally {
    const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closed;
  }
});
