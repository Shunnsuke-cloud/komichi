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

export class Router<Handler> {
  private readonly routes: Route<Handler>[] = [];

  add(
    method: string,
    path: string,
    handler: Handler,
    description?: string,
  ): void {
    this.routes.push({
      method,
      path,
      handler,
      description,
    });
  }

  list(): readonly Route<Handler>[] {
    return this.routes;
  }

  find(
    method: string,
    requestPath: string,
  ): {
    route: Route<Handler>;
    params: Params;
  } | null {
    for (const route of this.routes) {
      if (route.method !== method) {
        continue;
      }

      const params = this.matchPath(
        route.path,
        requestPath,
      );

      if (params !== null) {
        return {
          route,
          params,
        };
      }
    }

    return null;
  }

  findAllowedMethods(
    requestPath: string,
  ): string[] {
    const allowedMethods: string[] = [];

    for (const route of this.routes) {
      const params = this.matchPath(
        route.path,
        requestPath,
      );

      if (params !== null) {
        allowedMethods.push(route.method);
      }
    }

    return [...new Set(allowedMethods)];
  }

  findSuggestions(
    method: string,
    requestPath: string,
  ): RouteSuggestion[] {
    const uniqueSuggestions =
      new Map<string, RouteSuggestion>();

    for (const route of this.routes) {
      const score = this.calculateSimilarity(
        requestPath,
        route.path,
      );

      const key = `${route.method}:${route.path}`;

      uniqueSuggestions.set(key, {
        method: route.method,
        path: route.path,
        score,
      });
    }

    return [...uniqueSuggestions.values()]
      .filter(
        (suggestion) =>
          suggestion.score >= 0.45,
      )
      .sort((left, right) => {
        const leftMethodMatch =
          left.method === method ? 1 : 0;

        const rightMethodMatch =
          right.method === method ? 1 : 0;

        if (
          leftMethodMatch !==
          rightMethodMatch
        ) {
          return (
            rightMethodMatch -
            leftMethodMatch
          );
        }

        return right.score - left.score;
      })
      .slice(0, 3);
  }

  private matchPath(
    routePath: string,
    requestPath: string,
  ): Params | null {
    const routeParts = routePath
      .split("/")
      .filter((part) => part.length > 0);

    const requestParts = requestPath
      .split("/")
      .filter((part) => part.length > 0);

    if (
      routeParts.length !==
      requestParts.length
    ) {
      return null;
    }

    const params: Params = {};

    for (
      let index = 0;
      index < routeParts.length;
      index++
    ) {
      const routePart = routeParts[index];
      const requestPart = requestParts[index];

      if (
        routePart === undefined ||
        requestPart === undefined
      ) {
        return null;
      }

      if (routePart.startsWith(":")) {
        const paramName = routePart.slice(1);

        if (paramName === "") {
          return null;
        }

        try {
          params[paramName] =
            decodeURIComponent(requestPart);
        } catch {
          return null;
        }

        continue;
      }

      if (routePart !== requestPart) {
        return null;
      }
    }

    return params;
  }

  private calculateSimilarity(
    requestedPath: string,
    registeredPath: string,
  ): number {
    const requestedParts = requestedPath
      .split("/")
      .filter((part) => part.length > 0);

    const registeredParts = registeredPath
      .split("/")
      .filter((part) => part.length > 0);

    const maximumLength = Math.max(
      requestedParts.length,
      registeredParts.length,
    );

    if (maximumLength === 0) {
      return 1;
    }

    let totalScore = 0;

    for (
      let index = 0;
      index < maximumLength;
      index++
    ) {
      const requestedPart =
        requestedParts[index];

      const registeredPart =
        registeredParts[index];

      if (
        requestedPart === undefined ||
        registeredPart === undefined
      ) {
        continue;
      }

      if (registeredPart.startsWith(":")) {
        totalScore += 1;
        continue;
      }

      const distance = this.calculateDistance(
        requestedPart.toLowerCase(),
        registeredPart.toLowerCase(),
      );

      const longestLength = Math.max(
        requestedPart.length,
        registeredPart.length,
      );

      if (longestLength === 0) {
        totalScore += 1;
        continue;
      }

      totalScore +=
        1 - distance / longestLength;
    }

    return totalScore / maximumLength;
  }

  private calculateDistance(
    left: string,
    right: string,
  ): number {
    const rows = left.length + 1;
    const columns = right.length + 1;

    const matrix = Array.from(
      { length: rows },
      () => Array<number>(columns).fill(0),
    );

    for (let row = 0; row < rows; row++) {
      matrix[row]![0] = row;
    }

    for (
      let column = 0;
      column < columns;
      column++
    ) {
      matrix[0]![column] = column;
    }

    for (let row = 1; row < rows; row++) {
      for (
        let column = 1;
        column < columns;
        column++
      ) {
        const cost =
          left[row - 1] === right[column - 1]
            ? 0
            : 1;

        matrix[row]![column] = Math.min(
          matrix[row - 1]![column]! + 1,
          matrix[row]![column - 1]! + 1,
          matrix[row - 1]![column - 1]! +
            cost,
        );
      }
    }

    return matrix[left.length]![
      right.length
    ]!;
  }
}