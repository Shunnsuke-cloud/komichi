# Komichi

**API開発で迷わないための、道案内付きTypeScript Webフレームワーク。**

KomichiはNode.js標準HTTPモジュールで動く、実行時の外部依存を持たない軽量フレームワークです。ExpressやHonoのAPIを再現することよりも、ルートの確認、入力ミスの発見、エラーの理解を助けるDeveloper Experienceを大切にしています。

- **Route Guide**：404で候補、パス差分、類似度を案内。
- **Route Map / Komichi Trail**：登録ルートとリクエストの処理経路を確認。
- **型安全なContext**：パス文字列からparamsを推論。Middleware、Group、HTTPの基本機能も小さなAPIで扱えます。

## Quick Start

Node.js 18以上を使用してください。

```bash
npm install @shunsuke0429/komichi
npm install --save-dev typescript tsx @types/node
```

`app.ts`を作ります。

```ts
import { Komichi } from "@shunsuke0429/komichi";

const app = new Komichi({ trail: true });
app.get("/", c => c.text("Hello Komichi"));
app.get("/users/:id", c => c.json({ id: c.params.id }));
app.printRoutes();
app.listen(3000);
```

```bash
npx tsx app.ts
curl http://localhost:3000/users/123
```

## Context API

Contextはリクエストごとの情報・レスポンス設定を管理します。KomichiResponseはbody、statusCode、type、headersを持つ返却データです。送信はMiddlewareの後処理が完了してから行います。

```ts
app.post("/users", c => {
  const keyword = c.query.get("keyword"); // URLSearchParams
  const method = c.req.method;           // Node IncomingMessage
  return c.status(201).header("X-Komichi", "guide").json({
    user: c.body, keyword, method,
  });
});
```

| API | 用途 |
| --- | --- |
| `c.params` | パスパラメータ。値はデコードされたstring |
| `c.query` | `URLSearchParams`。複数値は`getAll()` |
| `c.body` | JSONオブジェクト。空bodyは`{}`、値の型はunknown |
| `c.req` | Node.jsの生リクエスト |
| `c.json(data, status?)` | JSONレスポンス |
| `c.text(text, status?)` / `c.html(html, status?)` | Text / HTMLレスポンス |
| `c.status(code)` / `c.header(name, value)` | ステータス・ヘッダー設定。後処理でも変更可能 |
| `c.redirect(path, status?)` | Redirect。既定302、301/303/307/308も対応 |
| `c.cookie(name)` | リクエストCookieの取得 |
| `c.cookie(name, value, options?)` | Set-Cookieを追加 |

```ts
app.get("/session", c => {
  const previous = c.cookie("session");
  c.cookie("session", "example", {
    httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 3600,
  });
  return c.json({ previous: previous ?? null });
});
```

Cookieは複数追加でき、`domain`と`expires`も指定できます。削除は同じpath/domainで`maxAge: 0`を設定します。Cookieの署名や暗号化は含みません。オブジェクト・文字列の直接returnも引き続き使えます。

## Middleware

```ts
app.use(async (c, next) => {
  const start = Date.now();
  await next();
  c.header("X-Response-Time", `${Date.now() - start}ms`);
});

app.use(async (c, next) => {
  if (!c.req.headers.authorization) {
    return c.json({ message: "Unauthorized" }, 401);
  }
  await next();
});
```

登録順に前処理を実行し、後処理は逆順です。`await next()`で後続の完了を待ち、呼ばなければ処理を打ち切ります。`next()`は1回だけ呼べます。エラーは呼び出し元Middlewareへ伝播し、未処理なら`onError`へ進みます。logger、CORS、auth、request IDなどの共通処理を追加できます。

Middlewareはアプリ全体に適用され、404/405と自動OPTIONSにも実行されます。マッチしたルートのJSON解析はMiddlewareの前に行うので、前処理から`c.body`を参照できます。JSON解析エラーは直接`onError`へ渡ります。レスポンスを作らず終了した場合は204です。

## Routing / 型安全Path Params

```ts
app.get("/users/:userId/posts/:postId", c => {
  const userId: string = c.params.userId;
  const postId: string = c.params.postId;
  // c.params.foo はTypeScriptエラー
  return c.json({ userId, postId });
});
```

`get` / `post` / `put` / `patch` / `delete` / `head` / `options`に対応します。パス文字列リテラルからparamsを推論するため、利用者の型定義は不要です。動的なstring変数のパスでは`Record<string, string>`になります。パラメータはセグメント全体を`:name`にします。ワイルドカード・任意パラメータは未対応です。

ルートは登録順に評価します。固定ルートを動的ルートより優先させたい場合は先に登録してください。末尾・連続スラッシュは同一視し、同じMethod・パスの再登録は例外になります。`/users/:id`と`/users/:name`のような同一形状も重複です。第3引数にはRoute Map用の説明を指定できます。

HEADは明示登録を優先し、未登録ならGETを実行してbodyを送信しません。既存パスへのOPTIONSは未登録なら204とAllowヘッダーを返します。Method違いは405とAllowを返します。自動OPTIONSはCORSヘッダーを付けません。

## Route Group

