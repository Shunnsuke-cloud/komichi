export type ResponseType = "json" | "text" | "html";
export declare class KomichiResponse {
    readonly body: unknown;
    readonly statusCode: number;
    readonly type: ResponseType;
    constructor(body: unknown, statusCode: number, type: ResponseType);
}
