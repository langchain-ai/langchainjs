import type { EventSourceMessage } from "./event-source-parse.js";

export interface StreamingAxiosConfiguration {
  responseType: "stream";

  /**
   * Called when a message is received. NOTE: Unlike the default browser
   * EventSource.onmessage, this callback is called for _all_ events,
   * even ones with a custom `event` field.
   */
  onmessage?: (ev: EventSourceMessage) => void;
}
