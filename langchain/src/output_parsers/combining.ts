import { BaseOutputParser } from "../schema/index.js";

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

  async parse(input: string): Promise<Record<string, any>> {
    let ret = {};
    for (const p of this.parsers) {
      ret = { ...ret, ...((await p.parse(input)) as Record<string, any>) };
    }
    return ret;
  }

  getFormatInstructions(): string {
    const initial = "For your first output: " + this?.parsers?.[0]?.getFormatInstructions();
    const subsequent = this.parsers.slice(1).map((p) => "Complete that output fully. Then produce another output: " + p.getFormatInstructions()).join("\n");
    return initial + "\n" + subsequent;
  }
}

