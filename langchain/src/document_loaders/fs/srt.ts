import type SRTParserT from "srt-parser-2";
import { TextLoader } from "./text.js";

export class SRTLoader extends TextLoader {
  constructor(filePathOrBlob: string | Blob) {
    super(filePathOrBlob);
  }

  protected async parse(raw: string): Promise<string[]> {
    const { SRTParser2 } = await SRTLoaderImports();
    const parser = new SRTParser2();
    const srts = parser.fromSrt(raw);
    return [srts.map((srt) => srt.text).join(" ")];
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
