import { test, expect } from "@jest/globals";
import { StructuredChatOutputParser } from "../structured_chat/outputParser.js";
import { AgentAction, AgentFinish } from "../../schema/index.js";

test("Can parse JSON with text in front of it", async () => {
  const testCases = [
    {
      input:
        'Here we have some boilerplate nonsense```json\n{\n "action": "blogpost",\n  "action_input": "```sql\\nSELECT * FROM orders\\nJOIN users ON users.id = orders.user_id\\nWHERE users.email = \'bud\'```"\n}\n``` and at the end there is more nonsense',
      output:
        '{"action":"blogpost","action_input":"```sql\\nSELECT * FROM orders\\nJOIN users ON users.id = orders.user_id\\nWHERE users.email = \'bud\'```"}',
      tool: "blogpost",
      toolInput:
        "```sql\nSELECT * FROM orders\nJOIN users ON users.id = orders.user_id\nWHERE users.email = 'bud'```",
    },
    {
      input:
        'Here we have some boilerplate nonsense```json\n{\n \t\r\n"action": "blogpost",\n\t\r  "action_input": "```sql\\nSELECT * FROM orders\\nJOIN users ON users.id = orders.user_id\\nWHERE users.email = \'bud\'```"\n\t\r}\n\n\n\t\r``` and at the end there is more nonsense',
      output:
        '{"action":"blogpost","action_input":"```sql\\nSELECT * FROM orders\\nJOIN users ON users.id = orders.user_id\\nWHERE users.email = \'bud\'```"}',
      tool: "blogpost",
      toolInput:
        "```sql\nSELECT * FROM orders\nJOIN users ON users.id = orders.user_id\nWHERE users.email = 'bud'```",
    },
  ];

  const p = new StructuredChatOutputParser({ toolNames: ["blogpost"] });
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
