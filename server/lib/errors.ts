import { ZodError } from "zod";
import { logger } from "./logger";

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "LIMIT_EXCEEDED"
  | "INTEGRATION"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 422,
  RATE_LIMITED: 429,
  LIMIT_EXCEEDED: 402,
  INTEGRATION: 502,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: ErrorCode, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  get status() {
    return STATUS[this.code];
  }
}

export const notFound = (what = "Resource") => new AppError("NOT_FOUND", `${what} not found`);
export const forbidden = (message = "You don't have permission to do that") =>
  new AppError("FORBIDDEN", message);

export function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Normalises any thrown value into a safe, user-presentable AppError. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError("VALIDATION", "Please check the highlighted fields", zodFieldErrors(error));
  }
  if (isDuplicateKeyError(error)) {
    return new AppError("CONFLICT", "That value is already in use");
  }
  logger.error("Unhandled error", error);
  return new AppError("INTERNAL", "Something went wrong. Please try again.");
}

export function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

/** Result shape returned by every Server Action. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ErrorCode; fieldErrors?: Record<string, string> };

export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    // Let Next.js control-flow errors (redirect/notFound) propagate.
    if (isNextControlFlowError(error)) throw error;
    const appError = toAppError(error);
    return { ok: false, error: appError.message, code: appError.code, fieldErrors: appError.fieldErrors };
  }
}

/** JSON error response for Route Handlers. */
export function errorResponse(error: unknown): Response {
  const appError = toAppError(error);
  return Response.json(
    { error: { code: appError.code, message: appError.message, fieldErrors: appError.fieldErrors } },
    { status: appError.status },
  );
}

function isNextControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"));
}
