import type { AxiosRequestConfig } from "axios";
import { EventSourceMessage } from "@langchain/core/utils/event_source_parse";

export interface StreamingAxiosRequestConfig extends AxiosRequestConfig {
  responseType: "stream";

  /**
   * Called when a message is received. NOTE: Unlike the default browser
   * EventSource.onmessage, this callback is called for _all_ events,
   * even ones with a custom `event` field.
   */
  onmessage?: (ev: EventSourceMessage) => void;
}

export type StreamingAxiosConfiguration =
  | StreamingAxiosRequestConfig
  | AxiosRequestConfig;
