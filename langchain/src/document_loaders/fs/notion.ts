import { DirectoryLoader, UnknownHandling } from "./directory.js";
import { TextLoader } from "./text.js";

/**
 * A class that extends the DirectoryLoader class. It represents a
 * document loader that loads documents from a directory in the Notion
 * format. It uses the TextLoader for loading '.md' files and ignores
 * unknown file types.
 */
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
