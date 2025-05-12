import { IterableReadableStream } from "@langchain/core/utils/stream";

export class JsonServerEventsIterator {
  static readonly _SERVER_EVENT_DATA_PREFIX: string = "data: ";

  static readonly _SERVER_EVENT_DATA_PREFIX_LENGTH: number =
    this._SERVER_EVENT_DATA_PREFIX.length;

  _eventsStream: IterableReadableStream<Uint8Array>;

  _textDecoder: TextDecoder;

  constructor(sourceStream: ReadableStream<Uint8Array>) {
    this._eventsStream =
      IterableReadableStream.fromReadableStream(sourceStream);
    this._textDecoder = new TextDecoder();
  }

  async *[Symbol.asyncIterator](): AsyncIterator<unknown> {
    for await (const eventRawData of this._eventsStream) {
      yield this._parseEvent(eventRawData);
    }
  }

  _parseEvent(eventRawData: Uint8Array): unknown {
    const eventDataText: string = this._getEventDataText(eventRawData);
    const eventData: unknown =
      JsonServerEventsIterator._getEventDataAsJson(eventDataText);
    JsonServerEventsIterator._assertEventData(eventData);

    return eventData;
  }

  _getEventDataText(eventData: Uint8Array): string {
    JsonServerEventsIterator._assertEventRawData(eventData);
    const eventDataText: string = this._textDecoder.decode(eventData);
    JsonServerEventsIterator._assertEventText(eventDataText);
    return eventDataText;
  }

  static _assertEventRawData(eventRawData: Uint8Array) {
    if (eventRawData.length < this._SERVER_EVENT_DATA_PREFIX_LENGTH) {
      throw new Error("Event raw data is empty or too short to be valid");
    }
  }

  static _assertEventText(eventText: string) {
    if (
      eventText.length < this._SERVER_EVENT_DATA_PREFIX_LENGTH ||
      !eventText.startsWith(this._SERVER_EVENT_DATA_PREFIX)
    ) {
      throw new Error("Event text is empty, too short or malformed");
    }
  }

  static _assertEventData(eventData: unknown) {
    if (eventData === null || typeof eventData !== "object") {
      throw new Error("Event data could not be parsed into an object");
    }
  }

  static _getEventDataAsJson(eventDataText: string): unknown {
    try {
      const eventJsonText: string = this._getEventJsonText(eventDataText);
      return JSON.parse(eventJsonText);
    } catch {
      throw new Error("Could not parse event data as JSON");
    }
  }

  static _getEventJsonText(eventDataText: string): string {
    return eventDataText.substring(
      JsonServerEventsIterator._SERVER_EVENT_DATA_PREFIX_LENGTH
    );
  }
}