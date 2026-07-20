import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

type HandlerResult = Record<string, unknown> | string;

type Handler = () => HandlerResult | Promise<HandlerResult>;

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

    const route = this.routes.find(
      (registeredRoute) =>
        registeredRoute.method === method &&
        registeredRoute.path === url.pathname,
    );

    if (!route) {
      this.sendJson(response, 404, {
        message: "Route not found",
      });

      return;
    }

    try {
      const result = await route.handler();

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