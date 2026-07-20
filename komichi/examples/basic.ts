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
    return {
      message: "ユーザー情報を受け取りました",
      name: body.name,
      email: body.email,
    };
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

app.printRoutes();

app.listen(3000);