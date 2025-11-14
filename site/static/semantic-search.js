/**
 * Semantic Search Implementation using Transformers.js
 * This provides embedding-based search for static sites
 */

// Configuration
const DEBUG_MODE = false; // Set to true to enable debug logging

// Constants
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EXPECTED_DIMENSIONS = 384;
const MIN_SIMILARITY_THRESHOLD = 0.1;  // Filter out very low similarity results
const EXPECTED_SCHEMA_VERSION = '1.0';

// Debug logging helper
const debug = (...args) => {
  if (DEBUG_MODE) {
    console.log('[SemanticSearch]', ...args);
  }
};

class SemanticSearch {
  constructor() {
    this.embeddings = null;
    this.extractor = null;
    this.isLoading = false;
    this.isReady = false;
    this.metadata = null;
  }

  /**
   * Validate embeddings data structure
   */
  _validateEmbeddings(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid embeddings data: not an object');
    }

    if (!Array.isArray(data.embeddings)) {
      throw new Error('Invalid embeddings data: embeddings is not an array');
    }

    if (data.dimensions !== EXPECTED_DIMENSIONS) {
      throw new Error(
        `Dimension mismatch: expected ${EXPECTED_DIMENSIONS}, got ${data.dimensions}`
      );
    }

    if (data.version !== EXPECTED_SCHEMA_VERSION) {
      console.warn(
        `Schema version mismatch: expected ${EXPECTED_SCHEMA_VERSION}, got ${data.version}`
      );
    }

    // Validate first embedding structure
    if (data.embeddings.length > 0) {
      const first = data.embeddings[0];
      if (!first.embedding || !Array.isArray(first.embedding)) {
        throw new Error('Invalid embedding structure: embedding is not an array');
      }
      if (first.embedding.length !== EXPECTED_DIMENSIONS) {
        throw new Error(
          `First embedding has wrong dimensions: expected ${EXPECTED_DIMENSIONS}, got ${first.embedding.length}`
        );
      }
    }

    return true;
  }

  /**
   * Initialize the search by loading embeddings and model
   */
  async initialize() {
    if (this.isLoading || this.isReady) return;

    this.isLoading = true;

    try {
      // Load pre-computed embeddings
      debug('Loading search index...');
      const response = await fetch('/embeddings_index.json');

      if (!response.ok) {
        throw new Error(`Failed to fetch search index: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Validate embeddings data
      this._validateEmbeddings(data);

      this.embeddings = data.embeddings;
      this.metadata = {
        model: data.model,
        dimensions: data.dimensions,
        count: data.count,
        version: data.version
      };

      debug(`Loaded ${this.embeddings.length} quotes`);
      debug(`Model: ${this.metadata.model}, Dimensions: ${this.metadata.dimensions}`);

      // Load transformers.js model
      debug('Loading search model...');

      // Import transformers.js from CDN
      const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');

      // Configure to use remote models from HuggingFace Hub
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      env.allowRemoteModels = true;

      // Initialize the feature extraction pipeline
      this.extractor = await pipeline(
        'feature-extraction',
        MODEL_NAME,
        {
          quantized: true,  // Use quantized model for faster loading
        }
      );

      debug('Search ready!');
      this.isReady = true;
    } catch (error) {
      console.error('Error initializing search:', error);
      this.isLoading = false;
      this.isReady = false;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Compute cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Search for quotes similar to the query
   * @param {string} query - The search query
   * @param {number} topK - Number of results to return (default: 10)
   * @param {number} minScore - Minimum similarity score to include (default: MIN_SIMILARITY_THRESHOLD)
   * @returns {Array} - Array of search results with similarity scores
   */
  async search(query, topK = 10, minScore = MIN_SIMILARITY_THRESHOLD) {
    if (!this.isReady) {
      throw new Error('Semantic search not initialized. Call initialize() first.');
    }

    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      // Generate embedding for the query
      const output = await this.extractor(query, { pooling: 'mean', normalize: true });
      const queryEmbedding = Array.from(output.data);

      // Validate query embedding dimensions
      if (queryEmbedding.length !== EXPECTED_DIMENSIONS) {
        throw new Error(
          `Query embedding dimension mismatch: expected ${EXPECTED_DIMENSIONS}, got ${queryEmbedding.length}`
        );
      }

      // Compute similarity scores for all quotes
      const results = [];
      for (const item of this.embeddings) {
        const similarity = this.cosineSimilarity(queryEmbedding, item.embedding);

        // Filter out low similarity results early for performance
        if (similarity >= minScore) {
          results.push({
            title: item.title,
            slug: item.slug,
            authors: item.authors,
            tags: item.tags,
            description: item.description,
            contentPreview: item.contentPreview,
            date: item.date,
            score: similarity
            // Note: embedding removed to reduce memory usage
          });
        }
      }

      // Sort by similarity score (highest first)
      results.sort((a, b) => b.score - a.score);

      // Return top K results
      return results.slice(0, topK);

    } catch (error) {
      console.error('Error during search:', error);
      throw error;
    }
  }

  /**
   * Get the status of the search engine
   */
  getStatus() {
    if (this.isReady) return 'ready';
    if (this.isLoading) return 'loading';
    return 'not_initialized';
  }

  /**
   * Get metadata about loaded embeddings
   */
  getMetadata() {
    return this.metadata ? { ...this.metadata } : null;
  }

  /**
   * Get statistics about the search index
   */
  getStats() {
    if (!this.embeddings) {
      return null;
    }

    return {
      totalEmbeddings: this.embeddings.length,
      dimensions: this.metadata?.dimensions || EXPECTED_DIMENSIONS,
      model: this.metadata?.model || 'unknown',
      isReady: this.isReady,
      isLoading: this.isLoading
    };
  }
}

// Create a global instance
if (typeof window !== 'undefined') {
  window.semanticSearch = new SemanticSearch();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SemanticSearch;
}
