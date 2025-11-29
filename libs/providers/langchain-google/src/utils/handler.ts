import { BaseCallbackHandler } from "@langchain/core/callbacks/base";

export interface GoogleCustomEventInfo {
  subEvent: string;
  module: string;
}

export abstract class GoogleRequestCallbackHandler extends BaseCallbackHandler {
  customEventInfo(eventName: string): GoogleCustomEventInfo {
    const names = eventName.split("-");
    return {
      subEvent: names[1],
      module: names[2],
    };
  }

  abstract handleCustomRequestEvent(
    eventName: string,
    eventInfo: GoogleCustomEventInfo,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    runId: string,
    tags?: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any;

  abstract handleCustomResponseEvent(
    eventName: string,
    eventInfo: GoogleCustomEventInfo,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    runId: string,
    tags?: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any;

  abstract handleCustomChunkEvent(
    eventName: string,
    eventInfo: GoogleCustomEventInfo,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    runId: string,
    tags?: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any;

  handleCustomEvent(
    eventName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    runId: string,
    tags?: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    if (!eventName) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(eventName: string, data: any, tags?: string[]): undefined {
    const tagStr = tags ? `[${tags}]` : "[]";
    console.log(`${eventName} ${tagStr} ${JSON.stringify(data, null, 1)}`);
  }

  handleCustomRequestEvent(
    eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    _runId: string,
    tags?: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _metadata?: Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    this.log(eventName, data, tags);
  }

  handleCustomResponseEvent(
    eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    _runId: string,
    tags?: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _metadata?: Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    this.log(eventName, data, tags);
  }

  handleCustomChunkEvent(
    eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    _runId: string,
    tags?: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _metadata?: Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    this.log(eventName, data, tags);
  }
}

export class GoogleRequestRecorder extends GoogleRequestCallbackHandler {
  name = "GoogleRequestRecorder";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: any = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chunk: any[] = [];

  handleCustomRequestEvent(
    _eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    _runId: string,
    _tags?: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _metadata?: Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    this.request = data;
  }

  handleCustomResponseEvent(
    _eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    _runId: string,
    _tags?: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _metadata?: Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    this.response = data;
  }

  handleCustomChunkEvent(
    _eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    _runId: string,
    _tags?: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _metadata?: Record<string, any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    this.chunk.push(data);
  }
}
