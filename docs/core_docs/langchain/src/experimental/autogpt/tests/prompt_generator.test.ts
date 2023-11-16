import { test, expect } from "@jest/globals";
import { z } from "zod";

import { getPrompt } from "../prompt_generator.js";
import { StructuredTool } from "../../../tools/base.js";
import { Calculator } from "../../../tools/calculator.js";
import { ReadFileTool, WriteFileTool } from "../../../tools/fs.js";
import { InMemoryFileStore } from "../../../stores/file/in_memory.js";

class FakeBrowserTool extends StructuredTool {
  schema = z.object({
    url: z.string(),
    query: z.string().optional(),
  });

  name = "fake_browser_tool";

  description =
    "useful for when you need to find something on the web or summarize a webpage.";

  async _call({
    url: _url,
    query: _query,
  }: z.infer<this["schema"]>): Promise<string> {
    return "fake_browser_tool";
  }
}

test("prompt with several tools", () => {
  const store = new InMemoryFileStore();
  const tools = [
    new FakeBrowserTool(),
    new Calculator(),
    new ReadFileTool({ store }),
    new WriteFileTool({ store }),
  ];
  const prompt = getPrompt(tools);
  expect(prompt).toMatchInlineSnapshot(`
    "Constraints:
    1. ~4000 word limit for short term memory. Your short term memory is short, so immediately save important information to files.
    2. If you are unsure how you previously did something or want to recall past events, thinking about similar events will help you remember.
    3. No user assistance
    4. Exclusively use the commands listed in double quotes e.g. "command name"

    Commands:
    1. "fake_browser_tool": useful for when you need to find something on the web or summarize a webpage., args json schema: {"url":{"type":"string"},"query":{"type":"string"}}
    2. "calculator": Useful for getting the result of a math expression. The input to this tool should be a valid mathematical expression that could be executed by a simple calculator., args json schema: {"input":{"type":"string"}}
    3. "read_file": Read file from disk, args json schema: {"file_path":{"type":"string","description":"name of file"}}
    4. "write_file": Write file from disk, args json schema: {"file_path":{"type":"string","description":"name of file"},"text":{"type":"string","description":"text to write to file"}}
    5. finish: use this to signal that you have finished all your objectives, args: "response": "final response to let people know you have finished your objectives"

    Resources:
    1. Internet access for searches and information gathering.
    2. Long Term memory management.
    3. GPT-3.5 powered Agents for delegation of simple tasks.
    4. File output.

    Performance Evaluation:
    1. Continuously review and analyze your actions to ensure you are performing to the best of your abilities.
    2. Constructively self-criticize your big-picture behavior constantly.
    3. Reflect on past decisions and strategies to refine your approach.
    4. Every command has a cost, so be smart and efficient. Aim to complete tasks in the least number of steps.

    You should only respond in JSON format as described below 
    Response Format: 
    {
        "thoughts": {
            "text": "thought",
            "reasoning": "reasoning",
            "plan": "- short bulleted\\n- list that conveys\\n- long-term plan",
            "criticism": "constructive self-criticism",
            "speak": "thoughts summary to say to user"
        },
        "command": {
            "name": "command name",
            "args": {
                "arg name": "value"
            }
        }
    } 
    Ensure the response can be parsed by Python json.loads"
  `);
});
