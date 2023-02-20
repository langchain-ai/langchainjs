import { DocumentMetadata } from "docstore/document";
import type YouTubeTranscriptT from "youtube-transcript";
import type ytdlT from "ytdl-core";
import { Document } from "../docstore";
import { BaseDocumentLoader } from "./base";

let ytdl: typeof ytdlT | null = null;
let YouTubeTranscript: typeof YouTubeTranscriptT | null = null;

try {
  // eslint-disable-next-line global-require,import/no-extraneous-dependencies
  ytdl = require("ytdl-core");
  // eslint-disable-next-line global-require,import/no-extraneous-dependencies
  YouTubeTranscript = require("youtube-transcript");
} catch {
  // ignore error, will be throw in constructor
}

export class YouTubeLoader extends BaseDocumentLoader {
  private videoId: string;

  private addVideoInfo: boolean;

  constructor(videoId: string, addVideoInfo = false) {
    super();

    /**
     * Throw error at construction time
     * if ytdl-core is not installed.
     */
    if (ytdl === null) {
      throw new Error(
        "Please install ytdl-core as a dependency with, e.g. `yarn add ytdl-core`"
      );
    }

    /**
     * Throw error at construction time
     * if youtube-transcript is not installed.
     */
    if (YouTubeTranscript === null) {
      throw new Error(
        "Please install youtube-transcript as a dependency with, e.g. `yarn add youtube-transcript`"
      );
    }

    this.videoId = videoId;
    this.addVideoInfo = addVideoInfo;
  }

  public static fromYoutubeUrl(
    youtubeUrl: string,
    addVideoInfo = false
  ): YouTubeLoader {
    const videoId = youtubeUrl.split("youtube.com/watch?v=")[1];
    return new YouTubeLoader(videoId, addVideoInfo);
  }

  public async load(): Promise<Document[]> {
    if (YouTubeTranscript === null) {
      throw new Error(
        "Please install youtube-transcript as a dependency with, e.g. `yarn add youtube-transcript`"
      );
    }

    let metadata: DocumentMetadata = { source: this.videoId };

    if (this.addVideoInfo) {
      const videoInfo = await this.getVideoInfo();
      metadata = { ...metadata, ...videoInfo };
    }

    const transcriptPieces = await YouTubeTranscript.fetchTranscript(
      this.videoId
    );
    const transcript = transcriptPieces.map((t) => t.text).join(" ");

    return [new Document({ pageContent: transcript, metadata })];
  }

  private async getVideoInfo(): Promise<DocumentMetadata> {
    if (ytdl === null) {
      throw new Error(
        "Please install ytdl-core as a dependency with, e.g. `yarn add ytdl-core`"
      );
    }

    const videoInfo = await ytdl.getInfo(this.videoId);
    return {
      title: videoInfo.videoDetails.title,
      description: videoInfo.videoDetails.description,
      view_count: videoInfo.videoDetails.viewCount,
      thumbnail_url: videoInfo.videoDetails.thumbnail.thumbnails[0].url,
      publish_date: videoInfo.videoDetails.publishDate,
      length: videoInfo.videoDetails.lengthSeconds,

      /**
       * `author` is a deeply-nested, JSON-serilizable object.
       * TypeScript typing doesn't handle this well, so we use any.
       *
       * We could also loosen the typing of DocumentMetadata to
       * allow any value, but I'm not sure if that's a good idea.
       *
       * More info: https://github.com/microsoft/TypeScript/issues/1897
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      author: videoInfo.videoDetails.author as any,
    };
  }
}
