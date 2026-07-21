"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KomichiResponse = void 0;
class KomichiResponse {
    body;
    statusCode;
    type;
    constructor(body, statusCode, type) {
        this.body = body;
        this.statusCode = statusCode;
        this.type = type;
    }
}
exports.KomichiResponse = KomichiResponse;
