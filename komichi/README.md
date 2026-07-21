# Komichi

Komichiは、Node.jsとTypeScriptで作られた軽量Webフレームワークです。

シンプルなルーティング機能に加えて、ルートの確認や入力ミスの発見を支援する機能を備えています。

## 特徴

- GET・POST・PUT・PATCH・DELETE
- パスパラメータ
- クエリパラメータ
- JSONリクエストボディ
- JSON・Text・HTMLレスポンス
- ステータスコード指定
- 400・404・405・500エラー処理
- Route Map
- 類似ルート提案
- 利用可能なHTTPメソッドの案内
- Komichi Trail
- TypeScript対応
- Node.js標準HTTPモジュールを使用

## インストール

```bash
npm install @shunsuke0429/komichi
```

## 基本的な使い方

```ts
import { Komichi } from "@shunsuke0429/komichi";

const app = new Komichi({
  trail: true,
});

app.get(
  "/",
  () => ({
    message: "Hello Komichi",
  }),
  "トップページ",
);

app.get(
  "/users/:id",
  (params) => ({
    id: params.id,
  }),
  "ユーザー詳細",
);

app.get(
  "/search",
  (_params, query) => ({
    keyword: query.get("keyword"),
    page: query.get("page"),
  }),
  "検索",
);

app.post(
  "/users",
  (_params, _query, body) =>
    app.json(
      {
        message: "ユーザーを作成しました",
        user: body,
      },
      201,
    ),
  "ユーザー作成",
);

app.get(
  "/page",
  () =>
    app.html(
      "<h1>Hello Komichi</h1>",
    ),
  "HTMLページ",
);

app.printRoutes();
app.listen(3000);
```

サーバーを起動したら、次へアクセスします。

```text
http://localhost:3000
```

## レスポンス

### JSON

```ts
app.get(
  "/json",
  () =>
    app.json({
      message: "JSON response",
    }),
);
```

### Text

```ts
app.get(
  "/text",
  () =>
    app.text(
      "Hello Komichi",
    ),
);
```

### HTML

```ts
app.get(
  "/page",
  () =>
    app.html(
      "<h1>Komichi</h1>",
    ),
);
```

### ステータスコード

```ts
app.post(
  "/users",
  () =>
    app.json(
      {
        message: "Created",
      },
      201,
    ),
);
```

## パスパラメータ

```ts
app.get(
  "/users/:id",
  (params) => ({
    id: params.id,
  }),
);
```

次のリクエストでは、`id`に`123`が入ります。

```text
GET /users/123
```

## クエリパラメータ

```ts
app.get(
  "/search",
  (_params, query) => ({
    keyword: query.get("keyword"),
    page: query.get("page"),
  }),
);
```

リクエスト例です。

```text
GET /search?keyword=typescript&page=2
```

## JSONボディ

```ts
app.post(
  "/users",
  (_params, _query, body) => ({
    user: body,
  }),
);
```

リクエスト例です。

```json
{
  "name": "Komichi"
}
```

不正なJSONが送信された場合は、400 Bad Requestを返します。

## Route Map

`printRoutes()`を呼び出すことで、登録済みのルートを一覧表示できます。

```ts
app.printRoutes();
```

表示例です。

```text
Komichi Route Map
------------------------------
GET     /users       ユーザー一覧
GET     /users/:id   ユーザー詳細
POST    /users       ユーザー作成
------------------------------
3 routes registered
```

## Komichi Trail

`trail`を有効にすると、リクエストの処理内容を確認できます。

```ts
const app = new Komichi({
  trail: true,
});
```

表示例です。

```text
Komichi Trail
--------------------------------
GET /search
Route: /search
Query: keyword="typescript", page="2"
Response: 200 JSON
Total: 1ms
--------------------------------
```

## 404の類似ルート提案

存在しないルートへアクセスした場合、登録済みルートから類似候補を返します。

```json
{
  "message": "Route not found",
  "requestedMethod": "GET",
  "requestedPath": "/user",
  "suggestions": [
    {
      "method": "GET",
      "path": "/users",
      "similarity": 0.8
    }
  ]
}
```

## 405のメソッド案内

パスは存在するものの、HTTPメソッドが異なる場合は405を返します。

```json
{
  "message": "Method Not Allowed",
  "requestedMethod": "POST",
  "requestedPath": "/users",
  "allowedMethods": [
    "GET"
  ]
}
```

レスポンスの`Allow`ヘッダーにも、利用可能なメソッドが設定されます。

## 開発

依存関係をインストールします。

```bash
npm install
```

サンプルサーバーを起動します。

```bash
npm run dev
```

ビルドします。

```bash
npm run build
```

テストを実行します。

```bash
npm test
```

## ライセンス

MIT