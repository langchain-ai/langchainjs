import { test, expect } from "@jest/globals";
import { StructuredChatOutputParserWithRetries } from "../structured_chat/outputParser.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { AgentAction, AgentFinish } from "../../schema/index.js";

test("Can parse JSON with text in front of it", async () => {
  const testCases = [
    {
      input:
        'Here we have an invalid format (missing markdown block) that the parser should retry and fix: {\n \t\r\n"action": "blogpost",\n\t\r  "action_input": "```sql\\nSELECT * FROM orders\\nJOIN users ON users.id = orders.user_id\\nWHERE users.email = \'bud\'```"\n\t\r}\n\n\n\t\r and at the end there is more nonsense',
      output:
        '{"action":"blogpost","action_input":"```sql\\nSELECT * FROM orders\\nJOIN users ON users.id = orders.user_id\\nWHERE users.email = \'bud\'```"}',
      tool: "blogpost",
      toolInput:
        "```sql\nSELECT * FROM orders\nJOIN users ON users.id = orders.user_id\nWHERE users.email = 'bud'```",
    },
  ];

  const p = StructuredChatOutputParserWithRetries.fromLLM(new ChatOpenAI({temperature: 0}));
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