```ts
const users = app.group("/users");
users.get("/", c => c.json({ users: [] }));
users.get("/:id", c => c.json({ id: c.params.id }));
users.post("/", c => c.json(c.body, 201));

users.group("/:userId/posts").get("/:postId", c => {
  return c.json({ userId: c.params.userId, postId: c.params.postId });
});
```

Groupは共通RouterにPrefix付きルートを登録します。ネストと親Prefixのparams推論に対応します。Group専用Middlewareは未実装です。

## Error Handling / 入力制限

```ts
import { KomichiError } from "@shunsuke0429/komichi";

app.get("/missing-user", () => {
  throw new KomichiError(404, "User not found");
});

app.onError((error, c) => {
  if (error instanceof KomichiError && error.statusCode < 500) {
    return c.json({ message: error.message }, error.statusCode);
  }
  console.error(error);
  return c.json({ message: "Internal Server Error" }, 500);
});

// 設定すると標準Route Guideの代わりに使用します。
app.notFound(c => c.json({ message: "Page not found" }, 404));
```

`BadRequestError`は400のKomichiErrorとして引き続き使えます。標準エラー処理では4xxのメッセージを返し、5xxの内部情報はクライアントに公開しません。独自`onError`でも内部情報を隠してください。独自ハンドラーの失敗は汎用500にフォールバックします。通常の未登録ルートは`notFound`、throwされた404は`onError`が担当します。

```ts
const limited = new Komichi({ bodyLimit: 1024 * 1024 }); // bytes、既定1MiB
```

マッチしたルートのbodyを全Methodで解析します。JSONはオブジェクトのみ受け付け、不正JSON・配列・nullは400、上限超過は413、非空bodyに明示された非JSON Content-Typeは415です。`application/json`と`application/*+json`に対応します。互換性のためContent-Type未指定のJSONも受け付けます。チャンク送信でもバイト数を検査します。

## Route Guide

`GET /user/123`に対して`GET /users/:id`が登録されている場合：

```json
{
  "message": "Route not found",
  "requestedMethod": "GET",
  "requestedPath": "/user/123",
  "closestRoute": {
    "method": "GET",
    "path": "/users/:id",
    "differences": [{ "segment": 1, "from": "user", "to": "users" }],
    "similarity": 0.9,
    "similarityPercent": 90
  },
  "suggestions": [{"method":"GET","path":"/users/:id","differences":[{"segment":1,"from":"user","to":"users"}],"similarity":0.9,"similarityPercent":90}],
  "hint": "Did you mean one of these routes?"
}
```

`suggestions`には`closestRoute`と同じ形式の候補を最大3件返します。同じHTTP Methodを優先し、セグメントの編集距離を基に類似度を計算します。動的パラメータは一致として扱い、差分に含めません。候補閾値は45%、候補がなければ`closestRoute: null`と空配列です。診断の計算量を抑えるため各セグメントの比較は先頭256文字までです。

公開環境でルート情報の案内が不要な場合は`new Komichi({ routeGuide: false })`で無効化できます。

## Route Map / Komichi Trail

`app.printRoutes()`でMethod、パス、説明を一覧表示します。

```text
Komichi Route Map
------------------------------
GET     /users       ユーザー一覧
GET     /users/:id   ユーザー詳細
POST    /users       ユーザー登録
------------------------------
3 routes registered
```

`new Komichi({ trail: true })`でリクエストの処理経路を表示します。

```text
Komichi Trail
--------------------------------
GET /users/123
Route: /users/:id
Params: id="123"
Response: 200 JSON
Total: 1ms
--------------------------------
```

クエリ、404/405、エラー、Middleware終了後の最終ステータスも確認できます。Trailは既定で無効です。

## 既存APIからの移行

`app.json/text/html()`、オブジェクト・文字列のreturn、`(params, query, body)`、`params.id`形式を維持しています。新規コードではContextを推奨します。

旧paramsオブジェクトの列挙・直接returnや、`json` / `params` / `body`などContextと衝突するパラメータ名は明示的なアダプターを使用してください。

```ts
import { legacy } from "@shunsuke0429/komichi";
app.get("/users/:id", legacy((params, query, body) => ({ params })));
```

動作変更：重複登録は例外、明示的な非JSON Content-Typeは415、既定1MiB超は413、Allowには自動HEAD/OPTIONSも含まれます。これらはミスの発見とHTTP対応のための変更です。

## 開発・テスト

リポジトリの実装は`komichi/`、パッケージ経由の確認は`komichi-test/`にあります。

```bash
cd komichi
npm ci
npm test          # 型推論の検証 + node:test（tsx経由）
npm run build    # distへJavaScriptと型定義を生成
npm run dev      # Context / Group / Cookie / Redirectのサンプル
npm pack         # prepackでビルドして配布用tgzを生成
```

```bash
cd ../komichi-test
npm ci
npm test         # ローカルパッケージのexports経由でHTTP確認
```

`src/`はContext、Router、Middleware、Response、Error、Guide、Body、Group、Handler、Trailに責務を分離しています。実行時依存はゼロです。`node_modules`、`dist`、tgz、環境変数ファイル、coverageはGitの追跡対象にしません。

## License

MIT
