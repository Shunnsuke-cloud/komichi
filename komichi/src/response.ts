export type ResponseType =
  | "json"
  | "text"
  | "html";

export class KomichiResponse {
  constructor(
    public readonly body: unknown,
    public readonly statusCode: number,
    public readonly type: ResponseType,
  ) {}
}