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
  ls_run_status = "interrupted";
}

class UnmarkedGraphInterrupt extends Error {
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

  test.each(["interrupted", "cancelled"] as const)(
    "an error with ls_run_status=%s gets that status",
    (status) => {
      const error = Object.assign(new Error("x"), { ls_run_status: status });
      expect(getRunEndStatusFromError(error)).toBe(status);
    }
  );

  test("ignores any other ls_run_status value", () => {
    for (const value of ["error", "success", "pending", 1, null, {}]) {
      const error = Object.assign(new Error("x"), { ls_run_status: value });
      expect(getRunEndStatusFromError(error)).toBeUndefined();
    }
  });

  test("never classifies by class name", () => {
    for (const name of [
      "GraphInterrupt",
      "NodeInterrupt",
      "ParentCommand",
      "GraphDelegate",
      "GraphBubbleUp",
    ]) {
      const error = Object.assign(new Error("x"), { name });
      expect(getRunEndStatusFromError(error)).toBeUndefined();
    }
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

  test("an error tagged ls_run_status=interrupted is interrupted", async () => {
    const run = await runAbortedWith(new GraphInterrupt("paused"));
    expect(run.status).toBe("interrupted");
  });

  test("a class merely named GraphInterrupt stays an error", async () => {
    const run = await runAbortedWith(new UnmarkedGraphInterrupt("paused"));
    expect(run.status).toBeUndefined();
    expect(run.error).toBeDefined();
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
    class ExposedTracer extends FakeTracer {
      record(runId: string, error: unknown) {
        const run = this.getRunById(runId);
        if (run === undefined) throw new Error("run not found");
        this.setRunError(run, error);
        return run;
      }
    }
    const tracer = new ExposedTracer();
    const runId = uuid.v4();
    await tracer.handleToolStart(serialized, "in", runId);
    // Cancel then a real error on the same run must not stay `cancelled`.
    expect(tracer.record(runId, new ExpectedCancellation("stop")).status).toBe(
      "cancelled"
    );
    expect(tracer.record(runId, new Error("real failure")).status).toBe(
      undefined
    );
  });

  test("a throwing name or cause getter never throws", () => {
    const hostile = Object.defineProperty(new Error("x"), "name", {
      get() {
        throw new Error("boom");
      },
    });
    expect(getRunEndStatusFromError(hostile)).toBeUndefined();
    const hostileCause = Object.defineProperty(new Error("x"), "cause", {
      get() {
        throw new Error("boom");
      },
    });
    expect(getRunEndStatusFromError(hostileCause)).toBeUndefined();
  });
});
