import {
  type CleanupMode as CleanupModeCore,
  type IndexOptions as IndexOptionsCore,
  index as indexCore,
  _batch as _batchCore,
  _deduplicateInOrder as _deduplicateInOrderCore,
  _getSourceIdAssigner as _getSourceIdAssignerCore,
  _isBaseDocumentLoader as _isBaseDocumentLoaderCore,
  _HashedDocument as _HashedDocumentCore,
} from "@langchain/core/indexing";

export type CleanupMode = CleanupModeCore;
export type IndexOptions = IndexOptionsCore;
export const index = indexCore;
export const _batch = _batchCore;
export const _deduplicateInOrder = _deduplicateInOrderCore;
export const _getSourceIdAssigner = _getSourceIdAssignerCore;
export const _isBaseDocumentLoader = _isBaseDocumentLoaderCore;
export const _HashedDocument = _HashedDocumentCore;
