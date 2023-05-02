import { BaseOutputParser } from "../../schema/output_parser.js";
import { AutoGPTAction } from "./schema.js";

export function preprocessJsonInput(inputStr: string): string {
  // Replace single backslashes with double backslashes,
  // while leaving already escaped ones intact
  const correctedStr = inputStr.replace(
    /(?<!\\)\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g,
    "\\\\"
  );
  return correctedStr;
}

export class AutoGPTOutputParser extends BaseOutputParser<AutoGPTAction> {
  getFormatInstructions(): string {
    throw new Error("Method not implemented.");
  }

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
