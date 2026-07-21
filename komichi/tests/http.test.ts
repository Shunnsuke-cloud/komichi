import assert from "node:assert/strict";
import test from "node:test";

import { Komichi } from "../src/index.js";

function getAvailablePort(): number {
  return 3100 + Math.floor(Math.random() * 500);
}

test(
  "GETルートが200を返す",
  async () => {
    const port = getAvailablePort();
    const app = new Komichi();

    app.get(
      "/hello",
      () => ({
        message: "hello",
      }),
    );

    const server = app.listen(port);

    try {
      const response = await fetch(
        `http://localhost:${port}/hello`,
      );

      assert.equal(
        response.status,
        200,
      );

      const body = await response.json();

      assert.deepEqual(
        body,
        {
          message: "hello",
        },
      );
    } finally {
      server.close();
    }
  },
);

test(
  "存在しないルートが404を返す",
  async () => {
    const port = getAvailablePort();
    const app = new Komichi();

    app.get(
      "/users",
      () => ({
        users: [],
      }),
    );

    const server = app.listen(port);

    try {
      const response = await fetch(
        `http://localhost:${port}/user`,
      );

      assert.equal(
        response.status,
        404,
      );

      const body = await response.json();

      assert.equal(
        body.message,
        "Route not found",
      );
    } finally {
      server.close();
    }
  },
);

test(
  "HTTPメソッドが違う場合は405を返す",
  async () => {
    const port = getAvailablePort();
    const app = new Komichi();

    app.get(
      "/users",
      () => ({
        users: [],
      }),
    );

    const server = app.listen(port);

    try {
      const response = await fetch(
        `http://localhost:${port}/users`,
        {
          method: "POST",
        },
      );

      assert.equal(
        response.status,
        405,
      );

      assert.equal(
        response.headers.get("allow"),
        "GET",
      );

      const body = await response.json();

      assert.equal(
        body.message,
        "Method Not Allowed",
      );
    } finally {
      server.close();
    }
  },
);