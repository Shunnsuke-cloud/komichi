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

app.listen(3000);