# flow-node

Tiny, promise-first workflow engine for Node.js. Declare async tasks, branch with conditions, emit events, and retry failures without pulling in a heavyweight BPMN engine.

**Install:** `npm install @aliahmad/flow-node`

## Why

- Small SaaS and backend jobs often need a little orchestration, not a full BPMN runtime.
- Promise-based and async-first, fits naturally in modern Node.js code.
- Declarative tasks with optional conditions, retries, and lifecycle events.

## Quick start

CommonJS:

```js
const { Flow } = require("flow-node");

const flow = new Flow();

flow.task("fetch", async () => fetchUser());
flow.task("process", async (user) => enrich(user));
flow.task("ship", async (payload) => send(payload), {
  condition: (ctx) => ctx.get("process") && ctx.get("process").shouldSend === true
});

flow.start();
```

ESM:

```js
import { Flow } from "flow-node";

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

## Run tests

```bash
npm run test
```

## License

MIT

## Author

Ali Ahmad
