import { test, expect } from "@jest/globals";
import { ChatConversationalAgentOutputParserWithRetries } from "../chat_convo/outputParser.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { AgentAction, AgentFinish } from "../../schema/index.js";

test.skip("Can parse JSON with text in front of it", async () => {
  const testCases = [
    {
      input:
        'Here we have an invalid format (missing markdown block) that the parser should retry and fix: {\n \t\r\n"action": "blogpost",\n\t\r  "action_input": "```sql\\nSELECT * FROM orders\\nJOIN users ON users.id = orders.user_id\\nWHERE users.email = \'bud\'```"\n\t\r}\n\n\n\t\r and at the end there is more nonsense',
      tool: "blogpost",
      toolInput:
        "```sql\nSELECT * FROM orders\nJOIN users ON users.id = orders.user_id\nWHERE users.email = 'bud'```",
    },
    {
      input: `I don't know the answer.`,
      tool: "Final Answer",
      toolInput: "I don't know the answer.",
    },
    {
      input:
        '{"action":"ToolWithJson","action_input":"The tool input ```json\\n{\\"yes\\":true}\\n```"}',
      output:
        '{"action":"ToolWithJson","action_input":"The tool input ```json\\n{\\"yes\\":true}\\n```"}',
      tool: "ToolWithJson",
      toolInput: '{"yes":true}',
      type: "stringified_object",
    },
  ];

  const p = ChatConversationalAgentOutputParserWithRetries.fromLLM(
    new ChatOpenAI({ temperature: 0, modelName: "gpt-3.5-turbo" }),
    {
      toolNames: ["blogpost", "ToolWithJson"],
    }
  );
  for (const message of testCases) {
    const parsed = await p.parse(message.input);
    expect(parsed).toBeDefined();
    if (message.tool === "Final Answer") {
      expect((parsed as AgentFinish).returnValues).toBeDefined();
    } else {
      expect((parsed as AgentAction).tool).toEqual(message.tool);
      expect(typeof message.toolInput).toEqual("string");
      if (message.type === "stringified_object") {
        expect(JSON.parse(message.toolInput)).toStrictEqual(
          JSON.parse((parsed as AgentAction).toolInput)
        );
      } else {
        expect(message.toolInput).toContain((parsed as AgentAction).toolInput);
      }
    }
  }
});
