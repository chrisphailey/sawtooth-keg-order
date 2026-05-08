import { type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";

// DEMO MODE: auth check bypassed for unauthenticated demo access.
// Re-enable by removing the early return below.
export function requireAuth(_req: Request, _res: Response, next: NextFunction): void {
  return next();
  // eslint-disable-next-line no-unreachable
  const req = _req, res = _res;
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
