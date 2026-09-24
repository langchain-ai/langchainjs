import { afterAll, describe, expect, test } from "vitest";
import { CodeInterpreterToolkit } from "../code_interpreter.js";

describe("CodeInterpreterToolkit", () => {
  const toolkit = new CodeInterpreterToolkit({
    region: process.env.BEDROCK_AWS_REGION ?? "us-west-2",
  });
  const tools = toolkit.getToolsByName();
  const config = { configurable: { thread_id: "int-test" } };

  afterAll(async () => {
    await toolkit.cleanup();
  });

  test("executes code and keeps state across calls", async () => {
    await tools.execute_code.invoke({ code: "x = 21" }, config);
    const result = await tools.execute_code.invoke(
      { code: "print(x * 2)" },
      config
    );
    expect(result).toContain("42");
  });

  test("executes JavaScript", async () => {
    const result = await tools.execute_code.invoke(
      {
        code: "console.log([1, 2, 3].map((n) => n * 2).join(','))",
        language: "javascript",
      },
      config
    );
    expect(result).toContain("2,4,6");
  });

  test("writes, lists, reads, and deletes files", async () => {
    await tools.write_files.invoke(
      { files: [{ path: "langchain_int_test.txt", text: "hello agentcore" }] },
      config
    );

    const listing = await tools.list_files.invoke({}, config);
    expect(listing).toContain("langchain_int_test.txt");

    const content = await tools.read_files.invoke(
      { paths: ["langchain_int_test.txt"] },
      config
    );
    expect(content).toContain("hello agentcore");

    await tools.delete_files.invoke(
      { paths: ["langchain_int_test.txt"] },
      config
    );
    const listingAfterDelete = await tools.list_files.invoke({}, config);
    expect(listingAfterDelete).not.toContain("langchain_int_test.txt");
  });

  test("executes shell commands", async () => {
    const result = await tools.execute_command.invoke(
      { command: "echo hello-from-shell" },
      config
    );
    expect(result).toContain("hello-from-shell");
  });

  test("starts, checks, and stops async tasks", async () => {
    const started = await tools.start_command_execution.invoke(
      { command: "sleep 60" },
      config
    );
    const taskId = /Task ID: (\S+)/.exec(started)?.[1];
    expect(taskId).toBeDefined();

    const status = await tools.get_task.invoke({ task_id: taskId }, config);
    expect(status).toMatch(/Task status: (submitted|working)/);

    await tools.stop_task.invoke({ task_id: taskId }, config);
    const stopped = await tools.get_task.invoke({ task_id: taskId }, config);
    expect(stopped).toContain("Task status: canceled");
  });

  test("isolates sessions per thread", async () => {
    await tools.execute_code.invoke(
      { code: "isolated = 'thread-a'" },
      { configurable: { thread_id: "int-test-a" } }
    );
    const result = await tools.execute_code.invoke(
      { code: "print('isolated' in globals())" },
      { configurable: { thread_id: "int-test-b" } }
    );
    expect(result).toContain("False");
  });
});
