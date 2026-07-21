export class KomichiResponse {
    body;
    statusCode;
    type;
    constructor(body, statusCode, type) {
        this.body = body;
        this.statusCode = statusCode;
        this.type = type;
    }
}
