import { KomichiResponse } from "./response.js";
import { type Params } from "./router.js";
export type JsonBody = Record<string, unknown>;
export type HandlerResult = Record<string, unknown> | string | KomichiResponse;
export type Handler = (params: Params, query: URLSearchParams, body: JsonBody) => HandlerResult | Promise<HandlerResult>;
export type KomichiOptions = {
    trail?: boolean;
};
export declare class Komichi {
    private readonly router;
    private readonly trail;
    constructor(options?: KomichiOptions);
    get(path: string, handler: Handler, description?: string): void;
    post(path: string, handler: Handler, description?: string): void;
    put(path: string, handler: Handler, description?: string): void;
    patch(path: string, handler: Handler, description?: string): void;
    delete(path: string, handler: Handler, description?: string): void;
    json(data: unknown, statusCode?: number): KomichiResponse;
    text(data: string, statusCode?: number): KomichiResponse;
    html(data: string, statusCode?: number): KomichiResponse;
    printRoutes(): void;
    listen(port: number): void;
    private handleRequest;
    private readJsonBody;
    private sendJson;
    private sendText;
    private sendHtml;
}
export { KomichiResponse, type ResponseType, } from "./response.js";
export { BadRequestError, } from "./errors.js";
export { Router, type Params, type Route, type RouteSuggestion, } from "./router.js";
export { Trail, type TrailInfo, } from "./trail.js";
