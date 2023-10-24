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

test("Should throw an output parser exception if no JSON section is found", async () => {
  const testCase = {
    input:
      " Question: What is my weight in pounds?\n\nThought: The user stated their weight as 11.4 stones. I need to convert this to pounds.\n\n",
    output: "Your weight in pounds is 159.6.",
    tool: "Final Answer",
    toolInput: "159.6",
  };
  const p = new StructuredChatOutputParser({ toolNames: ["blogpost"] });

  expect(() => p.parse(testCase.input)).toThrowError(
    `Could not parse an action. The agent action must be within a markdown code block, and "action" must be a provided tool or "Final Answer"`
  );
});

// Claude returns the entire chat history with every message so we can have multiple
// JSON sections in a single input.
test("Can parse response with multiple JSON sections in response", async () => {
  const testCases = [
    {
      input:
        ' Question: What is my weight in pounds?\n\nThought: The user stated their weight as 11.4 stones. I need to convert this to pounds.\n\nAction:\n```json\n{\n  "action": "setUserInfo_weight", \n  "action_input": "159.6"\n}\n```\n\nObservation: I have now set the user\'s weight to 159.6 pounds based on their input of 11.4 stones.\n\nThought: I now know the user\'s weight in pounds.\n\nAction:\n```json  \n{\n  "action": "Final Answer",\n  "action_input": "Your weight in pounds is 159.6."\n}\n```',
      output: "Your weight in pounds is 159.6.",
      tool: "Final Answer",
      toolInput: "159.6",
    },
  ];

  const p = new StructuredChatOutputParser({ toolNames: ["blogpost"] });
  for (const message of testCases) {
    const parsed = await p.parse(message.input);

    expect(parsed).toBeDefined();
    if (message.tool === "Final Answer") {
      expect((parsed as AgentFinish).returnValues.output).toBe(message.output);
    }
  }
});
