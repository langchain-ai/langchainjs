import {BaseLLMOutputParser} from "@langchain/core/output_parsers";
import {Callbacks} from "@langchain/core/callbacks/manager";
import {ChatGeneration, Generation} from "@langchain/core/outputs";
import {MessageContent} from "@langchain/core/messages";
import {GeminiGroundingChunk, GeminiGroundingMetadata, GeminiGroundingSupport} from "./types.js";

type Generations = Generation[] | ChatGeneration[];

type GroundingInfo = {
  metadata: GeminiGroundingMetadata;
  supports: GeminiGroundingSupport[];
}

export abstract class BaseGoogleSearchOutputParser extends BaseLLMOutputParser<string> {

  generationToGroundingInfo(generation: Generation | ChatGeneration): GroundingInfo | undefined {
    if ("message" in generation) {
      const responseMetadata = generation?.message?.response_metadata;
      const metadata = responseMetadata.groundingMetadata;
      const supports = responseMetadata.groundingSupport ?? metadata.groundingSupports ?? [];
      if (metadata) {
        return {
          metadata,
          supports,
        }
      }
    }
    return undefined;
  }

  generationsToGroundingInfo(generations: Generations): GroundingInfo | undefined {
    for (const generation of generations) {
      const info = this.generationToGroundingInfo(generation);
      if (info !== undefined) {
        return info;
      }
    }
    return undefined;
  }

  generationToString(generation: Generation | ChatGeneration): string {
    if ("message" in generation) {
      const content: MessageContent = generation?.message?.content;
      if (typeof content === "string") {
        return content;
      } else {
        return content.map(c => {
          if (c?.type === "text") {
            return c?.text ?? "";
          } else {
            return "";
          }
        }).reduce((previousValue, currentValue) => `${previousValue}${currentValue}`);
      }
    }
    return generation.text;
  }

  generationsToString(generations: Generations): string {
    return generations
      .map((generation) => this.generationToString(generation))
      .reduce((previousValue, currentValue) => `${previousValue}${currentValue}`);
  }

  abstract segmentPrefix(grounding: GroundingInfo, support: GeminiGroundingSupport, index: number): string | undefined;

  abstract segmentSuffix(grounding: GroundingInfo, support: GeminiGroundingSupport, index: number): string | undefined;

  annotateSegment(text: string, grounding: GroundingInfo, support: GeminiGroundingSupport, index: number): string {
    const start = support.segment.startIndex ?? 0;
    const end = support.segment.endIndex;

    const textBefore = text.substring(0, start);
    const textSegment = text.substring(start, end);
    const textAfter = text.substring(end);

    const textPrefix = this.segmentPrefix(grounding, support, index) ?? "";
    const textSuffix = this.segmentSuffix(grounding, support, index) ?? "";

    return `${textBefore}${textPrefix}${textSegment}${textSuffix}${textAfter}`;
  }

  annotateTextSegments(text: string, grounding: GroundingInfo): string {
    // Go through each support info in reverse, since the segment info
    // is sorted, and we won't need to adjust string indexes this way.
    let ret = text;
    for (let co = grounding.supports.length - 1; co>=0; co-=1) {
      const support = grounding.supports[co];
      ret = this.annotateSegment(ret, grounding, support, co);
    }
    return ret;
  }

  abstract textPrefix(text: string, grounding: GroundingInfo): string | undefined;

  abstract textSuffix(text: string, grounding: GroundingInfo): string | undefined;

  annotateText(text: string, grounding: GroundingInfo): string {
    const prefix = this.textPrefix(text, grounding) ?? "";
    const suffix = this.textSuffix(text, grounding) ?? "";
    const body = this.annotateTextSegments(text, grounding);
    return `${prefix}${body}${suffix}`;
  }

  parseResult(
    generations: Generations,
    _callbacks?: Callbacks
  ): Promise<string> {

    const text = this.generationsToString(generations);

    const grounding = this.generationsToGroundingInfo(generations);
    if (!grounding) {
      return Promise.resolve(text);
    }

    return Promise.resolve(this.annotateText(text, grounding));
  }

}

export class SimpleGoogleSearchOutputParser extends BaseGoogleSearchOutputParser {

  // FIXME: What should this be?
  lc_namespace: string[] = ["google_common", "output_parsers"];

  segmentPrefix(_grounding: GroundingInfo, _support: GeminiGroundingSupport, _index: number): string | undefined {
    return undefined;
  }

  segmentSuffix(_grounding: GroundingInfo, support: GeminiGroundingSupport, _index: number): string | undefined {
    const indices: number[] = support.groundingChunkIndices.map((i) => i+1);
    return ` [${indices.join(', ')}]`;
  }

  textPrefix(_text: string, _grounding: GroundingInfo): string {
    return "Google Says:\n";
  }

  chunkToString(chunk: GeminiGroundingChunk, index: number): string {
    const info = chunk.retrievedContext ?? chunk.web;
    return `${index}. ${info.title} - ${info.uri}`
  }

  textSuffix(_text: string, grounding: GroundingInfo): string {
    let ret = "\n";
    const chunks: GeminiGroundingChunk[] = grounding.metadata.groundingChunks;
    chunks.forEach((chunk, index) => {
      ret = `${ret}${this.chunkToString(chunk, index+1)}\n`;
    })
    return ret;
  }

}

