import type SRTParserT from "srt-parser-2";
import { TextLoader } from "./text.js";

/**
 * A class that extends the `TextLoader` class. It represents a document
 * loader that loads documents from SRT (SubRip) subtitle files. It has a
 * constructor that takes a `filePathOrBlob` parameter representing the
 * path to the SRT file or a `Blob` object. The `parse()` method is
 * implemented to parse the SRT file and extract the text content of each
 * subtitle.
 * @example
 * ```typescript
 * const loader = new SRTLoader("path/to/file.srt");
 * const docs = await loader.load();
 * console.log({ docs });
 * ```
 */
export class SRTLoader extends TextLoader {
  constructor(filePathOrBlob: string | Blob) {
    super(filePathOrBlob);
  }

  /**
   * A protected method that takes a `raw` string as a parameter and returns
   * a promise that resolves to an array of strings. It parses the raw SRT
   * string using the `SRTParser2` class from the `srt-parser-2` module. It
   * retrieves the subtitle objects from the parsed SRT data and extracts
   * the text content from each subtitle object. It filters out any empty
   * text content and joins the non-empty text content with a space
   * separator.
   * @param raw The raw SRT string to be parsed.
   * @returns A promise that resolves to an array of strings representing the text content of each subtitle.
   */
  protected async parse(raw: string): Promise<string[]> {
    const { SRTParser2 } = await SRTLoaderImports();
    const parser = new SRTParser2();
    const srts = parser.fromSrt(raw);
    return [
      srts
        .map((srt) => srt.text)
        .filter(Boolean)
        .join(" "),
    ];
  }
}

async function SRTLoaderImports(): Promise<{
  SRTParser2: typeof SRTParserT.default;
}> {
  try {
    const SRTParser2 = (await import("srt-parser-2")).default.default;
    return { SRTParser2 };
  } catch (e) {
    throw new Error(
      "Please install srt-parser-2 as a dependency with, e.g. `yarn add srt-parser-2`"
    );
  }
}
