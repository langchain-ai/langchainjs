import { test, expect } from "@jest/globals";
import { ChatConversationalAgentOutputParser } from "../chat_convo/outputParser.js";
import { AgentAction, AgentFinish } from "../../schema/index.js";

test("Can parse JSON with text in front of it", async () => {
  const testCases = [
    {
      input: `Based on the information from the search, I can provide you with a query to get all the orders for the email \`example@gmail.com\`. Here's the query:\n\n\`\`\`sql\nSELECT * FROM orders\nJOIN users ON users.id = orders.user_id\nWHERE users.email = 'example@gmail.com'\n\`\`\`\n\nPlease make any necessary modifications depending on your database schema and table structures. Run this query on your database to retrieve the orders made by the specified user.\n\n\`\`\`json\n{\n  "action": "Final Answer",\n  "action_input": "To get all the orders for a user with the email \`example@gmail.com\`, you can use the following query:\\n\\n\`\`\`\\nSELECT * FROM orders\\nJOIN users ON users.id = orders.user_id\\nWHERE users.email = 'example@gmail.com'\\n\`\`\`\\n\\nPlease make any necessary modifications depending on your database schema and table structures. Run this query on your database to retrieve the orders made by the specified user."\n}\n\`\`\``,
      output: `{\n  "action": "Final Answer",\n  "action_input": "To get all the orders for a user with the email \`example@gmail.com\`, you can use the following query:\\n\\n\`\`\`\\nSELECT * FROM orders\\nJOIN users ON users.id = orders.user_id\\nWHERE users.email = 'example@gmail.com'\\n\`\`\`\\n\\nPlease make any necessary modifications depending on your database schema and table structures. Run this query on your database to retrieve the  made by the specifsredroied user."\n}`,
      tool: "Final Answer",
      toolInput: "To get all the orders for a user with the email ",
    },

    {
      input:
        'Here is an example of a valid JSON object matching the provided spec:\n\n```json\n{\n  "action": "metabase",\n  "action_input": ["GET", "/api/table/1"]\n}\n```\n\nIn this example, the "action" key has a string value of "metabase", and the "action_input" key has an array value containing two elements: a string value of "GET" and a string value of "/api/table/1". This JSON object could be used to make a request to a Metabase API endpoint with the specified method and arguments.',
      output: `{ "action": "metabase", "action_input": ["GET", "/api/table/1"] } `,
      tool: "metabase",
      toolInput: ["GET", "/api/table/1"],
    },
    {
      input:
        '```\n{\n  "action": "metabase",\n  "action_input": ["GET", "/api/table/1"]\n}\n```',
      output: `{ "action": "metabase", "action_input": ["GET", "/api/table/1"] } `,
      tool: "metabase",
      toolInput: ["GET", "/api/table/1"],
    },
    {
      input:
        'Here we have some boilerplate nonsense```\n{\n "action": "blogpost",\n  "action_input": "```sql\\nSELECT * FROM orders\\nJOIN users ON users.id = orders.user_id\\nWHERE users.email = \'bud\'```"\n}\n``` and at the end there is more nonsense',
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
    {
      input:
        '{\n \t\r\n"action":"Final Answer",\n\t\r  "action_input":"The tool input ```json\\n{\\"yes\\":true}\\n```"\n\t\r}',
      output:
        '{"action":"Final Answer","action_input":"The tool input ```json\\n{\\"yes\\":true}\\n```"}',
      tool: "Final Answer",
      toolInput: 'The tool input ```json\\n{\\"yes\\":true}\\n```',
    },
    {
      input:
        '```json\n{\n \t\r\n"action":"Final Answer",\n\t\r  "action_input":"The tool input ```json\\n{\\"yes\\":true}\\n```"\n\t\r}\n\n\n\t\r```',
      output:
        '{"action":"Final Answer","action_input":"The tool input ```json\\n{\\"yes\\":true}\\n```"}',
      tool: "Final Answer",
      toolInput: 'The tool input ```json\\n{\\"yes\\":true}\\n```',
    },
    {
      input:
        'Here we have some boilerplate nonsense```json\n{\n \t\r\n"action":"Final Answer",\n\t\r  "action_input":"The tool input ```json\\n{\\"yes\\":true}\\n```"\n\t\r}\n\n\n\t\r``` and at the end there is more nonsense',
      output:
        '{"action":"Final Answer","action_input":"The tool input ```json\\n{\\"yes\\":true}\\n```"}',
      tool: "Final Answer",
      toolInput: 'The tool input ```json\\n{\\"yes\\":true}\\n```',
    },
    {
      input:
        'Here we have some boilerplate nonsense```\n{\n \t\r\n"action":"Final Answer",\n\t\r  "action_input":"The tool input ```javascript\\n{\\"yes\\":true}\\n```"\n\t\r}\n\n\n\t\r``` and at the end there is more nonsense',
      output:
        '{"action":"Final Answer","action_input":"The tool input ```javascript\\n{\\"yes\\":true}\\n```"}',
      tool: "Final Answer",
      toolInput: 'The tool input ```javascript\\n{\\"yes\\":true}\\n```',
    },
    {
      input:
        '{\n \t\r\n"action":"Final Answer",\n\t\r  "action_input":"The tool input ```javascript\\n{\\"yes\\":true}\\n```"\n\t\r}',
      output:
        '{"action":"Final Answer","action_input":"The tool input ```javascript\\n{\\"yes\\":true}\\n```"}',
      tool: "Final Answer",
      toolInput: 'The tool input ```javascript\\n{\\"yes\\":true}\\n```',
    },
    {
      input:
        '{\n \t\r\n"action":"Final Answer",\n\t\r  "action_input":"this is a regular text response"\n\t\r}',
      output:
        '{"action":"Final Answer","action_input":"this is a regular text response"}',
      tool: "Final Answer",
      toolInput: "this is a regular text response",
    },
  ];

  const p = new ChatConversationalAgentOutputParser({
    toolNames: ["blogpost", "metabase", "ToolWithJson"],
  });
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
