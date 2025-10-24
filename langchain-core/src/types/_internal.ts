// Make this a type to override ReadableStream's async iterator type in case
// the popular web-streams-polyfill is imported - the supplied types
// in that case don't quite match.
export type IterableReadableStreamInterface<T> = ReadableStream<T> &
  AsyncIterable<T>;
