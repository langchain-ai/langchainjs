/* eslint-disable prefer-template */
/* eslint-disable default-case */
/* eslint-disable no-plusplus */
// Adapted from https://github.com/gfortaine/fetch-event-source/blob/main/src/parse.ts
// due to a packaging issue in the original.
// MIT License
import { type Readable } from "stream";
import { IterableReadableStream } from "@langchain/core/utils/stream";

export const EventStreamContentType = "text/event-stream";

/**
 * Represents a message sent in an event stream
 * https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format
 */
export interface EventSourceMessage {
  /** The event ID to set the EventSource object's last event ID value. */
  id: string;
  /** A string identifying the type of event described. */
  event: string;
  /** The event data */
  data: string;
  /** The reconnection interval (in milliseconds) to wait before retrying the connection */
  retry?: number;
}

function isNodeJSReadable(x: unknown): x is Readable {
  return x != null && typeof x === "object" && "on" in x;
}

/**
 * Converts a ReadableStream into a callback pattern.
 * @param stream The input ReadableStream.
 * @param onChunk A function that will be called on each new byte chunk in the stream.
 * @returns {Promise<void>} A promise that will be resolved when the stream closes.
 */
export async function getBytes(
  stream: ReadableStream<Uint8Array>,
  onChunk: (arr: Uint8Array, flush?: boolean) => void
) {
  // stream is a Node.js Readable / PassThrough stream
  // this can happen if node-fetch is polyfilled
  if (isNodeJSReadable(stream)) {
    return new Promise<void>((resolve) => {
      stream.on("readable", () => {
        let chunk;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          chunk = stream.read();
          if (chunk == null) {
            onChunk(new Uint8Array(), true);
            break;
          }
          onChunk(chunk);
        }

        resolve();
      });
    });
  }

  const reader = stream.getReader();
  // CHANGED: Introduced a "flush" mechanism to process potential pending messages when the stream ends.
  //          This change is essential to ensure that we capture every last piece of information from streams,
  //          such as those from Azure OpenAI, which may not terminate with a blank line. Without this
  //          mechanism, we risk ignoring a possibly significant last message.
  //          See https://github.com/langchain-ai/langchainjs/issues/1299 for details.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await reader.read();
    if (result.done) {
      onChunk(new Uint8Array(), true);
      break;
    }
    onChunk(result.value);
  }
}

const enum ControlChars {
  NewLine = 10,
  CarriageReturn = 13,
  Space = 32,
  Colon = 58,
}

/**
 * Parses arbitary byte chunks into EventSource line buffers.
 * Each line should be of the format "field: value" and ends with \r, \n, or \r\n.
 * @param onLine A function that will be called on each new EventSource line.
 * @returns A function that should be called for each incoming byte chunk.
 */
export function getLines(
  onLine: (line: Uint8Array, fieldLength: number, flush?: boolean) => void
) {
  let buffer: Uint8Array | undefined;
  let position: number; // current read position
  let fieldLength: number; // length of the `field` portion of the line
  let discardTrailingNewline = false;

  // return a function that can process each incoming byte chunk:
  return function onChunk(arr: Uint8Array, flush?: boolean) {
    if (flush) {
      onLine(arr, 0, true);
      return;
    }

    if (buffer === undefined) {
      buffer = arr;
      position = 0;
      fieldLength = -1;
    } else {
      // we're still parsing the old line. Append the new bytes into buffer:
      buffer = concat(buffer, arr);
    }

    const bufLength = buffer.length;
    let lineStart = 0; // index where the current line starts
    while (position < bufLength) {
      if (discardTrailingNewline) {
        if (buffer[position] === ControlChars.NewLine) {
          lineStart = ++position; // skip to next char
        }

        discardTrailingNewline = false;
      }

      // start looking forward till the end of line:
      let lineEnd = -1; // index of the \r or \n char
      for (; position < bufLength && lineEnd === -1; ++position) {
        switch (buffer[position]) {
          case ControlChars.Colon:
            if (fieldLength === -1) {
              // first colon in line
              fieldLength = position - lineStart;
            }
            break;
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore:7029 \r case below should fallthrough to \n:
          case ControlChars.CarriageReturn:
            discardTrailingNewline = true;
          // eslint-disable-next-line no-fallthrough
          case ControlChars.NewLine:
            lineEnd = position;
            break;
        }
      }

      if (lineEnd === -1) {
        // We reached the end of the buffer but the line hasn't ended.
        // Wait for the next arr and then continue parsing:
        break;
      }

      // we've reached the line end, send it out:
      onLine(buffer.subarray(lineStart, lineEnd), fieldLength);
      lineStart = position; // we're now on the next line
      fieldLength = -1;
    }

    if (lineStart === bufLength) {
      buffer = undefined; // we've finished reading it
    } else if (lineStart !== 0) {
      // Create a new view into buffer beginning at lineStart so we don't
      // need to copy over the previous lines when we get the new arr:
      buffer = buffer.subarray(lineStart);
      position -= lineStart;
    }
  };
}

