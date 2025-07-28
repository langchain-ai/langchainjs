import { test, expect } from "@jest/globals";
import { ChatOpenAI } from "@langchain/openai";
import { AgentAction, AgentFinish } from "@langchain/core/agents";
import { StructuredChatOutputParserWithRetries } from "../structured_chat/outputParser.js";

test("Can parse JSON with text in front of it", async () => {
  const testCases = [
    {
      input:
        'Here we have an invalid format (missing markdown block) that the parser should retry and fix: {\n \t\r\n"action": "blogpost",\n\t\r  "action_input": "```sql\\nSELECT * FROM orders\\nJOIN users ON users.id = orders.user_id\\nWHERE users.email = \'bud\'```"\n\t\r}\n\n\n\t\r and at the end there is more nonsense',
      tool: "blogpost",
      toolInput:
        "```sql\nSELECT * FROM orders\nJOIN users ON users.id = orders.user_id\nWHERE users.email = 'bud'```",
    },
    {
      input:
        'Here we have an invalid format (missing markdown block) with a structured tool that the parser should retry and fix: {\n \t\r\n"action": "blogpost",\n\t\r  "action_input": {"query": "SELECT * FROM orders\\nJOIN users ON users.id = orders.user_id\\nWHERE users.email = $1",\n\t"parameters": ["bud"]\n\t}\n\t\r}\n\n\n\t\r and at the end there is more nonsense',
      tool: "blogpost",
      toolInput: {
        query:
          "SELECT * FROM orders\nJOIN users ON users.id = orders.user_id\nWHERE users.email = $1",
        parameters: ["bud"],
      },
    },
    {
      input: `I don't know the answer.`,
      tool: "Final Answer",
      toolInput: "I don't know the answer.",
    },
  ];

  const p = StructuredChatOutputParserWithRetries.fromLLM(
    new ChatOpenAI({ temperature: 0, model: "gpt-3.5-turbo" }),
    {
      toolNames: ["blogpost"],
    }
  );
  for (const message of testCases) {
    const parsed = await p.parse(message.input);
    expect(parsed).toBeDefined();
    if (message.tool === "Final Answer") {
      expect((parsed as AgentFinish).returnValues).toBeDefined();
    } else {
      expect((parsed as AgentAction).tool).toEqual(message.tool);

      if (typeof message.toolInput === "object") {
        expect(message.toolInput).toEqual((parsed as AgentAction).toolInput);
      }
      if (typeof message.toolInput === "string") {
        expect(message.toolInput).toContain((parsed as AgentAction).toolInput);
      }
    }
  }
});
