import { ClientOptions, OpenAI as OpenAIClient } from "openai";
import fs from "fs";

export type OpenAIFilesCreate = {
  file: fs.ReadStream;
  purpose: "assistants" | "fine-tune";
};
export type OpenAIFilesInput = {
  client?: OpenAIClient;
  clientOptions?: ClientOptions;
};

export class OpenAIFiles {
  static async create({ file, purpose }: OpenAIFilesCreate) {
    const oaiClient = new OpenAIClient();
    return oaiClient.files.create({
      file,
      purpose,
    });
  }

  static async del({ fileId }: { fileId: string }) {
    const oaiClient = new OpenAIClient();
    return oaiClient.files.del(fileId);
  }
}
