import { Komichi } from "../src/index.js";

const app = new Komichi();

app.get("/", () => {
  return {
    framework: "Komichi",
    message: "Hello Komichi",
  };
});

app.get("/hello", () => {
  return "こんにちは、Komichiです";
});

app.get("/users/:id", (params) => {
  return {
    message: "ユーザー情報を取得しました",
    userId: params.id,
  };
});

app.get("/search", (_params, query) => {
  const keyword = query.get("keyword");
  const page = query.get("page");

  return {
    message: "検索条件を取得しました",
    keyword,
    page,
  };
});

app.post("/users", () => {
  return {
    message: "POSTリクエストを受け取りました",
  };
});

app.listen(3000);