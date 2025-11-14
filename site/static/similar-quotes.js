/**
 * Similar Quotes Module
 * Finds and displays quotes similar to the current one using embeddings
 */

class SimilarQuotes {
    constructor() {
        this.embeddings = null;
        this.MIN_SIMILARITY = 0.3;
        this.MAX_RESULTS = 5;
    }

    /**
     * Initialize and load the embeddings index
     */
    async initialize() {
        if (this.embeddings) {
            return;
        }

        try {
            const response = await fetch('/embeddings_index.json');
            if (!response.ok) {
                throw new Error(`Failed to load embeddings: ${response.status}`);
            }
            this.embeddings = await response.json();
        } catch (error) {
            console.error('Error loading embeddings:', error);
            throw error;
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
     * Find similar quotes for a given slug
     * @param {string} currentSlug - The slug of the current quote
     * @returns {Array} Array of similar quotes with their similarity scores
     */
    async findSimilar(currentSlug) {
        await this.initialize();

        // Find the current quote in the embeddings
        const currentQuote = this.embeddings.embeddings.find(
            q => q.slug === currentSlug || q.slug.endsWith(`/${currentSlug}`)
        );

        if (!currentQuote) {
            console.warn(`Quote not found in embeddings: ${currentSlug}`);
            return [];
        }

        const currentEmbedding = currentQuote.embedding;
        const similarities = [];

        // Compute similarity with all other quotes
        for (const quote of this.embeddings.embeddings) {
            // Skip the current quote itself
            if (quote.slug === currentQuote.slug) {
                continue;
            }

            const similarity = this.cosineSimilarity(currentEmbedding, quote.embedding);

            if (similarity >= this.MIN_SIMILARITY) {
                similarities.push({
                    ...quote,
                    similarity: similarity
                });
            }
        }

        // Sort by similarity (highest first) and take top N
        similarities.sort((a, b) => b.similarity - a.similarity);
        return similarities.slice(0, this.MAX_RESULTS);
    }

    /**
     * Render similar quotes in the DOM
     * @param {string} containerId - The ID of the container element
     * @param {string} currentSlug - The slug of the current quote
     */
    async renderSimilarQuotes(containerId, currentSlug) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container not found: ${containerId}`);
            return;
        }

        try {
            const similarQuotes = await this.findSimilar(currentSlug);

            if (similarQuotes.length === 0) {
                // Don't show the section if there are no similar quotes
                container.style.display = 'none';
                return;
            }

            // Build the HTML
            let html = '<div class="similar-quotes-header">Similar Quotes</div>';
            html += '<div class="similar-quotes-list">';

            for (const quote of similarQuotes) {
                const url = `/${quote.slug}`;
                const preview = quote.contentPreview || '';
                const truncatedPreview = preview.length > 100
                    ? preview.substring(0, 100) + '...'
                    : preview;

                const authors = quote.authors && quote.authors.length > 0
                    ? `<span class="similar-quote-author">${quote.authors.join(', ')}</span>`
                    : '';

                html += `
                    <div class="similar-quote-item">
                        <a href="${url}" class="similar-quote-title">${quote.title}</a>
                        ${authors}
                        <div class="similar-quote-preview">${truncatedPreview}</div>
                    </div>
                `;
            }

            html += '</div>';
            container.innerHTML = html;
            container.style.display = 'block';

        } catch (error) {
            console.error('Error rendering similar quotes:', error);
            container.style.display = 'none';
        }
    }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
    window.SimilarQuotes = SimilarQuotes;
}
