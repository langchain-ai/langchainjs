/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { createNamespace } from "../namespace.js";

const root = createNamespace("test");
const errorNs = root.sub("error");
const subNs = errorNs.sub("sub");

class BaseError extends errorNs.brand(Error) {
  name = "BaseError";
}

class SubError extends subNs.brand(BaseError) {
  name = "SubError";
}

class ConfigError extends subNs.brand(SubError, "configuration") {
  name = "ConfigError";
}

class AuthError extends subNs.brand(SubError, "auth") {
  name = "AuthError";
}

// A separate branch under the same root
const otherNs = root.sub("other");

class OtherError extends otherNs.brand(Error) {
  readonly name = "OtherError";
}

describe("branded classes preserve instanceof", () => {
  it("should be instanceof Error", () => {
    const base = new BaseError("base");
    const sub = new SubError("sub");
    const config = new ConfigError("config");

    expect(base).toBeInstanceOf(Error);
    expect(sub).toBeInstanceOf(Error);
    expect(config).toBeInstanceOf(Error);
  });

  it("should be instanceof the direct class", () => {
    const base = new BaseError("base");
    const sub = new SubError("sub");
    const config = new ConfigError("config");

    expect(base).toBeInstanceOf(BaseError);
    expect(sub).toBeInstanceOf(SubError);
    expect(config).toBeInstanceOf(ConfigError);
  });

  it("should be instanceof parent branded classes", () => {
    const config = new ConfigError("config");

    expect(config).toBeInstanceOf(SubError);
    expect(config).toBeInstanceOf(BaseError);
    expect(config).toBeInstanceOf(Error);
  });

  it("should NOT be instanceof unrelated branded classes", () => {
    const config = new ConfigError("config");
    const other = new OtherError("other");

    expect(config).not.toBeInstanceOf(OtherError);
    expect(other).not.toBeInstanceOf(SubError);
    expect(other).not.toBeInstanceOf(BaseError);
  });
});

