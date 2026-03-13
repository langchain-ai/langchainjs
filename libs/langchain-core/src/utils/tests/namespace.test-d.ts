/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expectTypeOf } from "vitest";
import { createNamespace } from "../namespace.js";

const root = createNamespace("typetest");
const errorNs = root.sub("error");
const subNs = errorNs.sub("sub");

class BaseError extends errorNs.brand(Error) {
  name: string = "BaseError";
}

class SubError extends subNs.brand(BaseError) {
  name: string = "SubError";
}

class ConfigError extends subNs.brand(SubError, "configuration") {
  name: string = "ConfigError";
}

describe("isInstance type narrowing", () => {
  it("should narrow to the class it's called on", () => {
    const obj: unknown = {};

    if (BaseError.isInstance(obj)) {
      expectTypeOf(obj).toEqualTypeOf<BaseError>();
    }

    if (SubError.isInstance(obj)) {
      expectTypeOf(obj).toEqualTypeOf<SubError>();
    }

    if (ConfigError.isInstance(obj)) {
      expectTypeOf(obj).toEqualTypeOf<ConfigError>();
    }
  });

  it("should narrow unknown to the branded type", () => {
    const err: unknown = {};
    if (ConfigError.isInstance(err)) {
      expectTypeOf(err).toEqualTypeOf<ConfigError>();
      // Should be able to access Error properties
      expectTypeOf(err.message).toEqualTypeOf<string>();
    }
  });
});

describe("constructor signatures", () => {
  it("should produce instances of the branded class", () => {
    const err = new BaseError("test");
    expectTypeOf(err).toExtend<Error>();
    expectTypeOf(err).toExtend<BaseError>();
  });

  it("child instances should match their own type", () => {
    const config = new ConfigError("test");
    expectTypeOf(config).toExtend<Error>();
    expectTypeOf(config).toExtend<ConfigError>();
  });

  it("should be constructable with Error args", () => {
    // BaseError extends Error, so it should accept at least a message
    const err = new BaseError("hello");
    expectTypeOf(err.message).toEqualTypeOf<string>();
  });
});

describe("custom constructor args", () => {
  class CustomError extends errorNs.brand(BaseError, "custom") {
    readonly code: number;

    constructor(message: string, code: number) {
      super(message);
      this.code = code;
    }
  }

  it("should accept the subclass constructor args", () => {
    expectTypeOf(CustomError).constructorParameters.toEqualTypeOf<
      [message: string, code: number]
    >();
  });

  it("should have the extra properties", () => {
    const err = new CustomError("fail", 42);
    expectTypeOf(err.code).toEqualTypeOf<number>();
    expectTypeOf(err.message).toEqualTypeOf<string>();
  });

  it("isInstance should narrow to CustomError", () => {
    const obj: unknown = {};
    if (CustomError.isInstance(obj)) {
      expectTypeOf(obj).toEqualTypeOf<CustomError>();
    }
  });
});

describe("non-Error base class types", () => {
  const msgNs = createNamespace("typetest.message");

  class Serializable {
    toJSON(): Record<string, unknown> {
      return { type: this.constructor.name };
    }
  }

  class BaseMessage extends msgNs.brand(Serializable) {
    content: string;

    constructor(content: string) {
      super();
      this.content = content;
    }
  }

  class AIMessage extends msgNs.brand(BaseMessage, "ai") {
    constructor(content: string) {
      super(content);
    }
  }

  it("should preserve base class methods in the type", () => {
    const msg = new AIMessage("hello");
    expectTypeOf(msg.toJSON).toEqualTypeOf<() => Record<string, unknown>>();
    expectTypeOf(msg.content).toEqualTypeOf<string>();
  });

  it("should match parent types", () => {
    const msg = new AIMessage("hello");
    expectTypeOf(msg).toExtend<Serializable>();
    expectTypeOf(msg).toExtend<BaseMessage>();
  });

  it("isInstance should narrow to the correct type", () => {
    const obj: unknown = {};
    if (AIMessage.isInstance(obj)) {
      expectTypeOf(obj).toEqualTypeOf<AIMessage>();
    }
    if (BaseMessage.isInstance(obj)) {
      expectTypeOf(obj).toEqualTypeOf<BaseMessage>();
    }
  });
});

describe("Namespace API", () => {
  it("sub should return a Namespace", () => {
    const ns = createNamespace("api.test");
    const child = ns.sub("child");
    expectTypeOf(child).toHaveProperty("brand");
    expectTypeOf(child).toHaveProperty("sub");
    expectTypeOf(child).toHaveProperty("isInstance");
  });

  it("isInstance on namespace should return boolean", () => {
    const ns = createNamespace("api.test2");
    expectTypeOf(ns.isInstance).toEqualTypeOf<(obj: unknown) => boolean>();
  });
});
