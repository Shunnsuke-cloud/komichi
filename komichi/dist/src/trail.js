"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Trail = void 0;
class Trail {
    enabled;
    constructor(enabled) {
        this.enabled = enabled;
    }
    print(info) {
        if (!this.enabled) {
            return;
        }
        const elapsedTime = Date.now() - info.startedAt;
        console.log("");
        console.log("Komichi Trail");
        console.log("--------------------------------");
        console.log(`${info.method} ${info.requestedPath}`);
        if (info.matchedPath) {
            console.log(`Route: ${info.matchedPath}`);
        }
        else {
            console.log("Route: Not matched");
        }
        if (info.params &&
            Object.keys(info.params).length > 0) {
            const formattedParams = Object.entries(info.params)
                .map(([name, value]) => `${name}="${value}"`)
                .join(", ");
            console.log(`Params: ${formattedParams}`);
        }
        if (info.query &&
            [...info.query.entries()].length > 0) {
            const formattedQuery = [
                ...info.query.entries(),
            ]
                .map(([name, value]) => `${name}="${value}"`)
                .join(", ");
            console.log(`Query: ${formattedQuery}`);
        }
        console.log(`Response: ${info.statusCode} ${info.responseType.toUpperCase()}`);
        console.log(`Total: ${elapsedTime}ms`);
        console.log("--------------------------------");
    }
}
exports.Trail = Trail;
