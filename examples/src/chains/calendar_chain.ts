import { OpenAI } from "langchain";
import { ReadGoogleCalendar } from "langchain/agents/tools/read-google-calendar";
import { authenticate } from "@google-cloud/local-auth";
import { CalendarChain } from "langchain/chains";

export const run = async () => {
  const model = new OpenAI({});

  const authClient = await authenticate({
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    keyfilePath: process.env.GOOGLE_KEYFILE_PATH ?? "",
  });
  const calendarTool = new ReadGoogleCalendar({
    auth: authClient,
    version: "v3",
  });

  const chain = CalendarChain.fromLLM(model, calendarTool);

  const res = await chain.call({ question: "Are there any events next week?" });
  console.log({ res });
};
