import { EventEmitter } from "node:events";
import { BaseDocumentLoader } from "./base.js";

export abstract class BaseDocumentLoaderWithEventEmitter extends BaseDocumentLoader {
  private emitter: EventEmitter;

  constructor() {
    super();

    this.emitter = new EventEmitter();
  }

  public on(event: string | symbol, listener: (...args: any[]) => void): this {
    this.emitter.on(event, listener);
    return this;
  }

  public emit(event: string | symbol, ...args: any[]): boolean {
    return this.emitter.emit(event, ...args);
  }

  public once(
    event: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    this.emitter.once(event, listener);
    return this;
  }

  public removeListener(
    event: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    this.emitter.removeListener(event, listener);
    return this;
  }

  public removeAllListeners(event?: string | symbol): this {
    this.emitter.removeAllListeners(event);
    return this;
  }

  public listeners(event: string | symbol): Function[] {
    return this.emitter.listeners(event);
  }

  public eventNames(): Array<string | symbol> {
    return this.emitter.eventNames();
  }

  public listenerCount(type: string | symbol): number {
    return this.emitter.listenerCount(type);
  }

  public prependListener(
    event: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    this.emitter.prependListener(event, listener);
    return this;
  }

  public prependOnceListener(
    event: string | symbol,
    listener: (...args: any[]) => void
  ): this {
    this.emitter.prependOnceListener(event, listener);
    return this;
  }
}
