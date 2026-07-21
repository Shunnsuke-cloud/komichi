export type Params = Record<string, string>;
export type RouteSuggestion = {
    method: string;
    path: string;
    score: number;
};
export type Route<Handler> = {
    method: string;
    path: string;
    handler: Handler;
    description?: string;
};
export declare class Router<Handler> {
    private readonly routes;
    add(method: string, path: string, handler: Handler, description?: string): void;
    list(): readonly Route<Handler>[];
    find(method: string, requestPath: string): {
        route: Route<Handler>;
        params: Params;
    } | null;
    findAllowedMethods(requestPath: string): string[];
    findSuggestions(method: string, requestPath: string): RouteSuggestion[];
    private matchPath;
    private calculateSimilarity;
    private calculateDistance;
}
