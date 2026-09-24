import { describe, expect, it, vi } from "vitest";
import {
  BedrockAgentCoreClient,
  InvokeCodeInterpreterCommand,
  StartCodeInterpreterSessionCommand,
  StopCodeInterpreterSessionCommand,
  type CodeInterpreterStreamOutput,
} from "@aws-sdk/client-bedrock-agentcore";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import {
  CodeInterpreterToolkit,
  DEFAULT_CODE_INTERPRETER_IDENTIFIER,
} from "../code_interpreter.js";

async function* toStream(events: CodeInterpreterStreamOutput[]) {
  for (const event of events) {
    yield event;
  }
}

function textResult(text: string): CodeInterpreterStreamOutput {
  return { result: { content: [{ type: "text", text }] } };
}

function createMockClient(
  invokeEvents: () => CodeInterpreterStreamOutput[] = () => [textResult("ok")]
) {
  let sessionCount = 0;
  const send = vi.fn(async (command: unknown) => {
    if (command instanceof StartCodeInterpreterSessionCommand) {
      sessionCount += 1;
      return {
        codeInterpreterIdentifier: command.input.codeInterpreterIdentifier,
        sessionId: `session-${sessionCount}`,
      };
    }
    if (command instanceof InvokeCodeInterpreterCommand) {
      return { stream: toStream(invokeEvents()) };
    }
    if (command instanceof StopCodeInterpreterSessionCommand) {
      return {};
    }
    throw new Error("Unexpected command");
  });
  const client = { send } as unknown as BedrockAgentCoreClient;
  return { client, send };
}

function commandsOfType<T>(
  send: ReturnType<typeof vi.fn>,
  type: new (...args: never[]) => T
): T[] {
  return send.mock.calls
    .map(([command]) => command)
    .filter((command): command is T => command instanceof type);
}

