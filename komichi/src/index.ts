import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

type HandlerResult = Record<string, unknown> | string;


type Params = Record<string, string>;

type Handler = (
  params: Params,
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
      const result = await matchedRoute.handler(params);

      if (typeof result === "string") {
        this.sendText(response, 200, result);
        return;
      }

      this.sendJson(response, 200, result);
    } catch (error) {
      console.error(error);

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

  for (let index = 0; index < routeParts.length; index++) {
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

      params[paramName] = decodeURIComponent(requestPart);
      continue;
    }

    if (routePart !== requestPart) {
      return null;
    }
  }

  return params;
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