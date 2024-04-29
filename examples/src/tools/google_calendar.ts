import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { OpenAI } from "@langchain/openai";
import { Calculator } from "@langchain/community/tools/calculator";
import {
  GoogleCalendarCreateTool,
  GoogleCalendarViewTool,
} from "@langchain/community/tools/google_calendar";

export async function run() {
  const model = new OpenAI({
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
  });

  const googleCalendarParams = {
    credentials: {
      clientEmail: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL,
      privateKey: process.env.GOOGLE_CALENDAR_PRIVATE_KEY,
      calendarId: process.env.GOOGLE_CALENDAR_CALENDAR_ID,
    },
    scopes: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    model,
  };

  const tools = [
    new Calculator(),
    new GoogleCalendarCreateTool(googleCalendarParams),
    new GoogleCalendarViewTool(googleCalendarParams),
  ];

  const calendarAgent = await initializeAgentExecutorWithOptions(tools, model, {
    agentType: "zero-shot-react-description",
    verbose: true,
  });

  const createInput = `Create a meeting with John Doe next Friday at 4pm - adding to the agenda of it the result of 99 + 99`;

  const createResult = await calendarAgent.invoke({ input: createInput });
  //   Create Result {
  //     output: 'A meeting with John Doe on 29th September at 4pm has been created and the result of 99 + 99 has been added to the agenda.'
  //   }
  console.log("Create Result", createResult);

  const viewInput = `What meetings do I have this week?`;

  const viewResult = await calendarAgent.invoke({ input: viewInput });
  //   View Result {
  //     output: "You have no meetings this week between 8am and 8pm."
  //   }
  console.log("View Result", viewResult);
}
