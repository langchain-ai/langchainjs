import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { GoogleCalendarBase, GoogleCalendarAgentParams } from "./base.js";
import { runCreateEvent } from "./commands/run-create-events.js";
import { CREATE_TOOL_DESCRIPTION } from "./descriptions.js";

/**
 * @example
 * ```typescript
 * const googleCalendarCreateTool = new GoogleCalendarCreateTool({
 *   credentials: {
 *     clientEmail: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL,
 *     privateKey: process.env.GOOGLE_CALENDAR_PRIVATE_KEY,
 *     calendarId: process.env.GOOGLE_CALENDAR_CALENDAR_ID,
 *   },
 *   scopes: [
 *     "https:
 *     "https:
 *   ],
 *   model: new ChatOpenAI({ model: "gpt-4o-mini" }),
 * });
 * const createInput = `Create a meeting with John Doe next Friday at 4pm - adding to the agenda of it the result of 99 + 99`;
 * const createResult = await googleCalendarCreateTool.invoke({
 *   input: createInput,
 * });
 * console.log("Create Result", createResult);
 * ```
 */
export class GoogleCalendarCreateTool extends GoogleCalendarBase {
  name = "google_calendar_create";

  description = CREATE_TOOL_DESCRIPTION;

  constructor(fields: GoogleCalendarAgentParams) {
    super(fields);
  }

  async _call(query: string, runManager?: CallbackManagerForToolRun) {
    const calendar = await this.getCalendarClient();
    const model = this.getModel();

    return runCreateEvent(
      query,
      {
        calendar,
        model,
        calendarId: this.calendarId,
      },
      runManager
    );
  }
}
