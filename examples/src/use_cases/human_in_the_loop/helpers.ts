import { ChatOpenAI } from "@langchain/openai";
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  Runnable,
  RunnableLambda,
  RunnablePassthrough,
} from "@langchain/core/runnables";

class CountEmails extends StructuredTool {
  schema = z.object({
    lastNDays: z.number(),
  });

  name = "count_emails";

  description = "Count the number of emails sent in the last N days.";

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    return (input.lastNDays * 2).toString();
  }
}

class SendEmail extends StructuredTool {
  schema = z.object({
    message: z.string(),
    recipient: z.string(),
  });

  name = "send_email";

  description = "Send an email.";

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    return `Successfully sent email to ${input.recipient}`;
  }
}

const tools = [new CountEmails(), new SendEmail()];
export const model = new ChatOpenAI({
  model: "gpt-3.5-turbo",
  temperature: 0,
}).bindTools(tools);

const callTool = (toolInvocation: Record<string, any>): Runnable => {
  const toolMap: Record<string, StructuredTool> = tools.reduce((acc, tool) => {
    acc[tool.name] = tool;
    return acc;
  }, {} as Record<string, StructuredTool>);
  const tool = toolMap[toolInvocation.type];
  return RunnablePassthrough.assign({
    output: (input, config) => tool.invoke(input.args, config),
  });
};

export const callToolList = new RunnableLambda({ func: callTool }).map();
