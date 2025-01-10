import { BaseLLMOutputParser } from "@langchain/core/output_parsers";
import { Callbacks } from "@langchain/core/callbacks/manager";
import { ChatGeneration, Generation } from "@langchain/core/outputs";
import { MessageContent } from "@langchain/core/messages";
import {
  GeminiGroundingChunk,
  GeminiGroundingMetadata,
  GeminiGroundingSupport,
} from "./types.js";

type Generations = Generation[] | ChatGeneration[];

type GroundingInfo = {
  metadata: GeminiGroundingMetadata;
  supports: GeminiGroundingSupport[];
};

export abstract class BaseGoogleSearchOutputParser extends BaseLLMOutputParser<string> {
  lc_namespace: string[] = ["google_common", "output_parsers"];

  protected generationToGroundingInfo(
    generation: Generation | ChatGeneration
  ): GroundingInfo | undefined {
    if ("message" in generation) {
      const responseMetadata = generation?.message?.response_metadata;
      const metadata = responseMetadata?.groundingMetadata;
      const supports =
        responseMetadata?.groundingSupport ?? metadata?.groundingSupports ?? [];
      if (metadata) {
        return {
          metadata,
          supports,
        };
      }
    }
    return undefined;
  }

  protected generationsToGroundingInfo(
    generations: Generations
  ): GroundingInfo | undefined {
    for (const generation of generations) {
      const info = this.generationToGroundingInfo(generation);
      if (info !== undefined) {
        return info;
      }
    }
    return undefined;
  }

  protected generationToString(
    generation: Generation | ChatGeneration
  ): string {
    if ("message" in generation) {
      const content: MessageContent = generation?.message?.content;
      if (typeof content === "string") {
        return content;
      } else {
        return content
          .map((c) => {
            if (c?.type === "text") {
              return c?.text ?? "";
            } else {
              return "";
            }
          })
          .reduce(
            (previousValue, currentValue) => `${previousValue}${currentValue}`
          );
      }
    }
    return generation.text;
  }

  protected generationsToString(generations: Generations): string {
    return generations
      .map((generation) => this.generationToString(generation))
      .reduce(
        (previousValue, currentValue) => `${previousValue}${currentValue}`
      );
  }

  protected abstract segmentPrefix(
    grounding: GroundingInfo,
    support: GeminiGroundingSupport,
    index: number
  ): string | undefined;

  protected abstract segmentSuffix(
    grounding: GroundingInfo,
    support: GeminiGroundingSupport,
    index: number
  ): string | undefined;

  protected annotateSegment(
    text: string,
    grounding: GroundingInfo,
    support: GeminiGroundingSupport,
    index: number
  ): string {
    const start = support.segment.startIndex ?? 0;
    const end = support.segment.endIndex;

    const textBefore = text.substring(0, start);
    const textSegment = text.substring(start, end);
    const textAfter = text.substring(end);

    const textPrefix = this.segmentPrefix(grounding, support, index) ?? "";
    const textSuffix = this.segmentSuffix(grounding, support, index) ?? "";

    return `${textBefore}${textPrefix}${textSegment}${textSuffix}${textAfter}`;
  }

  protected annotateTextSegments(
    text: string,
    grounding: GroundingInfo
  ): string {
    // Go through each support info in reverse, since the segment info
    // is sorted, and we won't need to adjust string indexes this way.
    let ret = text;
    for (let co = grounding.supports.length - 1; co >= 0; co -= 1) {
      const support = grounding.supports[co];
      ret = this.annotateSegment(ret, grounding, support, co);
    }
    return ret;
  }

  protected abstract textPrefix(
    text: string,
    grounding: GroundingInfo
  ): string | undefined;

  protected abstract textSuffix(
    text: string,
    grounding: GroundingInfo
  ): string | undefined;

