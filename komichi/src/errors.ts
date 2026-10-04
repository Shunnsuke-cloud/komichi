export class KomichiError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
      throw new RangeError("KomichiError status must be between 400 and 599");
    }
    this.name = "KomichiError";
  }
}

export class BadRequestError extends KomichiError {
  constructor(message: string) {
    super(400, message);
    this.name = "BadRequestError";
  }
}
