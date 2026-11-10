import { test, expect, describe } from "vitest";
import * as uuid from "../../utils/uuid/index.js";
import { Serialized } from "../../load/serializable.js";
import { FakeTracer } from "../../utils/testing/index.js";
import { RunnableLambda } from "../../runnables/index.js";
import { awaitAllCallbacks } from "../../singletons/callbacks.js";
import { ExpectedCancellation } from "../../errors/index.js";
import { getRunEndStatusFromError } from "../base.js";

const serialized: Serialized = {
  lc: 1,
  type: "constructor",
  id: ["test"],
  kwargs: {},
};

class GraphInterrupt extends Error {
  name = "GraphInterrupt";
}

/** Runs a lambda that blocks until aborted with `reason`; returns the root run. */
async function runAbortedWith(reason?: unknown) {
  const tracer = new FakeTracer();
  const controller = new AbortController();
  const lambda = RunnableLambda.from(
    () => new Promise<void>(() => {})
  ).withConfig({ callbacks: [tracer] });
  const promise = lambda.invoke("x", { signal: controller.signal });
  controller.abort(reason);
  await expect(promise).rejects.toBeDefined();
  await awaitAllCallbacks();
  return tracer.runs[0];
}

describe("getRunEndStatusFromError", () => {
  test("marker is cancelled", () => {
    expect(getRunEndStatusFromError(new ExpectedCancellation("stop"))).toBe(
      "cancelled"
    );
  });

  test.each([
    "GraphInterrupt",
    "NodeInterrupt",
    "ParentCommand",
    "GraphDelegate",
  ])("%s is interrupted", (name) => {
    const error = Object.assign(new Error("x"), { name });
    expect(getRunEndStatusFromError(error)).toBe("interrupted");
  });

  test("plain errors, unmarked aborts, timeouts and drains stay errors", () => {
    expect(getRunEndStatusFromError(new Error("boom"))).toBeUndefined();
    expect(
      getRunEndStatusFromError(new DOMException("aborted", "AbortError"))
    ).toBeUndefined();
    expect(
      getRunEndStatusFromError(new DOMException("timed out", "TimeoutError"))
    ).toBeUndefined();
    expect(
      getRunEndStatusFromError(
        Object.assign(new Error("x"), { name: "GraphDrained" })
      )
    ).toBeUndefined();
    expect(getRunEndStatusFromError("ExpectedCancellation")).toBeUndefined();
    expect(getRunEndStatusFromError(undefined)).toBeUndefined();
  });

  test("finds the marker on the cause chain", () => {
    const wrapped = new Error("fetch failed", {
      cause: new ExpectedCancellation("stop"),
    });
    expect(getRunEndStatusFromError(wrapped)).toBe("cancelled");
  });

  test("terminates on a cyclic cause chain", () => {
    const a: Error = new Error("a");
    const b = new Error("b", { cause: a });
    (a as { cause?: unknown }).cause = b;
    expect(getRunEndStatusFromError(a)).toBeUndefined();
  });
});

describe("tracer run status", () => {
  test("abort with the marker is cancelled", async () => {
    const run = await runAbortedWith(new ExpectedCancellation("user stop"));
    expect(run.status).toBe("cancelled");
    expect(run.error).toBeDefined();
  });

  test("GraphInterrupt is interrupted", async () => {
    const run = await runAbortedWith(new GraphInterrupt("paused"));
    expect(run.status).toBe("interrupted");
  });

  test("plain abort stays an error", async () => {
    const run = await runAbortedWith();
    expect(run.status).toBeUndefined();
    expect("status" in run).toBe(false);
    expect(run.error).toBeDefined();
  });

  test("timeout stays an error", async () => {
    const run = await runAbortedWith(
      new DOMException("The operation timed out", "TimeoutError")
    );
    expect(run.status).toBeUndefined();
    expect(run.error).toBeDefined();
  });

  test("status follows the latest recorded error", async () => {
    const tracer = new FakeTracer();
    const runId = uuid.v4();
    await tracer.handleToolStart(serialized, "in", runId);
    const run = tracer.runs.length ? tracer.runs[0] : undefined;
    expect(run).toBeUndefined();
    // Cancel then a real error on the same run must not stay `cancelled`.
    const internal = (
      tracer as unknown as { getRunById(id: string): { status?: string } }
    ).getRunById(runId);
    (
      tracer as unknown as { setRunError(r: unknown, e: unknown): void }
    ).setRunError(internal, new ExpectedCancellation("stop"));
    expect(internal.status).toBe("cancelled");
    (
      tracer as unknown as { setRunError(r: unknown, e: unknown): void }
    ).setRunError(internal, new Error("real failure"));
    expect(internal.status).toBeUndefined();
  });
});
