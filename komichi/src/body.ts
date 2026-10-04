import type { IncomingMessage } from "node:http";
import type { JsonBody } from "./context.js";
import { BadRequestError, KomichiError } from "./errors.js";

/** Count bytes before decoding; oversized streams are drained without buffering. */
export function readJsonBody(request: IncomingMessage, limit: number): Promise<JsonBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let failed = false;
    const fail = (error: Error) => {
      if (failed) return;
      failed = true;
      chunks.length = 0;
      reject(error);
    };
    const contentLength = Number(request.headers["content-length"]);
    if (contentLength > limit) fail(new KomichiError(413, "Payload Too Large"));
    request.on("data", (chunk: Buffer) => {
      if (failed) return;
      size += chunk.length;
      if (size > limit) { fail(new KomichiError(413, "Payload Too Large")); return; }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (failed) return;
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) { resolve({}); return; }
      const type = request.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase();
      // Missing Content-Type remains accepted for old Komichi clients.
      if (type && type !== "application/json" && !/^application\/[\w.+-]+\+json$/.test(type)) {
        fail(new KomichiError(415, "Expected application/json Content-Type")); return;
      }
      try {
        const body: unknown = JSON.parse(raw);
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          fail(new BadRequestError("JSONボディはオブジェクト形式で送信してください")); return;
        }
        resolve(body as JsonBody);
      } catch {
        fail(new BadRequestError("リクエストボディが正しいJSON形式ではありません"));
      }
    });
    request.on("error", fail);
    request.on("aborted", () => fail(new BadRequestError("Request body was aborted")));
  });
}
