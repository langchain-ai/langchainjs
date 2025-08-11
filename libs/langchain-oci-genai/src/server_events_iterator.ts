import { IterableReadableStream } from "@langchain/core/utils/stream";

export class JsonServerEventsIterator {
  static readonly _DATA_PREFIX: string = "data: ";

  static readonly _DATA_PREFIX_LENGTH =
    JsonServerEventsIterator._DATA_PREFIX.length;

  _eventsStream: IterableReadableStream<Uint8Array>;

  _textDecoder: TextDecoder = new TextDecoder();

  _textBuffer: string = "";

  constructor(sourceStream: ReadableStream<Uint8Array>) {
    this._eventsStream =
      IterableReadableStream.fromReadableStream(sourceStream);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<unknown> {
    for await (const eventRawData of this._eventsStream) {
      this._textBuffer += this._textDecoder.decode(eventRawData);

      if (this._completeMessageReceived()) {
        yield this._parseMessage();
        this._textBuffer = "";
      }
    }
  }

  _completeMessageReceived(): boolean {
    return this._textBuffer.endsWith("\n\n");
  }

  _parseMessage(): unknown {
    this._assertDataMessage();
    const justJsonText: string = this._textBuffer.substring(
      JsonServerEventsIterator._DATA_PREFIX_LENGTH
    );
    return this._tryParseTextToJson(justJsonText);
  }

  _assertDataMessage() {
    if (!this._textBuffer.startsWith(JsonServerEventsIterator._DATA_PREFIX)) {
      throw new Error("Event text is empty, too short or malformed");
    }
  }

  _tryParseTextToJson(jsonText: string): unknown {
    const parsedJson: unknown = this._parseTextToJson(jsonText);
    this._assertParsedJson(parsedJson);
    return parsedJson;
  }

  _parseTextToJson(jsonText: string) {
    try {
      return JSON.parse(jsonText);
    } catch {
      throw new Error("Could not parse event data as JSON");
    }
  }

  _assertParsedJson(parsedJson: unknown) {
    if (typeof parsedJson !== "object" || parsedJson === null) {
      throw new Error("Event data could not be parsed into an object");
    }
  }
}
