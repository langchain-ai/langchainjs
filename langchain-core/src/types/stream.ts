// Make this a type to override ReadableStream's async iterator type in case
// the popular web-streams-polyfill is imported - the supplied types
// in that case don't quite match.
export { type IterableReadableStreamInterface } from "./_internal.js";

export {
  type StreamEvent,
  type StreamEventData,
} from "../tracers/event_stream.js";
