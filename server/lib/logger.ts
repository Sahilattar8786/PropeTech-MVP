type Level = "debug" | "info" | "warn" | "error";

function serialize(meta: unknown) {
  if (meta instanceof Error) return { name: meta.name, message: meta.message, stack: meta.stack };
  return meta;
}

function log(level: Level, message: string, meta?: unknown) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const entry = { level, message, time: new Date().toISOString(), ...(meta !== undefined ? { meta: serialize(meta) } : {}) };
  const line = process.env.NODE_ENV === "production" ? JSON.stringify(entry) : `[${level}] ${message}`;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (process.env.NODE_ENV === "production" || meta === undefined) sink(line);
  else sink(line, serialize(meta));
}

export const logger = {
  debug: (message: string, meta?: unknown) => log("debug", message, meta),
  info: (message: string, meta?: unknown) => log("info", message, meta),
  warn: (message: string, meta?: unknown) => log("warn", message, meta),
  error: (message: string, meta?: unknown) => log("error", message, meta),
};
