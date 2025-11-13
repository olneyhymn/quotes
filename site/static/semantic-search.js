/**
 * Semantic Search Implementation using Transformers.js
 * This provides embedding-based search for static sites
 */

class SemanticSearch {
  constructor() {
    this.embeddings = null;
    this.extractor = null;
    this.isLoading = false;
    this.isReady = false;
  }

  /**
   * Initialize the search by loading embeddings and model
   */
  async initialize() {
    if (this.isLoading || this.isReady) return;

    this.isLoading = true;

    try {
      // Load pre-computed embeddings
      console.log('Loading embeddings...');
      const response = await fetch('/embeddings_index.json');
      const data = await response.json();
      this.embeddings = data.embeddings;
      console.log(`Loaded ${this.embeddings.length} quote embeddings`);

      // Load transformers.js model
      console.log('Loading embedding model...');

      // Import transformers.js from CDN
      const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');

      // Initialize the feature extraction pipeline
      this.extractor = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2'
      );

      console.log('Semantic search ready!');
      this.isReady = true;
    } catch (error) {
      console.error('Error initializing semantic search:', error);
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
   * @returns {Array} - Array of search results with similarity scores
   */
  async search(query, topK = 10) {
    if (!this.isReady) {
      throw new Error('Semantic search not initialized. Call initialize() first.');
    }

    if (!query || query.trim().length === 0) {
      return [];
    }

    // Generate embedding for the query
    const output = await this.extractor(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(output.data);

    // Compute similarity scores for all quotes
    const results = this.embeddings.map(item => {
      const similarity = this.cosineSimilarity(queryEmbedding, item.embedding);
      return {
        ...item,
        score: similarity,
        // Remove embedding from results to reduce payload size
        embedding: undefined
      };
    });

    // Sort by similarity score (highest first)
    results.sort((a, b) => b.score - a.score);

    // Return top K results
    return results.slice(0, topK);
  }

  /**
   * Get the status of the search engine
   */
  getStatus() {
    if (this.isReady) return 'ready';
    if (this.isLoading) return 'loading';
    return 'not_initialized';
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
