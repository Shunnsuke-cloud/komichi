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

app.listen(3000);