import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

type HandlerResult =
  | Record<string, unknown>
  | string;

type Params = Record<string, string>;

type JsonBody = Record<string, unknown>;

type Handler = (
  params: Params,
  query: URLSearchParams,
  body: JsonBody,
) => HandlerResult | Promise<HandlerResult>;

type Route = {
  method: string;
  path: string;
  handler: Handler;
};

export class Komichi {
  private readonly routes: Route[] = [];

  get(path: string, handler: Handler): void {
    this.routes.push({
      method: "GET",
      path,
      handler,
    });
  }

  post(path: string, handler: Handler): void {
    this.routes.push({
      method: "POST",
      path,
      handler,
    });
  }

  listen(port: number): void {
    const server = createServer(
      async (
        request: IncomingMessage,
        response: ServerResponse,
      ) => {
        await this.handleRequest(request, response);
      },
    );

    server.listen(port, () => {
      console.log(
        `Komichi is running on http://localhost:${port}`,
      );
    });
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const method = request.method ?? "GET";

    const url = new URL(
      request.url ?? "/",
      "http://localhost",
    );

    let matchedRoute: Route | undefined;
    let params: Params = {};

    for (const registeredRoute of this.routes) {
      if (registeredRoute.method !== method) {
        continue;
      }

      const matchedParams = this.matchPath(
        registeredRoute.path,
        url.pathname,
      );

      if (matchedParams !== null) {
        matchedRoute = registeredRoute;
        params = matchedParams;
        break;
      }
    }

    if (!matchedRoute) {
      this.sendJson(response, 404, {
        message: "Route not found",
      });

      return;
    }

    try {
      const body =
        method === "POST"
          ? await this.readJsonBody(request)
          : {};

      const result = await matchedRoute.handler(
        params,
        url.searchParams,
        body,
      );

      if (typeof result === "string") {
        this.sendText(response, 200, result);
        return;
      }

      this.sendJson(response, 200, result);
    } catch (error) {
      console.error(error);

      if (error instanceof BadRequestError) {
        this.sendJson(response, 400, {
          message: error.message,
        });

        return;
      }

      this.sendJson(response, 500, {
        message: "Internal Server Error",
      });
    }
  }

  private matchPath(
    routePath: string,
    requestPath: string,
  ): Params | null {
    const routeParts = routePath
      .split("/")
      .filter((part) => part.length > 0);

    const requestParts = requestPath
      .split("/")
      .filter((part) => part.length > 0);

    if (routeParts.length !== requestParts.length) {
      return null;
    }

    const params: Params = {};

    for (
      let index = 0;
      index < routeParts.length;
      index++
    ) {
      const routePart = routeParts[index];
      const requestPart = requestParts[index];

      if (
        routePart === undefined ||
        requestPart === undefined
      ) {
        return null;
      }

      if (routePart.startsWith(":")) {
        const paramName = routePart.slice(1);

        if (paramName === "") {
          return null;
        }

        try {
          params[paramName] =
            decodeURIComponent(requestPart);
        } catch {
          return null;
        }

        continue;
      }

      if (routePart !== requestPart) {
        return null;
      }
    }

    return params;
  }

  private readJsonBody(
    request: IncomingMessage,
  ): Promise<JsonBody> {
    return new Promise((resolve, reject) => {
      let body = "";

      request.on("data", (chunk) => {
        body += chunk.toString();
      });

      request.on("end", () => {
        if (body.trim() === "") {
          resolve({});
          return;
        }

        try {
          const parsedBody: unknown =
            JSON.parse(body);

          if (
            typeof parsedBody !== "object" ||
            parsedBody === null ||
            Array.isArray(parsedBody)
          ) {
            reject(
              new BadRequestError(
                "JSONボディはオブジェクト形式で送信してください",
              ),
            );

            return;
          }

          resolve(parsedBody as JsonBody);
        } catch (error) {
          if (error instanceof BadRequestError) {
            reject(error);
            return;
          }

          reject(
            new BadRequestError(
              "リクエストボディが正しいJSON形式ではありません",
            ),
          );
        }
      });

      request.on("error", reject);
    });
  }

  private sendJson(
    response: ServerResponse,
    statusCode: number,
    data: unknown,
  ): void {
    response.statusCode = statusCode;

    response.setHeader(
      "Content-Type",
      "application/json; charset=utf-8",
    );

    response.end(JSON.stringify(data));
  }

  private sendText(
    response: ServerResponse,
    statusCode: number,
    data: string,
  ): void {
    response.statusCode = statusCode;

    response.setHeader(
      "Content-Type",
      "text/plain; charset=utf-8",
    );

    response.end(data);
  }
}