  /**
   * Google requires us to
   * "Display the Search Suggestion exactly as provided without any modifications"
   * So this will typically be called from the textSuffix() method to get
   * a string that renders HTML.
   * See https://ai.google.dev/gemini-api/docs/grounding/search-suggestions
   * @param grounding
   */
  protected searchSuggestion(grounding: GroundingInfo): string {
    return grounding?.metadata?.searchEntryPoint?.renderedContent ?? "";
  }

  protected annotateText(text: string, grounding: GroundingInfo): string {
    const prefix = this.textPrefix(text, grounding) ?? "";
    const suffix = this.textSuffix(text, grounding) ?? "";
    const body = this.annotateTextSegments(text, grounding);
    return `${prefix}${body}${suffix}`;
  }

  async parseResult(
    generations: Generations,
    _callbacks?: Callbacks
  ): Promise<string> {
    const text = this.generationsToString(generations);

    const grounding = this.generationsToGroundingInfo(generations);
    if (!grounding) {
      return text;
    }

    return this.annotateText(text, grounding);
  }
}

export class SimpleGoogleSearchOutputParser extends BaseGoogleSearchOutputParser {
  protected segmentPrefix(
    _grounding: GroundingInfo,
    _support: GeminiGroundingSupport,
    _index: number
  ): string | undefined {
    return undefined;
  }

  protected segmentSuffix(
    _grounding: GroundingInfo,
    support: GeminiGroundingSupport,
    _index: number
  ): string | undefined {
    const indices: number[] = support.groundingChunkIndices.map((i) => i + 1);
    return ` [${indices.join(", ")}]`;
  }

  protected textPrefix(_text: string, _grounding: GroundingInfo): string {
    return "Google Says:\n";
  }

  protected chunkToString(chunk: GeminiGroundingChunk, index: number): string {
    const info = chunk.retrievedContext ?? chunk.web;
    return `${index + 1}. ${info.title} - ${info.uri}`;
  }

  protected textSuffix(_text: string, grounding: GroundingInfo): string {
    let ret = "\n";
    const chunks: GeminiGroundingChunk[] =
      grounding?.metadata?.groundingChunks ?? [];
    chunks.forEach((chunk, index) => {
      ret = `${ret}${this.chunkToString(chunk, index)}\n`;
    });
    return ret;
  }
}

export class MarkdownGoogleSearchOutputParser extends BaseGoogleSearchOutputParser {
  protected segmentPrefix(
    _grounding: GroundingInfo,
    _support: GeminiGroundingSupport,
    _index: number
  ): string | undefined {
    return undefined;
  }

  protected chunkLink(grounding: GroundingInfo, index: number): string {
    const chunk = grounding.metadata.groundingChunks[index];
    const url = chunk.retrievedContext?.uri ?? chunk.web?.uri;
    const num = index + 1;
    return `[[${num}](${url})]`;
  }

  protected segmentSuffix(
    grounding: GroundingInfo,
    support: GeminiGroundingSupport,
    _index: number
  ): string | undefined {
    let ret = "";
    support.groundingChunkIndices.forEach((chunkIndex) => {
      const link = this.chunkLink(grounding, chunkIndex);
      ret = `${ret}${link}`;
    });
    return ret;
  }

  protected textPrefix(
    _text: string,
    _grounding: GroundingInfo
  ): string | undefined {
    return undefined;
  }

  protected chunkSuffixLink(
    chunk: GeminiGroundingChunk,
    index: number
  ): string {
    const num = index + 1;
    const info = chunk.retrievedContext ?? chunk.web;
    const url = info.uri;
    const site = info.title;
    return `${num}. [${site}](${url})`;
  }

  protected textSuffix(
    _text: string,
    grounding: GroundingInfo
  ): string | undefined {
    let ret = "\n**Search Sources**\n";
    const chunks: GeminiGroundingChunk[] = grounding.metadata.groundingChunks;
    chunks.forEach((chunk, index) => {
      ret = `${ret}${this.chunkSuffixLink(chunk, index)}\n`;
    });

    const search = this.searchSuggestion(grounding);
    ret = `${ret}\n${search}`;

    return ret;
  }
}
