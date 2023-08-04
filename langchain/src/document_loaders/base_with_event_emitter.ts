import { EventEmitter } from "events";
import { BaseDocumentLoader } from "./base.js";

export abstract class BaseDocumentLoaderWithEventEmitter extends BaseDocumentLoader {
  private emitter: EventEmitter;

  constructor() {
    super();

    this.emitter = new EventEmitter();
  }

  public addListener(
    eventName: string | symbol,
    listener: (...args: any[]) => void // eslint-disable-line @typescript-eslint/no-explicit-any
  ): this {
    this.emitter.addListener(eventName, listener);
    return this;
  }

  public on(
    eventName: string | symbol,
    listener: (...args: any[]) => void // eslint-disable-line @typescript-eslint/no-explicit-any
  ): this {
    this.emitter.on(eventName, listener);
    return this;
  }

  public once(
    eventName: string | symbol,
    listener: (...args: any[]) => void // eslint-disable-line @typescript-eslint/no-explicit-any
  ): this {
    this.emitter.once(eventName, listener);
    return this;
  }

  public removeListener(
    eventName: string | symbol,
    listener: (...args: any[]) => void // eslint-disable-line @typescript-eslint/no-explicit-any
  ): this {
    this.emitter.removeListener(eventName, listener);
    return this;
  }

  public off(
    eventName: string | symbol,
    listener: (...args: any[]) => void // eslint-disable-line @typescript-eslint/no-explicit-any
  ): this {
    this.emitter.off(eventName, listener);
    return this;
  }

  public removeAllListeners(event?: string | symbol): this {
    this.emitter.removeAllListeners(event);
    return this;
  }

  public setMaxListeners(n: number): this {
    this.emitter.setMaxListeners(n);
    return this;
  }

  public getMaxListeners(): number {
    return this.emitter.getMaxListeners();
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  public listeners(event: string | symbol): Function[] {
    return this.emitter.listeners(event);
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  public rawListeners(event: string | symbol): Function[] {
    return this.emitter.rawListeners(event);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public emit(eventName: string | symbol, ...args: any[]): boolean {
    return this.emitter.emit(eventName, ...args);
  }

  public listenerCount(type: string | symbol): number {
    return this.emitter.listenerCount(type);
  }

  public prependListener(
    eventName: string | symbol,
    listener: (...args: any[]) => void // eslint-disable-line @typescript-eslint/no-explicit-any
  ): this {
    this.emitter.prependListener(eventName, listener);
    return this;
  }

  public prependOnceListener(
    eventName: string | symbol,
    listener: (...args: any[]) => void // eslint-disable-line @typescript-eslint/no-explicit-any
  ): this {
    this.emitter.prependOnceListener(eventName, listener);
    return this;
  }

  public eventNames(): Array<string | symbol> {
    return this.emitter.eventNames();
  }
}
