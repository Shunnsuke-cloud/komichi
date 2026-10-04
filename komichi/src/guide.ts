export type PathDifference = { segment: number; from: string | null; to: string | null };
export type RouteSuggestion = { method: string; path: string; score: number; differences: PathDifference[] };

function distance(left: string, right: string): number {
  // Bound diagnostics and keep just two rows, rather than allocating a matrix.
  left = left.slice(0, 256).toLowerCase();
  right = right.slice(0, 256).toLowerCase();
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let row = 1; row <= left.length; row++) {
    const current = [row];
    for (let col = 1; col <= right.length; col++) {
      current[col] = Math.min(current[col - 1] + 1, previous[col] + 1,
        previous[col - 1] + (left[row - 1] === right[col - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[right.length];
}

export function comparePaths(requested: string, registered: string): Pick<RouteSuggestion, "score" | "differences"> {
  const from = requested.split("/").filter(Boolean);
  const to = registered.split("/").filter(Boolean);
  const length = Math.max(from.length, to.length);
  const differences: PathDifference[] = [];
  let total = 0;
  for (let index = 0; index < length; index++) {
    const a = from[index];
    const b = to[index];
    if (a !== undefined && b !== undefined && (b.startsWith(":") || a === b)) total += 1;
    else {
      differences.push({ segment: index + 1, from: a ?? null, to: b ?? null });
      if (a !== undefined && b !== undefined) {
        total += 1 - distance(a, b) / Math.max(a.slice(0, 256).length, b.slice(0, 256).length);
      }
    }
  }
  return { score: length ? total / length : 1, differences };
}

export function routeGuide(method: string, path: string, candidates: RouteSuggestion[]) {
  const suggestions = candidates.map(({ score, ...route }) => ({
    ...route, similarity: Number(score.toFixed(2)), similarityPercent: Math.round(score * 100),
  }));
  return {
    message: "Route not found", requestedMethod: method, requestedPath: path,
    closestRoute: suggestions[0] ?? null, suggestions,
    hint: suggestions.length ? "Did you mean one of these routes?" : "Check the Route Map with app.printRoutes().",
  };
}
