const { Flow } = require("../src");

describe("Flow", () => {
  test("runs tasks sequentially and passes the previous result", async () => {
    const flow = new Flow();

    flow.task("fetch", async () => 21).task("process", (prev) => prev * 2);

    const ctx = await flow.start();

    expect(ctx.get("fetch")).toBe(21);
    expect(ctx.get("process")).toBe(42);
    expect(ctx.last()).toBe(42);
  });

  test("skips tasks when condition is false", async () => {
    const flow = new Flow();
    let skipped = 0;
    flow.on("task:skip", () => skipped++);

    flow
      .task("one", () => 1)
      .task("two", () => 2, {
        condition: (ctx) => ctx.get("one") === 99
      })
      .task("three", (prev) => (prev ?? 0) + 1);

    const ctx = await flow.start();

    expect(ctx.get("two")).toBeUndefined();
    expect(ctx.get("three")).toBe(2);
    expect(skipped).toBe(1);
  });

  test("retries a failed task before throwing", async () => {
    const flow = new Flow();
    const attempts = [];

    flow.task(
      "flaky",
      () => {
        attempts.push(Date.now());
        if (attempts.length < 2) throw new Error("fail");
        return "ok";
      },
      { retries: 2, retryDelayMs: 10 }
    );

    const ctx = await flow.start();

    expect(attempts.length).toBe(2);
    expect(ctx.get("flaky")).toBe("ok");
  });

  test("bubbles error after exhausting retries", async () => {
    const flow = new Flow();
    flow.task(
      "alwaysFail",
      () => {
        throw new Error("boom");
      },
      { retries: 1, retryDelayMs: 5 }
    );

    await expect(flow.start()).rejects.toThrow(/boom/);
  });

  test("supports async condition functions", async () => {
    const flow = new Flow();
    let ran = 0;

    flow.task("first", () => 1);
    flow.task(
      "second",
      () => {
        ran += 1;
        return 2;
      },
      {
        condition: async (ctx) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return ctx.get("first") === 1;
        }
      }
    );

    await flow.start();
    expect(ran).toBe(1);
  });

  test("provides undefined to first task input and honors initialContext", async () => {
    const flow = new Flow();

    flow
      .task("first", (input, ctx) => {
        expect(input).toBeUndefined();
        return ctx.get("seed");
      })
      .task("second", (prev) => prev + 1);

    const ctx = await flow.start({ initialContext: { seed: 10 } });
    expect(ctx.get("first")).toBe(10);
    expect(ctx.get("second")).toBe(11);
  });

  test("emits lifecycle events in order", async () => {
    const flow = new Flow();
    const events = [];

    ["start", "finish", "task:start", "task:success", "task:skip", "task:error", "task:retry"].forEach(
      (name) => {
        flow.on(name, () => events.push(name));
      }
    );

    flow
      .task("one", () => 1)
      .task("two", () => 2, { condition: () => false });

    await flow.start();

    expect(events[0]).toBe("start");
    expect(events).toContain("task:start");
    expect(events).toContain("task:success");
    expect(events).toContain("task:skip");
    expect(events[events.length - 1]).toBe("finish");
  });
});
