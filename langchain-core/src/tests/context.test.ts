import { RunnableLambda } from "../runnables/base.js";
import { getContextVariable, setContextVariable } from "../context.js";

test("RunnableLambda that returns a runnable should invoke the runnable", async () => {
  const nested = RunnableLambda.from(() => {
    expect(getContextVariable("foo")).toEqual("bar");
    expect(getContextVariable("toplevel")).toEqual(9);
    setContextVariable("foo", "baz");
    return getContextVariable("foo");
  });
  const runnable = RunnableLambda.from(async () => {
    setContextVariable("foo", "bar");
    expect(getContextVariable("foo")).toEqual("bar");
    expect(getContextVariable("toplevel")).toEqual(9);
    const res = await nested.invoke({});
    expect(getContextVariable("foo")).toEqual("bar");
    return res;
  });
  expect(getContextVariable("foo")).toEqual(undefined);
  setContextVariable("toplevel", 9);
  expect(getContextVariable("toplevel")).toEqual(9);
  const result = await runnable.invoke({});
  expect(getContextVariable("toplevel")).toEqual(9);
  expect(result).toEqual("baz");
});
