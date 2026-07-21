import { Komichi } from "komichi";

const app = new Komichi({
  trail: true,
});

app.get(
  "/",
  () => ({
    message: "Komichi package test",
  }),
);

app.get(
  "/users/:id",
  (params) => ({
    id: params.id,
  }),
);

app.printRoutes();
app.listen(3000);