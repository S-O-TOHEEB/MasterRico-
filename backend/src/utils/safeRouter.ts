import { Router, type RequestHandler, type Router as ExpressRouter, type RouterOptions } from "express";

function wrap(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

const WRAPPED_METHODS = ["get", "post", "put", "patch", "delete", "use", "all"] as const;

/**
 * Drop-in replacement for express.Router() that auto-catches rejected
 * promises from async handlers/middleware and forwards them to next(err).
 *
 * Why this exists: this project runs Express 4 (4.22.2), which — unlike
 * Express 5 — does NOT automatically catch a rejected promise returned from
 * an async route handler. Almost every controller in this codebase is
 * `async (req, res) => { ... }` without its own try/catch, relying on
 * something upstream to catch failures. Without this wrapper, an unhandled
 * rejection in any of those doesn't crash the server (confirmed empirically)
 * but leaves that one request hanging with no response at all until the
 * client's own timeout — no 500, no error, nothing. This wraps every
 * function argument passed to a router method (path or option arguments
 * pass through untouched) so any throw/rejection reaches errorHandler.ts
 * the same way a synchronous throw already does.
 */
export function createRouter(options?: RouterOptions): ExpressRouter {
  const router = Router(options);
  for (const method of WRAPPED_METHODS) {
    const original = (router as any)[method].bind(router);
    (router as any)[method] = (...args: any[]) => {
      const wrapped = args.map((a) => (typeof a === "function" ? wrap(a) : a));
      return original(...wrapped);
    };
  }
  return router;
}
