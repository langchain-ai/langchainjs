import {
  createAgent,
  HumanMessage,
  AIMessage,
  type AgentMiddleware,
} from "langchain";
import { promptCachingMiddleware } from "@langchain/anthropic";

// Example usage
const agent = createAgent({
  model: "anthropic:claude-sonnet-4-20250514",
  tools: [],
  middleware: [promptCachingMiddleware({ ttl: "5m" }) as AgentMiddleware],
});

// Usage example with a long chat history for testing caching
const result = await agent.invoke({
  messages: [
    // Initial conversation about prompt caching basics
    new HumanMessage(
      "What is prompt caching and why is it important for LLM applications?"
    ),
    new AIMessage(
      "Prompt caching is a technique that stores and reuses previously processed portions of prompts to optimize LLM API usage. It's important because:\n\n1. **Cost Reduction**: By caching common prompt prefixes, you avoid reprocessing the same tokens repeatedly, significantly reducing API costs.\n2. **Latency Improvement**: Cached prompts are processed faster since the model doesn't need to recompute embeddings for cached portions.\n3. **Better Resource Utilization**: Reduces computational load on both client and server sides.\n4. **Improved User Experience**: Faster response times lead to more responsive applications.\n\nIt's particularly valuable for applications with repetitive prompts, long system messages, or extensive conversation histories."
    ),

    // Deep dive into technical details
    new HumanMessage(
      "How does prompt caching work at a technical level? What happens when a prompt is cached?"
    ),
    new AIMessage(
      "At a technical level, prompt caching works through several steps:\n\n1. **Token Processing**: When a prompt is first sent, the model processes tokens and generates internal representations (embeddings and attention states).\n\n2. **Cache Storage**: These intermediate representations are stored in a cache with a unique identifier based on the prompt prefix.\n\n3. **Cache Matching**: For subsequent requests, the system checks if any prefix of the new prompt matches cached entries.\n\n4. **Partial Processing**: If a match is found, the model skips processing the cached portion and starts from where the cache ends.\n\n5. **Cache Management**: Caches have TTL (Time To Live) settings and eviction policies to manage memory usage.\n\nThe cache typically stores:\n- Token embeddings\n- Attention matrices\n- Hidden states from transformer layers\n- Position encodings\n\nThis allows the model to resume processing from any cached point without quality loss."
    ),

    // Implementation specifics
    new HumanMessage(
      "What are the best practices for implementing prompt caching in a production environment?"
    ),
    new AIMessage(
      "Here are key best practices for production prompt caching:\n\n**1. Cache Strategy**\n- Cache stable prefixes (system prompts, common instructions)\n- Use appropriate TTL values (5-60 minutes typically)\n- Implement cache warming for frequently used prompts\n\n**2. Monitoring & Metrics**\n- Track cache hit rates\n- Monitor cache size and memory usage\n- Log cache evictions and misses\n- Measure latency improvements\n\n**3. Cache Invalidation**\n- Implement versioning for cached prompts\n- Clear caches when system prompts change\n- Use cache tags for grouped invalidation\n\n**4. Error Handling**\n- Gracefully fall back to non-cached requests\n- Implement retry logic for cache failures\n- Log cache-related errors separately\n\n**5. Security Considerations**\n- Ensure cached data is properly isolated between users\n- Implement access controls for cache management\n- Consider encryption for sensitive cached content\n\n**6. Optimization Tips**\n- Batch similar requests to maximize cache reuse\n- Structure prompts with common prefixes\n- Use consistent formatting to improve cache hits"
    ),

    // Specific use cases
    new HumanMessage(
      "Can you provide examples of applications that benefit most from prompt caching?"
    ),
    new AIMessage(
      "Several applications benefit significantly from prompt caching:\n\n**1. Customer Support Chatbots**\n- Long system prompts with company policies\n- FAQ responses with common prefixes\n- Multi-turn conversations with context retention\n- Benefit: 60-80% cost reduction on repeat queries\n\n**2. Code Generation Tools**\n- Large codebases as context\n- Common import statements and boilerplate\n- Repeated analysis of the same files\n- Benefit: Faster iteration on code changes\n\n**3. Document Analysis Systems**\n- Legal documents with standard clauses\n- Medical records with common formats\n- Financial reports with recurring sections\n- Benefit: Rapid document processing at scale\n\n**4. Educational Platforms**\n- Course materials as context\n- Standardized question formats\n- Student interaction histories\n- Benefit: Personalized learning at lower cost\n\n**5. Content Generation**\n- Brand voice guidelines\n- SEO templates\n- Style guides and tone specifications\n- Benefit: Consistent content generation\n\n**6. Multi-Agent Systems**\n- Shared context between agents\n- Common tool definitions\n- Workflow templates\n- Benefit: Efficient agent coordination"
    ),

    // Advanced caching strategies
    new HumanMessage(
      "What are some advanced caching strategies for complex conversational AI systems?"
    ),
    new AIMessage(
      "Advanced caching strategies for complex conversational AI include:\n\n**1. Hierarchical Caching**\n- **L1 Cache**: Hot prompts (< 1 minute TTL)\n- **L2 Cache**: Warm prompts (5-15 minutes TTL)\n- **L3 Cache**: Cold storage (hours to days)\n- Automatic promotion/demotion between levels\n\n**2. Semantic Caching**\n- Cache based on semantic similarity, not just exact matches\n- Use embedding models to find similar prompts\n- Cluster related prompts for better reuse\n- Implement fuzzy matching for minor variations\n\n**3. Predictive Caching**\n- Pre-cache likely next prompts based on user behavior\n- Use ML models to predict conversation flow\n- Warm caches during low-traffic periods\n- Implement speculative caching for common paths\n\n**4. Distributed Caching**\n- Use Redis or Memcached for shared caches\n- Implement cache synchronization across instances\n- Geographic distribution for global applications\n- Consistent hashing for cache distribution\n\n**5. Context-Aware Caching**\n- Cache different versions based on user segments\n- Implement role-based cache strategies\n- Time-based cache variations (business hours vs. off-hours)\n- Location-aware caching for regional differences\n\n**6. Compression Techniques**\n- Compress cached representations\n- Use quantization for embedding storage\n- Implement delta encoding for similar prompts\n- Apply pruning for less important attention weights"
    ),

    // Performance optimization
    new HumanMessage(
      "How can I measure and optimize the performance impact of prompt caching in my application?"
    ),
    new AIMessage(
      "Here's a comprehensive approach to measuring and optimizing prompt caching performance:\n\n**Performance Metrics to Track:**\n\n1. **Cache Efficiency**\n   - Hit Rate: (Cache Hits / Total Requests) × 100\n   - Miss Rate: (Cache Misses / Total Requests) × 100\n   - Eviction Rate: Frequency of cache evictions\n   - Cache Utilization: Used cache space vs. available\n\n2. **Latency Metrics**\n   - P50, P95, P99 response times with/without cache\n   - Time saved per cached request\n   - Cache lookup time\n   - Cache write time\n\n3. **Cost Metrics**\n   - Tokens saved through caching\n   - API cost reduction percentage\n   - Infrastructure cost for cache storage\n   - ROI of caching implementation\n\n**Optimization Strategies:**\n\n1. **Cache Key Optimization**\n   ```typescript\n   // Instead of caching entire prompts\n   const key = hash(entirePrompt);\n   \n   // Cache stable prefixes\n   const key = hash(systemPrompt + conversationPrefix);\n   ```\n\n2. **Adaptive TTL**\n   - Short TTL for volatile content (1-5 min)\n   - Long TTL for stable content (1-24 hours)\n   - Dynamic TTL based on access patterns\n\n3. **Cache Preloading**\n   - Identify common patterns through analytics\n   - Preload during application startup\n   - Background refresh of popular entries\n\n4. **Memory Management**\n   - Implement LRU (Least Recently Used) eviction\n   - Set appropriate cache size limits\n   - Monitor memory pressure\n   - Use memory-mapped files for large caches\n\n**Monitoring Implementation:**\n```typescript\ninterface CacheMetrics {\n  hits: number;\n  misses: number;\n  evictions: number;\n  avgHitLatency: number;\n  avgMissLatency: number;\n  memorySizeMB: number;\n  tokensSaved: number;\n  costSaved: number;\n}\n```\n\n**A/B Testing Strategy:**\n- Run parallel experiments with different cache configs\n- Compare user experience metrics\n- Measure impact on conversion rates\n- Analyze cost-benefit ratios"
    ),

    // Current question for continued testing
    new HumanMessage(
      "What are the key features of prompt caching that I should focus on when implementing this middleware?"
    ),
  ],
});

console.log("\nAgent response:", result.messages.at(-1)?.content);
