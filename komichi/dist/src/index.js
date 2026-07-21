"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BadRequestError = exports.KomichiResponse = exports.Komichi = void 0;
const node_http_1 = require("node:http");
const response_js_1 = require("./response.js");
const errors_js_1 = require("./errors.js");
class Komichi {
    routes = [];
    trailEnabled;
    constructor(options = {}) {
        this.trailEnabled = options.trail ?? false;
    }
    get(path, handler, description) {
        this.routes.push({
            method: "GET",
            path,
            handler,
            description,
        });
    }
    post(path, handler, description) {
        this.routes.push({
            method: "POST",
            path,
            handler,
            description,
        });
    }
    put(path, handler, description) {
        this.routes.push({
            method: "PUT",
            path,
            handler,
            description,
        });
    }
    patch(path, handler, description) {
        this.routes.push({
            method: "PATCH",
            path,
            handler,
            description,
        });
    }
    delete(path, handler, description) {
        this.routes.push({
            method: "DELETE",
            path,
            handler,
            description,
        });
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
        console.log("");
        console.log("Komichi Route Map");
        console.log("------------------------------");
        if (this.routes.length === 0) {
            console.log("登録されているルートはありません");
            console.log("");
            return;
        }
        const methodWidth = Math.max(...this.routes.map((route) => route.method.length), 6);
        const pathWidth = Math.max(...this.routes.map((route) => route.path.length), 4);
        for (const route of this.routes) {
            const method = route.method.padEnd(methodWidth);
            const path = route.path.padEnd(pathWidth);
            const description = route.description
                ? `  ${route.description}`
                : "";
            console.log(`${method}  ${path}${description}`);
        }
        console.log("------------------------------");
        console.log(`${this.routes.length} routes registered`);
        console.log("");
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
            Object.keys(info.params).length > 0) {
            const formattedParams = Object.entries(info.params)
                .map(([name, value]) => `${name}="${value}"`)
                .join(", ");
            console.log(`Params: ${formattedParams}`);
        }
        if (info.query &&
            [...info.query.entries()].length > 0) {
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
        let matchedRoute;
        let params = {};
        for (const registeredRoute of this.routes) {
            if (registeredRoute.method !== method) {
                continue;
            }
            const matchedParams = this.matchPath(registeredRoute.path, url.pathname);
            if (matchedParams !== null) {
                matchedRoute = registeredRoute;
                params = matchedParams;
                break;
            }
        }
        if (!matchedRoute) {
            const allowedMethods = this.findAllowedMethods(url.pathname);
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
            const suggestions = this.findRouteSuggestions(method, url.pathname);
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
            if (result instanceof response_js_1.KomichiResponse) {
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
            if (error instanceof errors_js_1.BadRequestError) {
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
    matchPath(routePath, requestPath) {
        const routeParts = routePath
            .split("/")
            .filter((part) => part.length > 0);
        const requestParts = requestPath
            .split("/")
            .filter((part) => part.length > 0);
        if (routeParts.length !==
            requestParts.length) {
            return null;
        }
        const params = {};
        for (let index = 0; index < routeParts.length; index++) {
            const routePart = routeParts[index];
            const requestPart = requestParts[index];
            if (routePart === undefined ||
                requestPart === undefined) {
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
                }
                catch {
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
    findAllowedMethods(requestPath) {
        const allowedMethods = [];
        for (const registeredRoute of this.routes) {
            const matchedParams = this.matchPath(registeredRoute.path, requestPath);
            if (matchedParams !== null) {
                allowedMethods.push(registeredRoute.method);
            }
        }
        return [...new Set(allowedMethods)];
    }
    calculateDistance(left, right) {
        const rows = left.length + 1;
        const columns = right.length + 1;
        const matrix = Array.from({ length: rows }, () => Array(columns).fill(0));
        for (let row = 0; row < rows; row++) {
            matrix[row][0] = row;
        }
        for (let column = 0; column < columns; column++) {
            matrix[0][column] = column;
        }
        for (let row = 1; row < rows; row++) {
            for (let column = 1; column < columns; column++) {
                const cost = left[row - 1] ===
                    right[column - 1]
                    ? 0
                    : 1;
                matrix[row][column] =
                    Math.min(matrix[row - 1][column] + 1, matrix[row][column - 1] + 1, matrix[row - 1][column - 1] + cost);
            }
        }
        return matrix[left.length][right.length];
    }
    calculateSimilarity(requestedPath, registeredPath) {
        const requestedParts = requestedPath
            .split("/")
            .filter((part) => part.length > 0);
        const registeredParts = registeredPath
            .split("/")
            .filter((part) => part.length > 0);
        const maximumLength = Math.max(requestedParts.length, registeredParts.length);
        if (maximumLength === 0) {
            return 1;
        }
        let totalScore = 0;
        for (let index = 0; index < maximumLength; index++) {
            const requestedPart = requestedParts[index];
            const registeredPart = registeredParts[index];
            if (requestedPart === undefined ||
                registeredPart === undefined) {
                continue;
            }
            if (registeredPart.startsWith(":")) {
                totalScore += 1;
                continue;
            }
            const distance = this.calculateDistance(requestedPart.toLowerCase(), registeredPart.toLowerCase());
            const longestLength = Math.max(requestedPart.length, registeredPart.length);
            if (longestLength === 0) {
                totalScore += 1;
                continue;
            }
            totalScore +=
                1 -
                    distance / longestLength;
        }
        return totalScore / maximumLength;
    }
    findRouteSuggestions(method, requestPath) {
        const uniqueSuggestions = new Map();
        for (const route of this.routes) {
            const score = this.calculateSimilarity(requestPath, route.path);
            const key = `${route.method}:${route.path}`;
            uniqueSuggestions.set(key, {
                method: route.method,
                path: route.path,
                score,
            });
        }
        return [
            ...uniqueSuggestions.values(),
        ]
            .filter((suggestion) => suggestion.score >= 0.45)
            .sort((left, right) => {
            const leftMethodMatch = left.method === method ? 1 : 0;
            const rightMethodMatch = right.method === method ? 1 : 0;
            if (leftMethodMatch !==
                rightMethodMatch) {
                return (rightMethodMatch -
                    leftMethodMatch);
            }
            return (right.score -
                left.score);
        })
            .slice(0, 3);
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
        response.statusCode = statusCode;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(JSON.stringify(data));
    }
    sendText(response, statusCode, data) {
        response.statusCode = statusCode;
        response.setHeader("Content-Type", "text/plain; charset=utf-8");
        response.end(data);
    }
    sendHtml(response, statusCode, data) {
        response.statusCode = statusCode;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(data);
    }
}
exports.Komichi = Komichi;
var response_js_2 = require("./response.js");
Object.defineProperty(exports, "KomichiResponse", { enumerable: true, get: function () { return response_js_2.KomichiResponse; } });
var errors_js_2 = require("./errors.js");
Object.defineProperty(exports, "BadRequestError", { enumerable: true, get: function () { return errors_js_2.BadRequestError; } });
