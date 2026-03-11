// Manually generated for now

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Vertex {

  export interface InstanceContent {
    content: string;
  }

  export interface InstanceText {
    text: string;
  }

  export interface InstanceImageUri {
    image: {
      gcsUri: string;
    }
  }

  export interface InstanceImageBase64 {
    image: {
      bytesBase64Encoded: string;
    }
  }

  export type InstanceImage = InstanceImageUri | InstanceImageBase64;

  export interface InstanceVideoSegmentConfig {
    startOffsetSec: number;
    endOffsetSec: number;
    intervalSec: number;
  }

  export interface InstanceVideoUri {
    video: {
      gcsUri: string;
      videoSegmentConfig?: InstanceVideoSegmentConfig;
    }
  }

  export interface InstanceVideoBase64 {
    video: {
      bytesBase64Encoded: string;
      videoSegmentConfig?: InstanceVideoSegmentConfig;
    }
  }

  export type InstanceVideo = InstanceVideoUri | InstanceVideoBase64;

  export type InstanceMultimodal = Partial<InstanceText> & Partial<InstanceImage> & Partial<InstanceVideo>;

  export type Instance = Partial<InstanceContent> | InstanceMultimodal;

  export interface Params {
    autoTruncate?: boolean;
    outputDimensionality?: number;
  }

  export interface Request {
    instances: Instance[];
    parameters?: Params;
  }

  export interface PredictionContent {
    embeddings: {
      statistics: {
        token_count: number;
        truncated: boolean;
      };
      values: number[];
    };
  }

  export interface TextEmbedding {
    textEmbedding: number[];
  }

  export interface ImageEmbedding {
    imageEmbedding: number[];
  }

  export interface VideoEmbedding {
    embedding: number[];
    startOffsetSec: number;
    endOffsetSec: number;
  }

  export interface VideoEmbeddings {
    videoEmbeddings: VideoEmbedding[];
  }

  export type PredictionMultimodal = Partial<TextEmbedding> & Partial<ImageEmbedding> & Partial<VideoEmbeddings>;

  export type Prediction = Partial<PredictionContent> | PredictionMultimodal;

  export interface Response {
    predictions: Prediction[];
    deployedModelId: string;
  }

}