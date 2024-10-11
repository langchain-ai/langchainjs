import { RunnableLambda } from "../runnables/base.js";
import { getContextVariable, setContextVariable } from "../context.js";

test("RunnableLambda that returns a runnable should invoke the runnable", async () => {
  const nested = RunnableLambda.from(() => {
    expect(getContextVariable("foo")).toEqual("bar");
    setContextVariable("foo", "baz");
    return getContextVariable("foo");
  });
  const runnable = RunnableLambda.from(async () => {
    setContextVariable("foo", "bar");
    expect(getContextVariable("foo")).toEqual("bar");
    const res = await nested.invoke({});
    expect(getContextVariable("foo")).toEqual("bar");
    return res;
  });
  expect(getContextVariable("foo")).toEqual(undefined);
  const result = await runnable.invoke({});
  expect(result).toEqual("baz");
});
