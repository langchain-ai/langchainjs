import { Callbacks } from "../callbacks/manager.js";
import { BaseOutputParser } from "../schema/output_parser.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CombinedOutput = Record<string, any>;

/**
 * Class to combine multiple output parsers
 * @augments BaseOutputParser
 */
export class CombiningOutputParser extends BaseOutputParser {
  parsers: BaseOutputParser[];

  constructor(...parsers: BaseOutputParser[]) {
    super();
    this.parsers = parsers;
  }

  async parse(input: string, callbacks?: Callbacks): Promise<CombinedOutput> {
    const ret: CombinedOutput = {};
    for (const p of this.parsers) {
      Object.assign(ret, await p.parse(input, callbacks));
    }
    return ret;
  }

  getFormatInstructions(): string {
    const initial = `For your first output: ${this?.parsers?.[0]?.getFormatInstructions()}`;
    const subsequent = this.parsers
      .slice(1)
      .map(
        (p) =>
          `Complete that output fully. Then produce another output: ${p.getFormatInstructions()}`
      )
      .join("\n");
    return `${initial}\n${subsequent}`;
  }
}
