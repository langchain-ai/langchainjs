import { CallbackManagerForToolRun } from "../../callbacks/manager.js";
import { GoogleCalendarBase, GoogleCalendarAgentParams } from "./base.js";
import { runCreateEvent } from "./commands/run-create-events.js";
import { CREATE_TOOL_DESCRIPTION } from "./descriptions.js";

export class GoogleCalendarCreateTool extends GoogleCalendarBase {
  name = "google_calendar_create";

  description = CREATE_TOOL_DESCRIPTION;

  constructor(fields: GoogleCalendarAgentParams) {
    super(fields);
  }

  async _call(query: string, runManager?: CallbackManagerForToolRun) {
    const auth = await this.getAuth();
    const model = this.getModel();

    return runCreateEvent(
      query,
      {
        auth,
        model,
        calendarId: this.calendarId,
      },
      runManager
    );
  }
}
