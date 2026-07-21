import { KomichiResponse } from "./response.js";
type HandlerResult = Record<string, unknown> | string | KomichiResponse;
type Params = Record<string, string>;
type JsonBody = Record<string, unknown>;
type Handler = (params: Params, query: URLSearchParams, body: JsonBody) => HandlerResult | Promise<HandlerResult>;
type KomichiOptions = {
    trail?: boolean;
};
export declare class Komichi {
    private readonly routes;
    private readonly trailEnabled;
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
    private printTrail;
    listen(port: number): void;
    private handleRequest;
    private matchPath;
    private findAllowedMethods;
    private calculateDistance;
    private calculateSimilarity;
    private findRouteSuggestions;
    private readJsonBody;
    private sendJson;
    private sendText;
    private sendHtml;
}
export { KomichiResponse, type ResponseType, } from "./response.js";