describe("CodeInterpreterToolkit", () => {
  it("exposes the same tools as the Python toolkit", () => {
    const { client } = createMockClient();
    const toolkit = new CodeInterpreterToolkit({ client });

    expect(toolkit.getTools().map((t) => t.name)).toEqual([
      "execute_code",
      "execute_command",
      "read_files",
      "list_files",
      "delete_files",
      "write_files",
      "upload_file",
      "install_packages",
      "start_command_execution",
      "get_task",
      "stop_task",
    ]);
    expect(Object.keys(toolkit.getToolsByName())).toHaveLength(11);
  });

  it("only requires arguments without a default", () => {
    const { client } = createMockClient();
    const tools = new CodeInterpreterToolkit({ client }).getToolsByName();
    const required = (name: string) =>
      convertToOpenAITool(tools[name]).function.parameters.required;

    expect(required("execute_code")).toEqual(["code"]);
    expect(required("list_files") ?? []).toEqual([]);
    expect(required("upload_file")).toEqual(["path", "content"]);
    expect(required("install_packages")).toEqual(["packages"]);
  });

  it("does not start a session until a tool is invoked", () => {
    const { client, send } = createMockClient();
    new CodeInterpreterToolkit({ client });
    expect(send).not.toHaveBeenCalled();
  });

  it("starts a session with the configured interpreter and timeout", async () => {
    const { client, send } = createMockClient();
    const toolkit = new CodeInterpreterToolkit({
      client,
      codeInterpreterIdentifier: "my-interpreter-abc123",
      sessionTimeoutSeconds: 1800,
    });

    await toolkit.getToolsByName().execute_code.invoke({ code: "1 + 1" });

    const [start] = commandsOfType(send, StartCodeInterpreterSessionCommand);
    expect(start.input).toEqual({
      codeInterpreterIdentifier: "my-interpreter-abc123",
      sessionTimeoutSeconds: 1800,
    });
  });

  it("uses the AWS managed interpreter by default", async () => {
    const { client, send } = createMockClient();
    const toolkit = new CodeInterpreterToolkit({ client });

    await toolkit.getToolsByName().execute_code.invoke({ code: "1 + 1" });

    const [start] = commandsOfType(send, StartCodeInterpreterSessionCommand);
    expect(start.input.codeInterpreterIdentifier).toBe(
      DEFAULT_CODE_INTERPRETER_IDENTIFIER
    );
    expect(start.input.sessionTimeoutSeconds).toBe(900);
  });

  it("maps tool inputs to code interpreter arguments", async () => {
    const { client, send } = createMockClient();
    const tools = new CodeInterpreterToolkit({ client }).getToolsByName();

    await tools.execute_code.invoke({ code: "print(1)" });
    await tools.execute_code.invoke({
      code: "console.log(1)",
      language: "javascript",
      clear_context: true,
    });
    await tools.execute_command.invoke({ command: "ls -la" });
    await tools.read_files.invoke({ paths: ["a.txt"] });
    await tools.list_files.invoke({});
    await tools.delete_files.invoke({ paths: ["a.txt"] });
    await tools.write_files.invoke({
      files: [{ path: "b.txt", text: "hello" }],
    });
    await tools.upload_file.invoke({
      path: "data.csv",
      content: "a,b\n1,2",
      description: "CSV with columns: a, b",
    });
    await tools.start_command_execution.invoke({ command: "sleep 60" });
    await tools.get_task.invoke({ task_id: "task-1" });
    await tools.stop_task.invoke({ task_id: "task-1" });

    const invocations = commandsOfType(send, InvokeCodeInterpreterCommand).map(
      (command) => [command.input.name, command.input.arguments]
    );
    expect(invocations).toEqual([
      [
        "executeCode",
        { code: "print(1)", language: "python", clearContext: false },
      ],
      [
        "executeCode",
        { code: "console.log(1)", language: "javascript", clearContext: true },
      ],
      ["executeCommand", { command: "ls -la" }],
      ["readFiles", { paths: ["a.txt"] }],
      ["listFiles", { directoryPath: "" }],
      ["removeFiles", { paths: ["a.txt"] }],
      ["writeFiles", { content: [{ path: "b.txt", text: "hello" }] }],
      ["writeFiles", { content: [{ path: "data.csv", text: "a,b\n1,2" }] }],
      ["startCommandExecution", { command: "sleep 60" }],
      ["getTask", { taskId: "task-1" }],
      ["stopTask", { taskId: "task-1" }],
    ]);
  });

  it("installs packages with pip and quotes specifiers", async () => {
    const { client, send } = createMockClient();
    const tools = new CodeInterpreterToolkit({ client }).getToolsByName();

    await tools.install_packages.invoke({
      packages: ["pandas", "numpy<2.0", "requests[socks]==2.31.0"],
      upgrade: true,
    });

    const [invoke] = commandsOfType(send, InvokeCodeInterpreterCommand);
    expect(invoke.input.arguments).toEqual({
      command:
        "pip install --upgrade pandas 'numpy<2.0' 'requests[socks]==2.31.0'",
    });
  });

  it("rejects invalid package names", async () => {
    const { client, send } = createMockClient();
    const toolkit = new CodeInterpreterToolkit({ client });

    await expect(
      toolkit.installPackages({ packages: ["pandas; rm -rf /"] })
    ).rejects.toThrow("Invalid package name");
    await expect(toolkit.installPackages({ packages: [] })).rejects.toThrow(
      "At least one package name must be provided"
    );
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects absolute paths when writing files", async () => {
    const { client, send } = createMockClient();
    const toolkit = new CodeInterpreterToolkit({ client });

    await expect(
      toolkit.writeFiles({ files: [{ path: "/etc/passwd", text: "" }] })
    ).rejects.toThrow("Path must be relative");
    await expect(
      toolkit.uploadFile({ path: "/tmp/data.csv", content: "" })
    ).rejects.toThrow("Path must be relative");
    expect(send).not.toHaveBeenCalled();
  });

  it("formats text, file, and file listing content blocks", async () => {
    const { client } = createMockClient(() => [
      {
        result: {
          content: [
            { type: "text", text: "hello" },
            {
              type: "resource",
              resource: {
                type: "text",
                uri: "file:///opt/amazon/data.csv",
                text: "a,b",
              },
            },
            {
              type: "resource",
              resource: {
                type: "blob",
                uri: "file:///opt/amazon/plot.png",
                blob: new Uint8Array([1, 2, 3]),
              },
            },
            {
              type: "resource_link",
              name: "data.csv",
              mimeType: "text/csv",
              uri: "file:///opt/amazon/data.csv",
            },
          ],
        },
      },
    ]);
    const tools = new CodeInterpreterToolkit({ client }).getToolsByName();

    const result = await tools.execute_code.invoke({ code: "..." });

    expect(result).toBe(
      [
        "hello",
        "==== File: /opt/amazon/data.csv ====\na,b\n",
        "==== Binary File: /opt/amazon/plot.png ====\n",
        "data.csv - text/csv - file:///opt/amazon/data.csv",
      ].join("\n")
    );
  });

  it("includes task IDs, task status, and exit codes from structured content", async () => {
    const events: CodeInterpreterStreamOutput[][] = [
      [
        {
          result: {
            content: [
              {
                type: "text",
                text: "Successfully started a command execution task",
              },
            ],
            structuredContent: { taskId: "task-1", taskStatus: "submitted" },
          },
        },
      ],
      [
        {
          result: {
            content: [{ type: "text", text: "done" }],
            structuredContent: { taskStatus: "completed", exitCode: 0 },
          },
        },
      ],
      [
        {
          result: {
            content: [{ type: "text", text: "err" }],
            structuredContent: { exitCode: 3 },
            isError: true,
          },
        },
      ],
    ];
    const { client } = createMockClient(() => events.shift() ?? []);
    const toolkit = new CodeInterpreterToolkit({ client });

    await expect(
      toolkit.startCommandExecution({ command: "sleep 60" })
    ).resolves.toBe(
      "Successfully started a command execution task\nTask ID: task-1 (status: submitted)"
    );
    await expect(toolkit.getTask({ task_id: "task-1" })).resolves.toBe(
      "done\nTask status: completed"
    );
    await expect(toolkit.executeCommand({ command: "exit 3" })).resolves.toBe(
      "err\nExit code: 3"
    );
  });

  it("throws exceptions returned in the stream", async () => {
    const error = new Error("Too many requests");
    const { client } = createMockClient(() => [
      { throttlingException: error } as unknown as CodeInterpreterStreamOutput,
    ]);
    const toolkit = new CodeInterpreterToolkit({ client });

    await expect(toolkit.executeCode({ code: "1" })).rejects.toThrow(
      "Too many requests"
    );
  });

  it("reuses one session per thread", async () => {
    const { client, send } = createMockClient();
    const tools = new CodeInterpreterToolkit({ client }).getToolsByName();
    const thread1 = { configurable: { thread_id: "thread-1" } };
    const thread2 = { configurable: { thread_id: "thread-2" } };

    await Promise.all([
      tools.execute_code.invoke({ code: "a = 1" }, thread1),
      tools.execute_code.invoke({ code: "b = 2" }, thread1),
      tools.list_files.invoke({}, thread1),
    ]);
    await tools.execute_code.invoke({ code: "c = 3" }, thread2);

    expect(
      commandsOfType(send, StartCodeInterpreterSessionCommand)
    ).toHaveLength(2);
    const sessionIds = commandsOfType(send, InvokeCodeInterpreterCommand).map(
      (command) => command.input.sessionId
    );
    expect(sessionIds).toEqual([
      "session-1",
      "session-1",
      "session-1",
      "session-2",
    ]);
  });

  it("isolates subagent sessions using the parent checkpoint namespace", async () => {
    const { client, send } = createMockClient();
    const tools = new CodeInterpreterToolkit({ client }).getToolsByName();

    await tools.execute_code.invoke(
      { code: "1" },
      { configurable: { thread_id: "t", checkpoint_ns: "tools:call-1" } }
    );
    await tools.execute_code.invoke(
      { code: "2" },
      { configurable: { thread_id: "t", checkpoint_ns: "tools:call-2" } }
    );
    await tools.execute_code.invoke(
      { code: "3" },
      {
        configurable: {
          thread_id: "t",
          checkpoint_ns: "sub-a:1|tools:call-3",
        },
      }
    );

    const sessionIds = commandsOfType(send, InvokeCodeInterpreterCommand).map(
      (command) => command.input.sessionId
    );
    expect(sessionIds).toEqual(["session-1", "session-1", "session-2"]);
  });

  it("retries starting a session after a failure", async () => {
    const { client, send } = createMockClient();
    send.mockRejectedValueOnce(new Error("AccessDenied"));
    const toolkit = new CodeInterpreterToolkit({ client });

    await expect(toolkit.executeCode({ code: "1" })).rejects.toThrow(
      "AccessDenied"
    );
    await expect(toolkit.executeCode({ code: "1" })).resolves.toBe("ok");
  });

  it("stops sessions on cleanup", async () => {
    const { client, send } = createMockClient();
    const toolkit = new CodeInterpreterToolkit({ client });
    const tools = toolkit.getToolsByName();

    await tools.execute_code.invoke(
      { code: "1" },
      { configurable: { thread_id: "thread-1" } }
    );
    await tools.execute_code.invoke(
      { code: "1" },
      { configurable: { thread_id: "thread-2" } }
    );

    await toolkit.cleanup("thread-1");
    expect(
      commandsOfType(send, StopCodeInterpreterSessionCommand).map(
        (command) => command.input
      )
    ).toEqual([
      {
        codeInterpreterIdentifier: DEFAULT_CODE_INTERPRETER_IDENTIFIER,
        sessionId: "session-1",
      },
    ]);

    await toolkit.cleanup();
    expect(
      commandsOfType(send, StopCodeInterpreterSessionCommand).map(
        (command) => command.input.sessionId
      )
    ).toEqual(["session-1", "session-2"]);

    // A new session is started after cleanup.
    await tools.execute_code.invoke(
      { code: "1" },
      { configurable: { thread_id: "thread-1" } }
    );
    expect(
      commandsOfType(send, StartCodeInterpreterSessionCommand)
    ).toHaveLength(3);
  });
});
