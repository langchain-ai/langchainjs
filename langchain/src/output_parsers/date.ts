import {
  BaseOutputParser,
  OutputParserException,
} from "../schema/output_parser.js";

/**
 * Class to parse the output of an LLM call to a date.
 * @augments BaseOutputParser
 */
export class DateOutputParser extends BaseOutputParser<Date> {
  static lc_name() {
    return "DateOutputParser";
  }

  lc_namespace = ["langchain_core", "output_parsers", "date"];

  lc_serializable = true;

  /**
   * ISO 8601 date time standard.
   */
  format = "YYYY-MM-DDTHH:mm:ssZ";

  /**
   * Parses the given text into a Date.
   * If the parsing fails, throws an OutputParserException.
   * @param text The text to parse.
   * @returns A date object.
   */
  async parse(text: string): Promise<Date> {
    const parsedDate = new Date(text.trim());
    if (isNaN(parsedDate.getTime())) {
      throw new OutputParserException(`Could not parse output: ${text}`, text);
    }
    return parsedDate;
  }

  /**
   * Provides instructions on the expected format of the response for the
   * CommaSeparatedListOutputParser.
   * @returns A string containing instructions on the expected format of the response.
   */
  getFormatInstructions(): string {
    return `Your response should be a datetime string that matches the following pattern: ${this.format}, with no other text. For example: 2011-10-05T14:48:00Z, 2019-01-01T00:00:00Z, 1932-04-21T04:42:23Z`;
  }
}
