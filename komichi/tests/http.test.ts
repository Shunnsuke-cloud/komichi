import assert from "node:assert/strict";
import test from "node:test";

import { Komichi } from "../src/index.js";

function getAvailablePort(): number {
  return 3100 + Math.floor(Math.random() * 500);
}

test(
  "不正なJSONボディが400を返す",
  async () => {
    const port = getAvailablePort();
    const app = new Komichi();

    app.post(
      "/users",
      (_params, _query, body) => ({
        body,
      }),
    );

    const server = app.listen(port);

    try {
      const response = await fetch(
        `http://localhost:${port}/users`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: '{"name":"test",}',
        },
      );

      assert.equal(
        response.status,
        400,
      );

      const body = await response.json();

      assert.equal(
        body.message,
        "リクエストボディが正しいJSON形式ではありません",
      );
    } finally {
      server.close();
    }
  },
);

test(
  "JSONレスポンスを返せる",
  async () => {
    const port = getAvailablePort();
    const app = new Komichi();

    app.get(
      "/json",
      () =>
        app.json(
          {
            message: "json response",
          },
          201,
        ),
    );

    const server = app.listen(port);

    try {
      const response = await fetch(
        `http://localhost:${port}/json`,
      );

      assert.equal(
        response.status,
        201,
      );

      assert.match(
        response.headers.get(
          "content-type",
        ) ?? "",
        /application\/json/,
      );

      const body = await response.json();

      assert.deepEqual(
        body,
        {
          message: "json response",
        },
      );
    } finally {
      server.close();
    }
  },
);

test(
  "Textレスポンスを返せる",
  async () => {
    const port = getAvailablePort();
    const app = new Komichi();

    app.get(
      "/text",
      () =>
        app.text(
          "Hello Komichi",
        ),
    );

    const server = app.listen(port);

    try {
      const response = await fetch(
        `http://localhost:${port}/text`,
      );

      assert.equal(
        response.status,
        200,
      );

      assert.match(
        response.headers.get(
          "content-type",
        ) ?? "",
        /text\/plain/,
      );

      const body = await response.text();

      assert.equal(
        body,
        "Hello Komichi",
      );
    } finally {
      server.close();
    }
  },
);

test(
  "HTMLレスポンスを返せる",
  async () => {
    const port = getAvailablePort();
    const app = new Komichi();

    app.get(
      "/page",
      () =>
        app.html(
          "<h1>Komichi</h1>",
        ),
    );

    const server = app.listen(port);

    try {
      const response = await fetch(
        `http://localhost:${port}/page`,
      );

      assert.equal(
        response.status,
        200,
      );

      assert.match(
        response.headers.get(
          "content-type",
        ) ?? "",
        /text\/html/,
      );

      const body = await response.text();

      assert.equal(
        body,
        "<h1>Komichi</h1>",
      );
    } finally {
      server.close();
    }
  },
);

test(
  "パスパラメータをハンドラーへ渡せる",
  async () => {
    const port = getAvailablePort();
    const app = new Komichi();

    app.get(
      "/users/:id",
      (params) => ({
        id: params.id,
      }),
    );

    const server = app.listen(port);

    try {
      const response = await fetch(
        `http://localhost:${port}/users/123`,
      );

      assert.equal(
        response.status,
        200,
      );

      const body = await response.json();

      assert.deepEqual(
        body,
        {
          id: "123",
        },
      );
    } finally {
      server.close();
    }
  },
);

test(
  "クエリパラメータをハンドラーへ渡せる",
  async () => {
    const port = getAvailablePort();
    const app = new Komichi();

    app.get(
      "/search",
      (_params, query) => ({
        keyword:
          query.get("keyword"),
        page:
          query.get("page"),
      }),
    );

    const server = app.listen(port);

    try {
      const response = await fetch(
        `http://localhost:${port}/search?keyword=typescript&page=2`,
      );

      assert.equal(
        response.status,
        200,
      );

      const body = await response.json();

      assert.deepEqual(
        body,
        {
          keyword: "typescript",
          page: "2",
        },
      );
    } finally {
      server.close();
    }
  },
);