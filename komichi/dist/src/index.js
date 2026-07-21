"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Router = exports.BadRequestError = exports.KomichiResponse = exports.Komichi = void 0;
const node_http_1 = require("node:http");
const errors_js_1 = require("./errors.js");
const response_js_1 = require("./response.js");
const router_js_1 = require("./router.js");
class Komichi {
    router = new router_js_1.Router();
    trailEnabled;
    constructor(options = {}) {
        this.trailEnabled =
            options.trail ?? false;
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
        return new response_js_1.KomichiResponse(data, statusCode, "json");
    }
    text(data, statusCode = 200) {
        return new response_js_1.KomichiResponse(data, statusCode, "text");
    }
    html(data, statusCode = 200) {
        return new response_js_1.KomichiResponse(data, statusCode, "html");
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
        const server = (0, node_http_1.createServer)(async (request, response) => {
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
                this.printTrail({
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
            this.printTrail({
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
                response_js_1.KomichiResponse) {
                this.printTrail({
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
                this.printTrail({
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
            this.printTrail({
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
                errors_js_1.BadRequestError) {
                this.printTrail({
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
            this.printTrail({
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
    printTrail(info) {
        if (!this.trailEnabled) {
            return;
        }
        const elapsedTime = Date.now() - info.startedAt;
        console.log("");
        console.log("Komichi Trail");
        console.log("--------------------------------");
        console.log(`${info.method} ${info.requestedPath}`);
        if (info.matchedPath) {
            console.log(`Route: ${info.matchedPath}`);
        }
        else {
            console.log("Route: Not matched");
        }
        if (info.params &&
            Object.keys(info.params).length >
                0) {
            const formattedParams = Object.entries(info.params)
                .map(([name, value]) => `${name}="${value}"`)
                .join(", ");
            console.log(`Params: ${formattedParams}`);
        }
        if (info.query &&
            [...info.query.entries()]
                .length > 0) {
            const formattedQuery = [
                ...info.query.entries(),
            ]
                .map(([name, value]) => `${name}="${value}"`)
                .join(", ");
            console.log(`Query: ${formattedQuery}`);
        }
        console.log(`Response: ${info.statusCode} ${info.responseType.toUpperCase()}`);
        console.log(`Total: ${elapsedTime}ms`);
        console.log("--------------------------------");
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
                        reject(new errors_js_1.BadRequestError("JSONボディはオブジェクト形式で送信してください"));
                        return;
                    }
                    resolve(parsedBody);
                }
                catch (error) {
                    if (error instanceof
                        errors_js_1.BadRequestError) {
                        reject(error);
                        return;
                    }
                    reject(new errors_js_1.BadRequestError("リクエストボディが正しいJSON形式ではありません"));
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
exports.Komichi = Komichi;
var response_js_2 = require("./response.js");
Object.defineProperty(exports, "KomichiResponse", { enumerable: true, get: function () { return response_js_2.KomichiResponse; } });
var errors_js_2 = require("./errors.js");
Object.defineProperty(exports, "BadRequestError", { enumerable: true, get: function () { return errors_js_2.BadRequestError; } });
var router_js_2 = require("./router.js");
Object.defineProperty(exports, "Router", { enumerable: true, get: function () { return router_js_2.Router; } });
