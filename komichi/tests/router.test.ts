import assert from "node:assert/strict";
import test from "node:test";

import { Router } from "../src/router.js";

type TestHandler = () => string;

test(
  "固定ルートを検索できる",
  () => {
    const router =
      new Router<TestHandler>();

    const handler = () => "hello";

    router.add(
      "GET",
      "/hello",
      handler,
      "挨拶を返す",
    );

    const matched = router.find(
      "GET",
      "/hello",
    );

    assert.notEqual(
      matched,
      null,
    );

    assert.equal(
      matched?.route.path,
      "/hello",
    );

    assert.equal(
      matched?.route.method,
      "GET",
    );

    assert.deepEqual(
      matched?.params,
      {},
    );
  },
);

test(
  "パスパラメータを取得できる",
  () => {
    const router =
      new Router<TestHandler>();

    router.add(
      "GET",
      "/users/:id",
      () => "user",
    );

    const matched = router.find(
      "GET",
      "/users/123",
    );

    assert.notEqual(
      matched,
      null,
    );

    assert.deepEqual(
      matched?.params,
      {
        id: "123",
      },
    );
  },
);

test(
  "HTTPメソッドが違う場合は一致しない",
  () => {
    const router =
      new Router<TestHandler>();

    router.add(
      "GET",
      "/users",
      () => "users",
    );

    const matched = router.find(
      "POST",
      "/users",
    );

    assert.equal(
      matched,
      null,
    );
  },
);

test(
  "利用可能なHTTPメソッドを取得できる",
  () => {
    const router =
      new Router<TestHandler>();

    router.add(
      "GET",
      "/users",
      () => "get users",
    );

    router.add(
      "POST",
      "/users",
      () => "create user",
    );

    const methods =
      router.findAllowedMethods(
        "/users",
      );

    assert.deepEqual(
      methods,
      [
        "GET",
        "POST",
      ],
    );
  },
);

test(
  "存在しないルートに類似候補を返す",
  () => {
    const router =
      new Router<TestHandler>();

    router.add(
      "GET",
      "/users",
      () => "users",
    );

    router.add(
      "GET",
      "/products",
      () => "products",
    );

    const suggestions =
      router.findSuggestions(
        "GET",
        "/user",
      );

    assert.ok(
      suggestions.length > 0,
    );

    assert.equal(
      suggestions[0]?.path,
      "/users",
    );
  },
);