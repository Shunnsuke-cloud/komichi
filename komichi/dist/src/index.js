import { createServer, } from "node:http";
import { BadRequestError } from "./errors.js";
import { KomichiResponse, } from "./response.js";
import { Router, } from "./router.js";
import { Trail } from "./trail.js";
export class Komichi {
    router = new Router();
    trail;
    constructor(options = {}) {
        this.trail = new Trail(options.trail ?? false);
    }
    get(path, handler, description) {
        this.router.add("GET", path, handler, description);
    }
    post(path, handler, description) {
        this.router.add("POST", path, handler, description);
    }
    put(path, handler, description) {
        this.router.add("PUT", path, handler, description);
    }
    patch(path, handler, description) {
        this.router.add("PATCH", path, handler, description);
    }
    delete(path, handler, description) {
        this.router.add("DELETE", path, handler, description);
    }
    json(data, statusCode = 200) {
        return new KomichiResponse(data, statusCode, "json");
    }
    text(data, statusCode = 200) {
        return new KomichiResponse(data, statusCode, "text");
    }
    html(data, statusCode = 200) {
        return new KomichiResponse(data, statusCode, "html");
    }
    printRoutes() {
        const routes = this.router.list();
        console.log("");
        console.log("Komichi Route Map");
        console.log("------------------------------");
        if (routes.length === 0) {
            console.log("登録されているルートはありません");
            console.log("");
            return;
        }
        const methodWidth = Math.max(...routes.map((route) => route.method.length), 6);
        const pathWidth = Math.max(...routes.map((route) => route.path.length), 4);
        for (const route of routes) {
            const method = route.method.padEnd(methodWidth);
            const path = route.path.padEnd(pathWidth);
            const description = route.description
                ? `  ${route.description}`
                : "";
            console.log(`${method}  ${path}${description}`);
        }
        console.log("------------------------------");
        console.log(`${routes.length} routes registered`);
        console.log("");
    }
    listen(port) {
        const server = createServer(async (request, response) => {
            await this.handleRequest(request, response);
        });
        server.listen(port, () => {
            console.log(`Komichi is running on http://localhost:${port}`);
        });
    }
    async handleRequest(request, response) {
        const startedAt = Date.now();
        const method = request.method ?? "GET";
        const url = new URL(request.url ?? "/", "http://localhost");
        const matched = this.router.find(method, url.pathname);
        const matchedRoute = matched?.route;
        const params = matched?.params ?? {};
        if (!matchedRoute) {
            const allowedMethods = this.router.findAllowedMethods(url.pathname);
            if (allowedMethods.length > 0) {
                response.setHeader("Allow", allowedMethods.join(", "));
                this.trail.print({
                    method,
                    requestedPath: url.pathname,
                    query: url.searchParams,
                    statusCode: 405,
                    responseType: "json",
                    startedAt,
                });
                this.sendJson(response, 405, {
                    message: "Method Not Allowed",
                    requestedMethod: method,
                    requestedPath: url.pathname,
                    allowedMethods,
                });
                return;
            }
            const suggestions = this.router.findSuggestions(method, url.pathname);
            this.trail.print({
                method,
                requestedPath: url.pathname,
                query: url.searchParams,
                statusCode: 404,
                responseType: "json",
                startedAt,
            });
            this.sendJson(response, 404, {
                message: "Route not found",
                requestedMethod: method,
                requestedPath: url.pathname,
                suggestions: suggestions.map((suggestion) => ({
                    method: suggestion.method,
                    path: suggestion.path,
                    similarity: Number(suggestion.score.toFixed(2)),
                })),
            });
            return;
        }
        try {
            const methodsWithBody = [
                "POST",
                "PUT",
                "PATCH",
            ];
            const body = methodsWithBody.includes(method)
                ? await this.readJsonBody(request)
                : {};
            const result = await matchedRoute.handler(params, url.searchParams, body);
            if (result instanceof
                KomichiResponse) {
                this.trail.print({
                    method,
                    requestedPath: url.pathname,
                    matchedPath: matchedRoute.path,
                    params,
                    query: url.searchParams,
                    statusCode: result.statusCode,
                    responseType: result.type,
                    startedAt,
                });
                if (result.type === "text") {
                    this.sendText(response, result.statusCode, String(result.body));
                    return;
                }
                if (result.type === "html") {
                    this.sendHtml(response, result.statusCode, String(result.body));
                    return;
                }
                this.sendJson(response, result.statusCode, result.body);
                return;
            }
            if (typeof result === "string") {
                this.trail.print({
                    method,
                    requestedPath: url.pathname,
                    matchedPath: matchedRoute.path,
                    params,
                    query: url.searchParams,
                    statusCode: 200,
                    responseType: "text",
                    startedAt,
                });
                this.sendText(response, 200, result);
                return;
            }
            this.trail.print({
                method,
                requestedPath: url.pathname,
                matchedPath: matchedRoute.path,
                params,
                query: url.searchParams,
                statusCode: 200,
                responseType: "json",
                startedAt,
            });
            this.sendJson(response, 200, result);
        }
        catch (error) {
            console.error(error);
            if (error instanceof
                BadRequestError) {
                this.trail.print({
                    method,
                    requestedPath: url.pathname,
                    matchedPath: matchedRoute.path,
                    params,
                    query: url.searchParams,
                    statusCode: 400,
                    responseType: "json",
                    startedAt,
                });
                this.sendJson(response, 400, {
                    message: error.message,
                });
                return;
            }
            this.trail.print({
                method,
                requestedPath: url.pathname,
                matchedPath: matchedRoute.path,
                params,
                query: url.searchParams,
                statusCode: 500,
                responseType: "json",
                startedAt,
            });
            this.sendJson(response, 500, {
                message: "Internal Server Error",
            });
        }
    }
    readJsonBody(request) {
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
                    const parsedBody = JSON.parse(body);
                    if (typeof parsedBody !==
                        "object" ||
                        parsedBody === null ||
                        Array.isArray(parsedBody)) {
                        reject(new BadRequestError("JSONボディはオブジェクト形式で送信してください"));
                        return;
                    }
                    resolve(parsedBody);
                }
                catch (error) {
                    if (error instanceof
                        BadRequestError) {
                        reject(error);
                        return;
                    }
                    reject(new BadRequestError("リクエストボディが正しいJSON形式ではありません"));
                }
            });
            request.on("error", reject);
        });
    }
    sendJson(response, statusCode, data) {
        response.statusCode =
            statusCode;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(JSON.stringify(data));
    }
    sendText(response, statusCode, data) {
        response.statusCode =
            statusCode;
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end(data);
    }
    sendHtml(response, statusCode, data) {
        response.statusCode =
            statusCode;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(data);
    }
}
export { KomichiResponse, } from "./response.js";
export { BadRequestError, } from "./errors.js";
export { Router, } from "./router.js";
export { Trail, } from "./trail.js";
