import { DirectoryLoader, UnknownHandling } from "./directory.js";
import { TextLoader } from "./text.js";

export class NotionLoader extends DirectoryLoader {
  constructor(directoryPath: string) {
    super(
      directoryPath,
      {
        ".md": (filePath) => new TextLoader(filePath),
      },
      true,
      UnknownHandling.Ignore
    );
  }
}
