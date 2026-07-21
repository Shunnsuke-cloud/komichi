import type { Params } from "./router.js";
import type { ResponseType } from "./response.js";
export type TrailInfo = {
    method: string;
    requestedPath: string;
    matchedPath?: string;
    params?: Params;
    query?: URLSearchParams;
    statusCode: number;
    responseType: ResponseType;
    startedAt: number;
};
export declare class Trail {
    private readonly enabled;
    constructor(enabled: boolean);
    print(info: TrailInfo): void;
}
