import { calendar, calendar_v3 } from "@googleapis/calendar";
import { Tool } from "./base";

export class ReadGoogleCalendar extends Tool {
  name = "read-google-calendar";

  private calendarClient: calendar_v3.Calendar;

  constructor(clientOptions: calendar_v3.Options) {
    super();
    this.calendarClient = calendar(clientOptions);
  }

  private async getNext10Events() {
    const res = await this.calendarClient.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    });
    const events = res.data.items;
    return events
      ? events.map((e) => ({
          summary: e.summary,
          time: e.start?.date || e.start?.dateTime,
        }))
      : [];
  }

  async call(_arg: string) {
    const events = await this.getNext10Events();
    return JSON.stringify(events);
  }

  description = `Get the next 10 events from your Google Calendar.`;
}
