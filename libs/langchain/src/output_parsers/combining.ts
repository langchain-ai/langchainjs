import { Callbacks } from "@langchain/core/callbacks/manager";
import { BaseOutputParser } from "@langchain/core/output_parsers";

/**
 * Type for the combined output of the CombiningOutputParser class.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CombinedOutput = Record<string, any>;

/**
 * Interface for the fields required by the CombiningOutputParser class.
 */
export interface CombiningOutputParserFields {
  parsers: BaseOutputParser[];
}

/**
 * Class to combine multiple output parsers
 * @augments BaseOutputParser
 */
export class CombiningOutputParser extends BaseOutputParser<object> {
  static lc_name() {
    return "CombiningOutputParser";
  }

  lc_namespace = ["langchain", "output_parsers", "combining"];

  lc_serializable = true;

  parsers: BaseOutputParser[];

  outputDelimiter = "-----";

  constructor(fields: CombiningOutputParserFields);

  constructor(...parsers: BaseOutputParser[]);

  constructor(
    fields: BaseOutputParser | CombiningOutputParserFields,
    ...parsers: BaseOutputParser[]
  ) {
    if (parsers.length > 0 || !("parsers" in fields)) {
      // eslint-disable-next-line no-param-reassign
      fields = {
        parsers: [fields as BaseOutputParser, ...parsers],
      };
    }
    super(fields);
    this.parsers = fields.parsers;
  }

  /**
   * Method to parse an input string using the parsers in the parsers array.
   * The parsed outputs are combined into a single object and returned.
   * @param input The input string to parse.
   * @param callbacks Optional Callbacks object.
   * @returns A Promise that resolves to a CombinedOutput object.
   */
  async parse(input: string, callbacks?: Callbacks): Promise<CombinedOutput> {
    const inputs = input
      .trim()
      .split(
        new RegExp(`${this.outputDelimiter}Output \\d+${this.outputDelimiter}`)
      )
      .slice(1);
    const ret: CombinedOutput = {};
    for (const [i, p] of this.parsers.entries()) {
      let parsed;
      try {
        let extracted = inputs[i].includes("```")
          ? inputs[i].trim().split(/```/)[1]
          : inputs[i].trim();
        if (extracted.endsWith(this.outputDelimiter)) {
          extracted = extracted.slice(0, -this.outputDelimiter.length);
        }
        parsed = await p.parse(extracted, callbacks);
      } catch (e) {
        parsed = await p.parse(input.trim(), callbacks);
      }
      Object.assign(ret, parsed);
    }
    return ret;
  }

  /**
   * Method to get instructions on how to format the LLM output. The
   * instructions are based on the parsers array and the outputDelimiter.
   * @returns A string with format instructions.
   */
  getFormatInstructions(): string {
    return `${[
      `Return the following ${this.parsers.length} outputs, each formatted as described below. Include the delimiter characters "${this.outputDelimiter}" in your response:`,
      ...this.parsers.map(
        (p, i) =>
          `${this.outputDelimiter}Output ${i + 1}${this.outputDelimiter}\n${p
            .getFormatInstructions()
            .trim()}\n${this.outputDelimiter}`
      ),
    ].join("\n\n")}\n`;
  }
}
