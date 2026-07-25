import prisma from "../lib/prisma";

/**
 * Error capture for the admin System Errors screen.
 *
 * Nobody watches hosting logs, so server failures were invisible until a
 * customer complained. Every 5xx and uncaught route error lands here and is
 * shown in the admin panel (with an Overview action item), where it can be
 * marked resolved.
 *
 * capture() must NEVER throw or slow a request: writes are fire-and-forget,
 * failures are swallowed, and a per-instance throttle stops one repeating
 * fault from flooding the table.
 */

// message+path -> last written. One row per distinct fault per 5 minutes.
const recentlyLogged = new Map<string, number>();
const THROTTLE_MS = 5 * 60 * 1000;

export interface ErrorContext {
  method?: string;
  path?: string;
  statusCode?: number;
  meta?: Record<string, unknown>;
}

export const logServerError = (
  source: "api" | "server" | "cron",
  error: unknown,
  ctx: ErrorContext = {},
): void => {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = (err.message || "Unknown error").slice(0, 500);

    const key = `${message}|${ctx.path || ""}`;
    const now = Date.now();
    const last = recentlyLogged.get(key);
    if (last && now - last < THROTTLE_MS) return;
    recentlyLogged.set(key, now);
    // The throttle map must not grow unbounded on a long-lived server.
    if (recentlyLogged.size > 500) {
      for (const [k, t] of recentlyLogged) if (now - t > THROTTLE_MS) recentlyLogged.delete(k);
    }

    prisma.errorLog
      .create({
        data: {
          source,
          message,
          stack: err.stack ? err.stack.slice(0, 4000) : null,
          method: ctx.method || null,
          path: ctx.path ? ctx.path.slice(0, 300) : null,
          statusCode: ctx.statusCode ?? null,
          meta: ctx.meta ? JSON.stringify(ctx.meta).slice(0, 2000) : null,
        },
      })
      .catch(() => {
        /* the error logger must never become an error source */
      });
  } catch {
    /* never throw from capture */
  }
};

export const listErrors = (showResolved: boolean, take = 100) =>
  prisma.errorLog.findMany({
    where: showResolved ? {} : { resolved: false },
    orderBy: { createdAt: "desc" },
    take,
  });

export const unresolvedErrorCount = () => prisma.errorLog.count({ where: { resolved: false } });

export const resolveError = (id: string) =>
  prisma.errorLog.update({ where: { id }, data: { resolved: true } });

export const resolveAllErrors = () =>
  prisma.errorLog.updateMany({ where: { resolved: false }, data: { resolved: true } });

export const clearResolvedErrors = () => prisma.errorLog.deleteMany({ where: { resolved: true } });

/** Daily-cron hygiene: drop anything older than 30 days, resolved or not. */
export const pruneOldErrors = async (days = 30) => {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { count } = await prisma.errorLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
};
