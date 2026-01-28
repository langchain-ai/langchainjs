import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { GoogleCalendarBase, GoogleCalendarAgentParams } from "./base.js";
import { runDeleteEvent } from "./commands/run-delete-events.js";
import { DELETE_TOOL_DESCRIPTION } from "./descriptions.js";

/**
 * @example
 * ```typescript
 * const googleCalendarDeleteTool = new GoogleCalendarDeleteTool({
 *   credentials: {
 *     clientEmail: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL,
 *     privateKey: process.env.GOOGLE_CALENDAR_PRIVATE_KEY,
 *     calendarId: process.env.GOOGLE_CALENDAR_CALENDAR_ID,
 *   },
 *   scopes: [
 *     "https://www.googleapis.com/auth/calendar",
 *     "https://www.googleapis.com/auth/calendar.events",
 *   ],
 *   model: new ChatOpenAI({ model: "gpt-4o-mini" }),
 * });
 * const deleteInput = `Delete the meeting with John at 3pm`;
 * const deleteResult = await googleCalendarDeleteTool.invoke({
 *   input: deleteInput,
 * });
 * console.log("Delete Result", deleteResult);
 * ```
 */
export class GoogleCalendarDeleteTool extends GoogleCalendarBase {
  name = "google_calendar_delete";

  description = DELETE_TOOL_DESCRIPTION;

  constructor(fields: GoogleCalendarAgentParams) {
    super(fields);
  }

  async _call(query: string, runManager?: CallbackManagerForToolRun) {
    const calendar = await this.getCalendarClient();
    const model = this.getModel();

    return runDeleteEvent(
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