/**
 * Parses line buffers into EventSourceMessages.
 * @param onId A function that will be called on each `id` field.
 * @param onRetry A function that will be called on each `retry` field.
 * @param onMessage A function that will be called on each message.
 * @returns A function that should be called for each incoming line buffer.
 */
export function getMessages(
  onMessage?: (msg: EventSourceMessage) => void,
  onId?: (id: string) => void,
  onRetry?: (retry: number) => void
) {
  let message = newMessage();
  const decoder = new TextDecoder();

  // return a function that can process each incoming line buffer:
  return function onLine(
    line: Uint8Array,
    fieldLength: number,
    flush?: boolean
  ) {
    if (flush) {
      if (!isEmpty(message)) {
        onMessage?.(message);
        message = newMessage();
      }
      return;
    }

    if (line.length === 0) {
      // empty line denotes end of message. Trigger the callback and start a new message:
      onMessage?.(message);
      message = newMessage();
    } else if (fieldLength > 0) {
      // exclude comments and lines with no values
      // line is of format "<field>:<value>" or "<field>: <value>"
      // https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
      const field = decoder.decode(line.subarray(0, fieldLength));
      const valueOffset =
        fieldLength + (line[fieldLength + 1] === ControlChars.Space ? 2 : 1);
      const value = decoder.decode(line.subarray(valueOffset));

      switch (field) {
        case "data":
          // if this message already has data, append the new value to the old.
          // otherwise, just set to the new value:
          message.data = message.data ? message.data + "\n" + value : value; // otherwise,
          break;
        case "event":
          message.event = value;
          break;
        case "id":
          onId?.((message.id = value));
          break;
        case "retry": {
          const retry = parseInt(value, 10);
          if (!Number.isNaN(retry)) {
            // per spec, ignore non-integers
            onRetry?.((message.retry = retry));
          }
          break;
        }
      }
    }
  };
}

function concat(a: Uint8Array, b: Uint8Array) {
  const res = new Uint8Array(a.length + b.length);
  res.set(a);
  res.set(b, a.length);
  return res;
}

function newMessage(): EventSourceMessage {
  // data, event, and id must be initialized to empty strings:
  // https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
  // retry should be initialized to undefined so we return a consistent shape
  // to the js engine all the time: https://mathiasbynens.be/notes/shapes-ics#takeaways
  return {
    data: "",
    event: "",
    id: "",
    retry: undefined,
  };
}

export function convertEventStreamToIterableReadableDataStream(
  stream: ReadableStream
) {
  const dataStream = new ReadableStream({
    async start(controller) {
      const enqueueLine = getMessages((msg) => {
        if (msg.data) controller.enqueue(msg.data);
      });
      const onLine = (
        line: Uint8Array,
        fieldLength: number,
        flush?: boolean
      ) => {
        enqueueLine(line, fieldLength, flush);
        if (flush) controller.close();
      };
      await getBytes(stream, getLines(onLine));
    },
  });
  return IterableReadableStream.fromReadableStream(dataStream);
}

function isEmpty(message: EventSourceMessage): boolean {
  return (
    message.data === "" &&
    message.event === "" &&
    message.id === "" &&
    message.retry === undefined
  );
}
