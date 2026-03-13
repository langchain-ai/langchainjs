/* eslint-disable @typescript-eslint/no-explicit-any */
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

  handleCustomEvent(
    eventName: string,
    data: any,
    runId: string,
    tags?: string[],
    metadata?: Record<string, any>
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

  handleCustomRequestEvent(
    _eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    data: any,
    _runId: string,
    _tags?: string[],
    _metadata?: Record<string, any>
  ): any {
    this.request = data;
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
