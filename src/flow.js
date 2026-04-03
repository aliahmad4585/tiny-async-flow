const { EventEmitter } = require("events");
const { FlowContext } = require("./types");

class Flow extends EventEmitter {
  constructor() {
    super();
    this.tasks = [];
    this.taskIndex = new Map();
  }

  task(name, handler, options = {}) {
    if (!name || typeof name !== "string") {
      throw new Error("Task name must be a non-empty string");
    }
    if (typeof handler !== "function") {
      throw new Error(`Task "${name}" handler must be a function`);
    }
    if (this.taskIndex.has(name)) {
      throw new Error(`Task "${name}" already exists`);
    }
    this.taskIndex.set(name, this.tasks.length);
    this.tasks.push({ name, handler, options: normalizeOptions(options) });
    return this;
  }

  async start(options = {}) {
    const ctx = new FlowContext(options.initialContext);
    this.emit("start", { context: ctx });

    let prevResult = undefined;
    for (const task of this.tasks) {
      const result = await this.runTask(task, ctx, prevResult);
      // Only update prevResult when a task actually ran.
      if (result !== SKIP) {
        prevResult = result;
      }
    }

    this.emit("finish", { context: ctx });
    return ctx;
  }

  async runTask(task, ctx, input) {
    const { name, handler, options } = task;

    if (options.condition && !(await this.shouldRun(options.condition, ctx))) {
      this.emit("task:skip", { name, context: ctx });
      return SKIP;
    }

    const retry = {
      retries: options.retries,
      retryDelayMs: options.retryDelayMs
    };

    let attempt = 0;
    while (true) {
      attempt += 1;
      this.emit("task:start", { name, attempt, context: ctx });
      try {
        const result = await handler(input, ctx);
        ctx.set(name, result);
        this.emit("task:success", { name, attempt, result, context: ctx });
        return result;
      } catch (error) {
        const remainingRetries = Math.max(0, retry.retries - attempt);
        this.emit("task:error", { name, attempt, error, remainingRetries, context: ctx });
        if (attempt > retry.retries) {
          throw error;
        }
        this.emit("task:retry", { name, attempt, delayMs: retry.retryDelayMs, context: ctx });
        await delay(retry.retryDelayMs);
      }
    }
  }

  async shouldRun(condition, ctx) {
    const result = condition(ctx);
    return typeof result === "boolean" ? result : await result;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeOptions(options) {
  const out = { ...options };
  if (out.condition && typeof out.condition !== "function") {
    throw new Error("condition must be a function when provided");
  }
  if (typeof out.retries === "undefined") out.retries = 0;
  if (typeof out.retryDelayMs === "undefined") out.retryDelayMs = 50;

  if (!Number.isInteger(out.retries) || out.retries < 0) {
    throw new Error("retries must be a non-negative integer");
  }
  if (typeof out.retryDelayMs !== "number" || out.retryDelayMs < 0) {
    throw new Error("retryDelayMs must be a non-negative number");
  }
  return out;
}

const SKIP = Symbol("skip");

module.exports = { Flow, SKIP };
