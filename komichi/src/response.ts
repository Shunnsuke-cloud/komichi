export type ResponseType =
  | "json"
  | "text"
  | "html";

export class KomichiResponse {
  constructor(
    public readonly body: unknown,
    public statusCode: number,
    public readonly type: ResponseType,
    public readonly headers: Record<string, string | string[]> = {},
  ) {}
}
