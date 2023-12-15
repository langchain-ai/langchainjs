import { BaseOutputParser } from "../../schema/output_parser.js";
import { AutoGPTAction } from "./schema.js";

/**
 * Utility function used to preprocess a string to be parsed as JSON.
 * It replaces single backslashes with double backslashes, while leaving
 * already escaped ones intact.
 * It also extracts the json code if it is inside a code block
 */
export function preprocessJsonInput(inputStr: string): string {
  const correctedStr = inputStr.replace(
    /(?<!\\)\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g,
    "\\\\"
  );
  const match = correctedStr.match(
    /```(.*)(\r\n|\r|\n)(?<code>[\w\W\n]+)(\r\n|\r|\n)```/
  );
  if (match?.groups?.code) {
    return match.groups.code.trim();
  } else {
    return correctedStr;
  }
}

/**
 * Class responsible for parsing the output of AutoGPT. It extends the
 * BaseOutputParser class.
 */
export class AutoGPTOutputParser extends BaseOutputParser<AutoGPTAction> {
  lc_namespace = ["langchain", "experimental", "autogpt"];

  /**
   * Method not implemented in the class and will throw an error if called.
   * It is likely meant to be overridden in subclasses to provide specific
   * format instructions.
   * @returns Throws an error.
   */
  getFormatInstructions(): string {
    throw new Error("Method not implemented.");
  }

  /**
   * Asynchronous method that takes a string as input and attempts to parse
   * it into an AutoGPTAction object. If the input string cannot be parsed
   * directly, the method tries to preprocess the string using the
   * preprocessJsonInput function and parse it again. If parsing fails
   * again, it returns an AutoGPTAction object with an error message.
   * @param text The string to be parsed.
   * @returns A Promise that resolves to an AutoGPTAction object.
   */
  async parse(text: string): Promise<AutoGPTAction> {
    let parsed: {
      command: {
        name: string;
        args: Record<string, unknown>;
      };
    };
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      const preprocessedText = preprocessJsonInput(text);
      try {
        parsed = JSON.parse(preprocessedText);
      } catch (error) {
        return {
          name: "ERROR",
          args: { error: `Could not parse invalid json: ${text}` },
        };
      }
    }
    try {
      return {
        name: parsed.command.name,
        args: parsed.command.args,
      };
    } catch (error) {
      return {
        name: "ERROR",
        args: { error: `Incomplete command args: ${parsed}` },
      };
    }
  }
}