describe("isInstance checks", () => {
  describe("leaf class isInstance", () => {
    it("should recognize its own instances", () => {
      const config = new ConfigError("config");
      expect(ConfigError.isInstance(config)).toBe(true);
    });

    it("should NOT recognize sibling instances", () => {
      const auth = new AuthError("auth");
      expect(ConfigError.isInstance(auth)).toBe(false);
    });

    it("should NOT recognize parent instances", () => {
      const sub = new SubError("sub");
      expect(ConfigError.isInstance(sub)).toBe(false);
    });
  });

  describe("mid-level class isInstance", () => {
    it("should recognize its own instances", () => {
      const sub = new SubError("sub");
      expect(SubError.isInstance(sub)).toBe(true);
    });

    it("should recognize child instances (via prototype chain)", () => {
      const config = new ConfigError("config");
      const auth = new AuthError("auth");
      expect(SubError.isInstance(config)).toBe(true);
      expect(SubError.isInstance(auth)).toBe(true);
    });

    it("should NOT recognize parent instances", () => {
      const base = new BaseError("base");
      expect(SubError.isInstance(base)).toBe(false);
    });

    it("should NOT recognize unrelated instances", () => {
      const other = new OtherError("other");
      expect(SubError.isInstance(other)).toBe(false);
    });
  });

  describe("root branded class isInstance", () => {
    it("should recognize its own instances", () => {
      const base = new BaseError("base");
      expect(BaseError.isInstance(base)).toBe(true);
    });

    it("should recognize all descendants", () => {
      const sub = new SubError("sub");
      const config = new ConfigError("config");
      const auth = new AuthError("auth");

      expect(BaseError.isInstance(sub)).toBe(true);
      expect(BaseError.isInstance(config)).toBe(true);
      expect(BaseError.isInstance(auth)).toBe(true);
    });

    it("should NOT recognize unrelated branded errors", () => {
      const other = new OtherError("other");
      expect(BaseError.isInstance(other)).toBe(false);
    });
  });

  describe("namespace-level isInstance", () => {
    it("should recognize any instance branded under the namespace", () => {
      const base = new BaseError("base");
      const sub = new SubError("sub");
      const config = new ConfigError("config");

      expect(errorNs.isInstance(base)).toBe(true);
      expect(errorNs.isInstance(sub)).toBe(true);
      expect(errorNs.isInstance(config)).toBe(true);
    });

    it("should NOT recognize instances from other namespaces", () => {
      const other = new OtherError("other");
      expect(errorNs.isInstance(other)).toBe(false);
    });

    it("child namespace should recognize its own instances", () => {
      const sub = new SubError("sub");
      const config = new ConfigError("config");
      expect(subNs.isInstance(sub)).toBe(true);
      expect(subNs.isInstance(config)).toBe(true);
    });

    it("child namespace should NOT recognize parent-only instances", () => {
      const base = new BaseError("base");
      expect(subNs.isInstance(base)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should return false for null", () => {
      expect(BaseError.isInstance(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(BaseError.isInstance(undefined)).toBe(false);
    });

    it("should return false for primitives", () => {
      expect(BaseError.isInstance(42)).toBe(false);
      expect(BaseError.isInstance("string")).toBe(false);
      expect(BaseError.isInstance(true)).toBe(false);
    });

    it("should return false for plain objects", () => {
      expect(BaseError.isInstance({})).toBe(false);
      expect(BaseError.isInstance({ message: "foo" })).toBe(false);
    });

    it("should return false for plain Error instances", () => {
      expect(BaseError.isInstance(new Error("plain"))).toBe(false);
    });
  });
});

describe("error properties are preserved", () => {
  it("should have correct name", () => {
    expect(new BaseError("test").name).toBe("BaseError");
    expect(new SubError("test").name).toBe("SubError");
    expect(new ConfigError("test").name).toBe("ConfigError");
  });

  it("should have correct message", () => {
    expect(new BaseError("hello").message).toBe("hello");
    expect(new ConfigError("world").message).toBe("world");
  });

  it("should have a stack trace", () => {
    const err = new ConfigError("trace");
    expect(err.stack).toBeDefined();
    expect(typeof err.stack).toBe("string");
  });
});

describe("symbol isolation between namespaces", () => {
  it("different root namespaces are independent", () => {
    const ns1 = createNamespace("isolated.a");
    const ns2 = createNamespace("isolated.b");

    class A extends ns1.brand(Error) {}
    class B extends ns2.brand(Error) {}

    const a = new A("a");
    const b = new B("b");

    expect(A.isInstance(a)).toBe(true);
    expect(B.isInstance(b)).toBe(true);

    expect(A.isInstance(b)).toBe(false);
    expect(B.isInstance(a)).toBe(false);
  });

  it("same marker name under different namespaces are independent", () => {
    const ns1 = createNamespace("collision.a");
    const ns2 = createNamespace("collision.b");

    class A extends ns1.brand(Error, "config") {}
    class B extends ns2.brand(Error, "config") {}

    const a = new A("a");
    const b = new B("b");

    expect(A.isInstance(a)).toBe(true);
    expect(B.isInstance(b)).toBe(true);

    expect(A.isInstance(b)).toBe(false);
    expect(B.isInstance(a)).toBe(false);
  });
});

describe("branding non-Error base classes", () => {
  const msgNs = createNamespace("test.message");

  class Serializable {
    toJSON() {
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

  it("should preserve base class methods", () => {
    const msg = new AIMessage("hello");
    expect(typeof msg.toJSON).toBe("function");
    expect(msg.toJSON()).toEqual({ type: "AIMessage" });
  });

  it("should preserve constructor args", () => {
    const msg = new AIMessage("hello");
    expect(msg.content).toBe("hello");
  });

  it("should support isInstance checks", () => {
    const msg = new AIMessage("hello");
    expect(BaseMessage.isInstance(msg)).toBe(true);
    expect(AIMessage.isInstance(msg)).toBe(true);
  });

  it("should support instanceof", () => {
    const msg = new AIMessage("hello");
    expect(msg).toBeInstanceOf(Serializable);
    expect(msg).toBeInstanceOf(BaseMessage);
    expect(msg).toBeInstanceOf(AIMessage);
  });

  it("isInstance should NOT match unrelated branded classes", () => {
    const msg = new AIMessage("hello");
    expect(BaseError.isInstance(msg)).toBe(false);
  });
});
