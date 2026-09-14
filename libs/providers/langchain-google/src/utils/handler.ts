/* oxlint-disable @typescript-eslint/no-explicit-any */
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";

export interface GoogleCustomEventInfo {
  subEvent: string;
  module: string;
}

export abstract class GoogleRequestCallbackHandler extends BaseCallbackHandler {
  customEventInfo(eventName: string): GoogleCustomEventInfo {
    const names = eventName.split("-");
    return {
      subEvent: names[1] ?? names[0],
      module: names.slice(2).join("-") || "ChatGoogle",
    };
  }

  abstract handleCustomRequestEvent(
    eventName: string,
    eventInfo: GoogleCustomEventInfo,
    data: any,
    runId: string,
    tags?: string[],
    metadata?: Record<string, any>
  ): any;

  abstract handleCustomResponseEvent(
    eventName: string,
    eventInfo: GoogleCustomEventInfo,
    data: any,
    runId: string,
    tags?: string[],
    metadata?: Record<string, any>
  ): any;

  abstract handleCustomChunkEvent(
    eventName: string,
    eventInfo: GoogleCustomEventInfo,
    data: any,
    runId: string,
    tags?: string[],
    metadata?: Record<string, any>
  ): any;

  handleStreamEvent(event: ChatModelStreamEvent): void {
    if (event.event === "provider" && event.provider === "google") {
      const eventInfo: GoogleCustomEventInfo = {
        subEvent: event.name,
        module: "ChatGoogle",
      };
      const eventName = `google-${event.name}-ChatGoogle`;
      switch (event.name) {
        case "request":
          this.handleCustomRequestEvent(
            eventName,
            eventInfo,
            event.payload,
            ""
          );
          break;
        case "response":
          this.handleCustomResponseEvent(
            eventName,
            eventInfo,
            event.payload,
            ""
          );
          break;
        case "chunk":
          this.handleCustomChunkEvent(eventName, eventInfo, event.payload, "");
          break;
        default:
          break;
      }
    }
  }

  handleChatModelStreamEvent(event: ChatModelStreamEvent): void {
    this.handleStreamEvent(event);
  }

  async *tap(
    stream: AsyncIterable<ChatModelStreamEvent>
  ): AsyncGenerator<ChatModelStreamEvent> {
    for await (const event of stream) {
      this.handleStreamEvent(event);
      yield event;
    }
  }

  handleCustomEvent(
    eventName: string,
    data: any,
    runId: string,
    tags?: string[],
    metadata?: Record<string, any>
  ): any {
    if (!eventName || !eventName.startsWith("google-")) {
      return undefined;
    }
    const eventInfo = this.customEventInfo(eventName);
    switch (eventInfo.subEvent) {
      case "request":
        return this.handleCustomRequestEvent(
          eventName,
          eventInfo,
          data,
          runId,
          tags,
          metadata
        );
      case "response":
        return this.handleCustomResponseEvent(
          eventName,
          eventInfo,
          data,
          runId,
          tags,
          metadata
        );
      case "chunk":
        return this.handleCustomChunkEvent(
          eventName,
          eventInfo,
          data,
          runId,
          tags,
          metadata
        );
      default:
        console.error(
          `Unexpected eventInfo for ${eventName} ${JSON.stringify(
            eventInfo,
            null,
            1
          )}`
        );
    }
  }
}

export class GoogleRequestLogger extends GoogleRequestCallbackHandler {
  name: string = "GoogleRequestLogger";

  shortenStringLength = 40;

  log(eventName: string, data: any, tags?: string[]): undefined {
    const splitLen = this.shortenStringLength;
    const half = splitLen / 2;
    const replacer = (_key: string, value: any) => {
      if (
        typeof value === "string" &&
        splitLen > 0 &&
        value.length > splitLen
      ) {
        return `${value.substring(0, half)}...${value.substring(
          value.length - half
        )}`;
      }
      return value;
    };
    const tagStr = tags ? `[${tags}]` : "[]";
    console.log(`${eventName} ${tagStr} ${JSON.stringify(data, replacer, 1)}`);
  }

  handleCustomRequestEvent(
    eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    data: any,
    _runId: string,
    tags?: string[],
    _metadata?: Record<string, any>
  ): any {
    this.log(eventName, data, tags);
  }

  handleCustomResponseEvent(
    eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    data: any,
    _runId: string,
    tags?: string[],
    _metadata?: Record<string, any>
  ): any {
    this.log(eventName, data, tags);
  }

  handleCustomChunkEvent(
    eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    data: any,
    _runId: string,
    tags?: string[],
    _metadata?: Record<string, any>
  ): any {
    this.log(eventName, data, tags);
  }
}

export class GoogleRequestRecorder extends GoogleRequestCallbackHandler {
  name = "GoogleRequestRecorder";

  request: any = {};

  response: any = {};

  chunk: any[] = [];

  requests: any[] = [];

  responses: any[] = [];

  get chunks(): any[] {
    return this.chunk;
  }

  reset(): void {
    this.request = {};
    this.response = {};
    this.chunk = [];
    this.requests = [];
    this.responses = [];
  }

  handleCustomRequestEvent(
    _eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    data: any,
    _runId: string,
    _tags?: string[],
    _metadata?: Record<string, any>
  ): any {
    this.request = data;
    this.requests.push(data);
  }

  handleCustomResponseEvent(
    _eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    data: any,
    _runId: string,
    _tags?: string[],
    _metadata?: Record<string, any>
  ): any {
    this.response = data;
    this.responses.push(data);
  }

  handleCustomChunkEvent(
    _eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    data: any,
    _runId: string,
    _tags?: string[],
    _metadata?: Record<string, any>
  ): any {
    this.chunk.push(data);
  }
}
