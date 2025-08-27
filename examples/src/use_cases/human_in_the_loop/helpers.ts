import { ChatOpenAI } from "@langchain/openai";
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod/v3";
import {
  Runnable,
  RunnableLambda,
  RunnablePassthrough,
} from "@langchain/core/runnables";

const countEmailsSchema = z.object({
  lastNDays: z.number(),
});
type CountEmailsSchema = z.infer<typeof countEmailsSchema>;

class CountEmails extends StructuredTool {
  schema = countEmailsSchema;

  name = "count_emails";

  description = "Count the number of emails sent in the last N days.";

  async _call(input: CountEmailsSchema): Promise<string> {
    return (input.lastNDays * 2).toString();
  }
}

const sendEmailSchema = z.object({
  message: z.string(),
  recipient: z.string(),
});
type SendEmailSchema = z.infer<typeof sendEmailSchema>;

class SendEmail extends StructuredTool {
  schema = sendEmailSchema;

  name = "send_email";

  description = "Send an email.";

  async _call(input: SendEmailSchema): Promise<string> {
    return `Successfully sent email to ${input.recipient}`;
  }
}

const tools = [new CountEmails(), new SendEmail()];
export const model: Runnable = new ChatOpenAI({
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

export const callToolList: Runnable = new RunnableLambda({
  func: callTool,
}).map();
