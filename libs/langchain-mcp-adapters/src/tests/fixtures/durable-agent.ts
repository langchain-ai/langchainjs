import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { deserialize, serialize } from "node:v8";

import { Command, MemorySaver } from "@langchain/langgraph";
import { createAgent, FakeToolCallingModel } from "langchain";

import { MCPAdapter } from "../../index.js";
import type { MCPElicitationResume } from "../../elicitation.js";

/** Test-only file persistence for MemorySaver's already-serialized records. */
class FileSaver extends MemorySaver {
  constructor(private readonly path: string) {
    super();
    if (existsSync(path)) {
      const saved = deserialize(readFileSync(path)) as Pick<
        MemorySaver,
        "storage" | "writes"
      >;
      this.storage = saved.storage;
      this.writes = saved.writes;
    }
  }

  private flush() {
    writeFileSync(
      `${this.path}.tmp`,
      serialize({ storage: this.storage, writes: this.writes })
    );
    renameSync(`${this.path}.tmp`, this.path);
  }

  override async put(...args: Parameters<MemorySaver["put"]>) {
    const config = await super.put(...args);
    this.flush();
    return config;
  }

  override async putWrites(...args: Parameters<MemorySaver["putWrites"]>) {
    await super.putWrites(...args);
    this.flush();
  }
}

const [url, checkpointPath, resume, settings = "{}"] = process.argv.slice(2);
const { rounds = 1, maxRounds = 32 } = JSON.parse(settings) as {
  rounds?: number;
  maxRounds?: number;
};
const adapter = new MCPAdapter({
  servers: { modern: { url, maxElicitationRounds: maxRounds } },
});
try {
  const agent = createAgent({
    model: new FakeToolCallingModel({
      toolCalls: resume
        ? [[]]
        : [[{ id: "c1", name: "ask", args: { label: "restart", rounds } }], []],
    }),
    tools: await adapter.listTools(),
    checkpointer: new FileSaver(checkpointPath),
  });
  type AgentInput = Parameters<typeof agent.invoke>[0];
  const input = resume
    ? (new Command({
        resume: JSON.parse(resume) as MCPElicitationResume,
      }) as unknown as AgentInput)
    : { messages: [{ role: "user" as const, content: "go" }] };
  const result = await agent.invoke(input, {
    configurable: { thread_id: "durable-restart" },
    durability: "sync",
  });
  process.stdout.write(JSON.stringify(result));
} finally {
  await adapter.close();
}
