import type { Request } from "express";

/**
 * Newer @types/express-serve-static-core releases type route params as
 * `string | string[]` (to account for repeated wildcard segments), while
 * this project's routes only ever use single named params. This helper
 * gives a single, type-safe place to read a route param as a plain
 * `string`, regardless of which Express types version actually ends up
 * installed (the type-only difference between Express 4 and 5's typings
 * does not change runtime behaviour for the simple `/:id`-style routes
 * used throughout this app).
 *
 * Throws if the param is missing — which should be unreachable in
 * practice, since Express only invokes a handler after successfully
 * matching the route pattern that declared this param.
 */
export function param(req: Request, key: string): string {
  const value = req.params[key];
  if (value === undefined) {
    throw new Error(`Missing required route parameter: "${key}"`);
  }
  return Array.isArray(value) ? value[0]! : value;
}
