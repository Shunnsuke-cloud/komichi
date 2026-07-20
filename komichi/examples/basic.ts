import { Komichi } from "../src/index.js";

const app = new Komichi();

app.get(
  "/",
  () => {
    return {
      framework: "Komichi",
      message: "Hello Komichi",
    };
  },
  "Komichiの基本情報",
);

app.get(
  "/hello",
  () => {
    return "こんにちは、Komichiです";
  },
  "挨拶を表示",
);

app.get(
  "/users/:id",
  (params) => {
    return {
      message: "ユーザー情報を取得しました",
      userId: params.id,
    };
  },
  "ユーザー詳細を取得",
);

app.post(
  "/users",
  (_params, _query, body) => {
    return app.json(
      {
        message: "ユーザー情報を受け取りました",
        name: body.name,
        email: body.email,
      },
      201,
    );
  },
  "ユーザーを登録",
);

app.get(
  "/search",
  (_params, query) => {
    const keyword = query.get("keyword");
    const page = query.get("page");

    return {
      message: "検索条件を取得しました",
      keyword,
      page,
    };
  },
  "検索条件を取得",
);

app.put(
  "/users/:id",
  (params, _query, body) => {
    return {
      message: "ユーザー情報を更新しました",
      userId: params.id,
      name: body.name,
      email: body.email,
    };
  },
  "ユーザー情報を更新",
);

app.patch(
  "/users/:id",
  (params, _query, body) => {
    return {
      message: "ユーザー情報を一部更新しました",
      userId: params.id,
      updatedData: body,
    };
  },
  "ユーザー情報を一部更新",
);

app.delete(
  "/users/:id",
  (params) => {
    return {
      message: "ユーザーを削除しました",
      userId: params.id,
    };
  },
  "ユーザーを削除",
);

app.printRoutes();

app.listen(3000);