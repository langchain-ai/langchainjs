import { TranscriptResponse, YoutubeTranscript } from "youtube-transcript";
import { Innertube } from "youtubei.js";
import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";

/**
 * Configuration options for the YoutubeLoader class. Includes properties
 * such as the videoId, language, and addVideoInfo.
 */
interface YoutubeConfig {
  videoId: string;
  language?: string;
  addVideoInfo?: boolean;
}

/**
 * Metadata of a YouTube video. Includes properties such as the source
 * (videoId), description, title, view_count, author, and category.
 */
interface VideoMetadata {
  source: string;
  description?: string;
  title?: string;
  view_count?: number;
  author?: string;
  category?: string;
}

/**
 * A document loader for loading data from YouTube videos. It uses the
 * youtube-transcript and youtubei.js libraries to fetch the transcript
 * and video metadata.
 * @example
 * ```typescript
 * const loader = new YoutubeLoader(
 *   "https:
 *   "en",
 *   true,
 * );
 * const docs = await loader.load();
 * ```
 */
export class YoutubeLoader extends BaseDocumentLoader {
  private videoId: string;

  private language?: string;

  private addVideoInfo: boolean;

  constructor(config: YoutubeConfig) {
    super();
    this.videoId = config.videoId;
    this.language = config?.language;
    this.addVideoInfo = config?.addVideoInfo ?? false;
  }

  /**
   * Extracts the videoId from a YouTube video URL.
   * @param url The URL of the YouTube video.
   * @returns The videoId of the YouTube video.
   */
  private static getVideoID(url: string): string {
    const match = url.match(
      /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#&?]*).*/
    );
    if (match !== null && match[1].length === 11) {
      return match[1];
    } else {
      throw new Error("Failed to get youtube video id from the url");
    }
  }

  /**
   * Creates a new instance of the YoutubeLoader class from a YouTube video
   * URL.
   * @param url The URL of the YouTube video.
   * @param config Optional configuration options for the YoutubeLoader instance, excluding the videoId.
   * @returns A new instance of the YoutubeLoader class.
   */
  static createFromUrl(
    url: string,
    config?: Omit<YoutubeConfig, "videoId">
  ): YoutubeLoader {
    const videoId = YoutubeLoader.getVideoID(url);
    return new YoutubeLoader({ ...config, videoId });
  }

  /**
   * Loads the transcript and video metadata from the specified YouTube
   * video. It uses the youtube-transcript library to fetch the transcript
   * and the youtubei.js library to fetch the video metadata.
   * @returns An array of Documents representing the retrieved data.
   */
  async load(): Promise<Document[]> {
    let transcript: TranscriptResponse[] | undefined;
    const metadata: VideoMetadata = {
      source: this.videoId,
    };
    try {
      transcript = await YoutubeTranscript.fetchTranscript(this.videoId, {
        lang: this.language,
      });
      if (transcript === undefined) {
        throw new Error("Transcription not found");
      }
      if (this.addVideoInfo) {
        const youtube = await Innertube.create();
        const info = (await youtube.getBasicInfo(this.videoId)).basic_info;
        metadata.description = info.short_description;
        metadata.title = info.title;
        metadata.view_count = info.view_count;
        metadata.author = info.author;
      }
    } catch (e: unknown) {
      throw new Error(
        `Failed to get YouTube video transcription: ${(e as Error).message}`
      );
    }
    const document = new Document({
      pageContent: transcript.map((item) => item.text).join(" "),
      metadata,
    });

    return [document];
  }
}
