import { sign } from "../../utils/tencent_hunyuan/index.js";
import {
  TencentHunyuanEmbeddings as BaseTencentHunyuanEmbeddings,
  TencentHunyuanEmbeddingsParams,
} from "./base.js";

/**
 * Class for generating embeddings using the Tencent Hunyuan API.
 */
export class TencentHunyuanEmbeddings extends BaseTencentHunyuanEmbeddings {
  constructor(fields?: TencentHunyuanEmbeddingsParams) {
    super({ ...fields, sign });
  }
}

export { type TencentHunyuanEmbeddingsParams } from "./base.js";
