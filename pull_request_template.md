# Pull Request: Add Score Normalization Feature to PGVectorStore

## Summary

This PR addresses the inconsistency where PGVectorStore was the only vector store in the LangChain ecosystem returning raw distance values instead of similarity scores. The implementation adds a configurable `scoreNormalization` option that allows users to choose between returning raw distances (backward compatible default) or normalized similarity scores (higher = more similar).

## Problem

Currently, PGVectorStore returns raw distance values in `similaritySearchVectorWithScore` where lower values indicate higher similarity, unlike other vector stores (MemoryVectorStore, FAISS, Chroma, Pinecone, etc.) that return similarity scores where higher values indicate higher similarity. This inconsistency creates confusion for users moving between different vector stores.

## Solution

1. **Added `scoreNormalization` option** to `PGVectorStoreArgs` interface with values `"distance"` (default) | `"similarity"`
2. **Implemented proper conversion formulas**:
   - Cosine: `similarity = (2 - distance) / 2` (normalizes to [0,1] range)
   - Euclidean: `similarity = 1 / (1 + distance)`
   - InnerProduct: `similarity = -distance` (negation of pgvector's negative inner product)
3. **Created dedicated conversion methods** with deduplicated logic
4. **Maintained full backward compatibility** by defaulting to "distance" mode
5. **Added comprehensive tests** covering all scenarios

## Changes Made

### Core Implementation (`libs/langchain-community/src/vectorstores/pgvector.ts`)

- Added `scoreNormalization` property to interface and class
- Implemented `convertDistanceToSimilarity` with proper normalization for each strategy
- Updated `convertDistanceToScore` to use the configuration setting
- Added `convertDistanceToBoth` for accessing both scores when needed
- Created `similaritySearchVectorWithScores` method for dual-score return

### Test Suite (`libs/langchain-community/src/vectorstores/tests/pgvector_score_normalization.test.ts`)

- Added comprehensive tests covering default behavior, distance mode, and similarity mode
- Verified document ranking preservation across normalization modes
- Tested different distance strategies (cosine, euclidean, innerProduct)
- Included edge case testing

## Key Features

- **Backward Compatible**: Default behavior unchanged (returns distances)
- **Configurable**: Users can opt into similarity scores with `scoreNormalization: "similarity"`
- **Consistent**: Now matches behavior of other LangChain vector stores
- **Well-Tested**: Comprehensive test coverage for all scenarios
- **Documented**: Clear JSDoc comments explaining the behavior

## Impact

- Fixes inconsistency in the LangChain vector store ecosystem
- Enables users to get similarity scores where higher = more similar
- Maintains full backward compatibility for existing implementations
- Follows LangChain's established patterns and conventions

## Testing

All tests pass and verify:

- Default behavior preserves original distance-based scores
- Similarity mode returns properly normalized similarity scores
- Document ranking remains consistent regardless of normalization mode
- Different distance strategies work correctly with normalization
- Edge cases are handled properly
