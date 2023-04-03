// eslint-disable-next-line import/no-extraneous-dependencies
import { AxiosRequestConfig, AxiosPromise } from "axios";

export default function fetchAdapter(config: AxiosRequestConfig): AxiosPromise;

export interface StreamingAxiosConfiguration {
  responseType: "stream";

  /**
   * Called when a message is received. NOTE: Unlike the default browser
   * EventSource.onmessage, this callback is called for _all_ events,
   * even ones with a custom `event` field.
   */
  onmessage?: (ev: EventSourceMessage) => void;
}
