# tiny-async-flow

Tiny, promise-first workflow engine for Node.js. Declare async tasks, branch with conditions, emit events, and retry failures without pulling in a heavyweight BPMN engine.

**Install:** `npm install tiny-async-flow`

## Why

- Small SaaS and backend jobs often need a little orchestration, not a full BPMN runtime.
- Promise-based and async-first, fits naturally in modern Node.js code.
- Declarative tasks with optional conditions, retries, and lifecycle events.

## Quick start

CommonJS:

```js
const { Flow } = require("tiny-async-flow");

const flow = new Flow();

flow.task("fetch", async () => fetchUser());
flow.task("process", (user) => enrich(user));
flow.task("ship", async (payload) => send(payload), {
  condition: (ctx) => ctx.get("process") && ctx.get("process").shouldSend === true
});

flow.start();
```

ESM:

```js
import { Flow } from "tiny-async-flow";

const flow = new Flow();
// same tasks as above...
await flow.start();
```

- Each task receives the previous task's result as its first argument plus the shared `FlowContext`.
- Results are stored by task name (`ctx.get("process")`), and `ctx.last()` returns the most recent value.

## API

### `flow.task(name, handler, options?)`

- `name`: unique task identifier.
- `handler(input, ctx)`: async or sync function. `input` is the previous result; `ctx` is the shared `FlowContext`.
- `options`:
  - `condition?: (ctx) => boolean | Promise<boolean>`: skip task when falsy.
  - `retries?: number` (default `0`): number of extra attempts before failing the flow.
  - `retryDelayMs?: number` (default `50`): delay between retries.

### `await flow.start({ initialContext? })`

Starts execution in registration order. Returns the final `FlowContext`.

### Events

The `Flow` extends `EventEmitter`. Subscribe to lifecycle events:

- `task:start` - `{ name, attempt, context }`
- `task:success` - `{ name, attempt, result, context }`
- `task:error` - `{ name, attempt, error, remainingRetries, context }`
- `task:retry` - `{ name, attempt, delayMs, context }`
- `task:skip` - `{ name, context }`
- `start` / `finish` - `{ context }`

```js
flow.on("task:error", ({ name, error }) => {
  console.error(`[${name}]`, error);
});
```

## Patterns

- **Conditional branching**: gate tasks with `condition`.
- **Retries with backoff**: use `retries` and `retryDelayMs` for flaky IO.
- **Context fan-out**: read any prior result via `ctx.get("taskName")`; not just the previous task.
- **Events for observability**: hook into `task:*` to log, meter, or emit metrics.

## Options examples

```js
// Custom retries and delay
flow.task("fetch", doFetch, { retries: 2, retryDelayMs: 100 });

// Conditional execution
flow.task("ship", doShip, {
  condition: (ctx) => ctx.get("process") && ctx.get("process").shouldSend === true
});

// Defaults (no retries, no condition, 50ms retry delay if retries provided)
flow.task("process", doProcess);
```

## Complete example

```js
// example.js
const { Flow } = require("tiny-async-flow");

// Fake IO helpers
const fetchUser = async () => ({ id: 1, active: true });
const enrichUser = (user) => ({ ...user, shouldSend: user.active });
const sendEmail = async (payload) => `sent:${payload.id}`;

const flow = new Flow();

// Lifecycle hooks
flow.on("start", () => console.log("Flow started"));
flow.on("finish", ({ context }) => console.log("Flow finished:", context.toJSON()));
flow.on("task:start", ({ name, attempt }) => console.log(`→ ${name} (attempt ${attempt})`));
flow.on("task:success", ({ name, result }) => console.log(`✔ ${name} =>`, result));
flow.on("task:error", ({ name, error, remainingRetries }) =>
  console.log(`✖ ${name}: ${error.message} (${remainingRetries} retries left)`)
);
flow.on("task:retry", ({ name, delayMs }) => console.log(`… retrying ${name} after ${delayMs}ms`));
flow.on("task:skip", ({ name }) => console.log(`↷ skipped ${name}`));

// Tasks
flow.task("fetch", async () => fetchUser());

flow.task("process", (user) => enrichUser(user));

flow.task(
  "ship",
  async (payload) => sendEmail(payload),
  {
    condition: (ctx) => ctx.get("process")?.shouldSend === true,
    retries: 2,
    retryDelayMs: 100
  }
);

// An intentionally flaky task to show retries
flow.task(
  "audit",
  (() => {
    let first = true;
    return () => {
      if (first) {
        first = false;
        throw new Error("temporary failure");
      }
      return "audit-ok";
    };
  })(),
  { retries: 1, retryDelayMs: 50 }
);

// Start with seed data and run
flow
  .start({ initialContext: { seed: "hello" } })
  .then((ctx) => console.log("Done. Last value:", ctx.last()))
  .catch((err) => console.error("Flow failed:", err));
```

Run it:
```bash
npm install tiny-async-flow
node example.js
```

Sample output:
```
Flow started
→ fetch (attempt 1)
✔ fetch => { id: 1, active: true }
→ process (attempt 1)
✔ process => { id: 1, active: true, shouldSend: true }
→ ship (attempt 1)
✔ ship => sent:1
→ audit (attempt 1)
✖ audit: temporary failure (0 retries left)
… retrying audit after 50ms
→ audit (attempt 2)
✔ audit => audit-ok
Flow finished: { fetch: { id: 1, active: true }, process: { id: 1, active: true, shouldSend: true }, ship: 'sent:1', audit: 'audit-ok', seed: 'hello' }
Done. Last value: audit-ok
```

## Run tests

```bash
npm run test
```

## License

MIT

## Author

Ali Ahmad
