import { describe, it, expect } from "vitest";
import { context } from "../context.js";

describe("context", () => {
  it("should handle simple strings without interpolation", () => {
    const result = context`Hello, world!`;
    expect(result).toBe("Hello, world!");
  });

  it("should interpolate string values", () => {
    const name = "Alice";
    const result = context`Hello, ${name}!`;
    expect(result).toBe("Hello, Alice!");
  });

  it("should interpolate non-string values as JSON", () => {
    const age = 30;
    const result = context`Age: ${age}`;
    expect(result).toBe("Age: 30");
  });

  it("should normalize indentation in multi-line strings", () => {
    const role = "agent";
    const result = context`
      You are an ${role}.
      Your task is to help users.
    `;
    expect(result).toBe("You are an agent.\nYour task is to help users.");
  });

  it("should preserve relative indentation", () => {
    const result = context`
      First line
        Indented line
      Back to normal
    `;
    expect(result).toBe("First line\n  Indented line\nBack to normal");
  });

  it("should handle empty lines within content", () => {
    const result = context`
      Line 1

      Line 3
    `;
    expect(result).toBe("Line 1\n\nLine 3");
  });

  it("should remove leading and trailing blank lines", () => {
    const result = context`

      Content
    
    `;
    expect(result).toBe("Content");
  });

  it("should handle complex objects by stringifying them", () => {
    const data = { key: "value", count: 42 };
    const result = context`Data: ${data}`;
    expect(result).toBe('Data: {"key":"value","count":42}');
  });

  it("should work with realistic prompt examples", () => {
    const role = "agent";
    const task = "answer questions";
    const result = context`
      You are an ${role}.
      
      Your primary task is to ${task}.
      Please be helpful and accurate.
    `;
    expect(result).toBe(
      "You are an agent.\n\nYour primary task is to answer questions.\nPlease be helpful and accurate."
    );
  });

  it("should handle single line strings", () => {
    const name = "Bob";
    const result = context`Hello ${name}`;
    expect(result).toBe("Hello Bob");
  });

  it("should handle multiple interpolations on same line", () => {
    const first = "John";
    const last = "Doe";
    const result = context`Name: ${first} ${last}`;
    expect(result).toBe("Name: John Doe");
  });

  it("should handle arrays by stringifying them", () => {
    const items = ["apple", "banana", "cherry"];
    const result = context`Items: ${items}`;
    expect(result).toBe('Items: ["apple","banana","cherry"]');
  });

  it("should align multi-line interpolated values", () => {
    const items = "- Item 1\n- Item 2\n- Item 3";
    const result = context`
      Shopping list:
        ${items}
      End of list.
    `;
    expect(result).toBe(
      "Shopping list:\n  - Item 1\n  - Item 2\n  - Item 3\nEnd of list."
    );
  });

  it("should preserve multi-line string indentation at root level", () => {
    const code = "function foo() {\n  return 42;\n}";
    const result = context`
      Code:
      ${code}
    `;
    expect(result).toBe("Code:\nfunction foo() {\n  return 42;\n}");
  });

  it("should handle escaped newlines for line continuation", () => {
    const result = context`
      This is a very long line that \
      continues here.
    `;
    expect(result).toBe("This is a very long line that continues here.");
  });

  it("should handle escaped backticks", () => {
    const result = context`
      Use \`code\` for inline code.
    `;
    expect(result).toBe("Use `code` for inline code.");
  });

  it("should handle escaped dollar signs", () => {
    const result = context`
      The price is \$100.
    `;
    expect(result).toBe("The price is $100.");
  });

  it("should handle escaped braces", () => {
    const result = context`
      Use \${variable} syntax.
    `;
    expect(result).toBe("Use ${variable} syntax.");
  });
});
