import srtParser2 from "srt-parser-2";
import { TextLoader } from "./text.js";
import { logVersion020MigrationWarning } from "../../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion020MigrationWarning({
  oldEntrypointName: "document_loaders/fs/srt",
  newPackageName: "@langchain/community",
});

/**
 * @deprecated - Import from "@langchain/community/document_loaders/fs/srt" instead. This entrypoint will be removed in 0.3.0.
 *
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
    // eslint-disable-next-line new-cap
    const parser = new srtParser2();
    const srts = parser.fromSrt(raw);
    return [
      srts
        .map((srt) => srt.text)
        .filter(Boolean)
        .join(" "),
    ];
  }
}
