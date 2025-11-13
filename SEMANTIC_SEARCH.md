# Semantic Search Implementation

This document describes the embedding-based semantic search system implemented for the quotes site.

## Overview

The site now features **embedding-based semantic search** that understands the meaning of your queries, not just keywords. This provides more relevant results by matching the semantic similarity between your search query and the quote content.

## Architecture

### Build Time (Pre-computation)
1. **Embedding Generation** (`site/build-embeddings.js`):
   - Reads all quote markdown files from `site/content/`
   - For each quote, creates a text representation combining title, content, authors, and tags
   - Uses the **all-MiniLM-L6-v2** embedding model (384 dimensions) via Transformers.js
   - Generates vector embeddings for all quotes
   - Outputs `static/embeddings_index.json` (~8-10MB for 561 quotes)

2. **Build Process** (GitHub Actions):
   - Runs after the traditional Lunr.js search index is built
   - Generates embeddings for all quotes in the repository
   - Embeddings are deployed as a static JSON file

### Runtime (Browser)
1. **Client-Side Search** (`site/static/semantic-search.js`):
   - Loads pre-computed embeddings from `/embeddings_index.json`
   - Uses Transformers.js (via CDN) to run the same embedding model in the browser
   - When user searches:
     - Embeds the query using the same model
     - Computes cosine similarity between query and all quote embeddings
     - Returns top N results ranked by similarity score

2. **Search UI** (`site/themes/ezhil/layouts/_default/search.html`):
   - Displays loading status while model initializes
   - Shows similarity scores as percentages
   - Renders top 20 most relevant results

## Technical Details

### Embedding Model
- **Model**: [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2)
- **Dimensions**: 384
- **Size**: ~23MB (cached in browser after first load)
- **Performance**: Fast inference, suitable for client-side use

### Why This Model?
- Available in both Node.js and browser via Transformers.js (ensures consistency)
- Good balance of size, speed, and quality
- Well-suited for semantic text search
- Wide browser compatibility via WASM/WebGPU

### File Sizes
- **embeddings_index.json**: ~8-10MB (561 quotes × 384 dimensions)
  - Each quote: title, slug, authors, tags, contentPreview, embedding vector
  - Embedding vectors are normalized float32 arrays

### Performance
- **First load**: ~3-5 seconds (model download + embedding index load)
- **Subsequent loads**: <1 second (model cached in browser)
- **Search latency**: <200ms (embedding query + similarity computation)

## Usage

### Running Locally

1. **Install dependencies**:
   ```bash
   cd site
   npm install
   ```

2. **Generate embeddings**:
   ```bash
   node build-embeddings.js > static/embeddings_index.json
   ```
   This will take 5-10 minutes for 561 quotes on first run (model download).

3. **Build and serve the site**:
   ```bash
   hugo server
   ```

4. **Test search**:
   - Navigate to `/search/?q=your+query`
   - Try semantic queries like:
     - "God's love and mercy"
     - "human nature and sin"
     - "worship and praise"

### Deployment

The GitHub Actions workflow automatically:
1. Installs npm dependencies
2. Generates embeddings using `build-embeddings.js`
3. Builds the Hugo site
4. Deploys to Netlify

## Comparison: Semantic vs. Keyword Search

### Keyword Search (Lunr.js)
- **Pros**: Fast, small index size (~1MB), well-tested
- **Cons**: Exact keyword matching only, no semantic understanding
- **Example**: Query "divine grace" finds only quotes containing those exact words

### Semantic Search (Embeddings)
- **Pros**: Understands meaning, finds conceptually similar quotes, better for exploratory search
- **Cons**: Larger index (~10MB), requires model download, slower first load
- **Example**: Query "divine grace" finds quotes about God's mercy, unmerited favor, redemption, etc.

## Future Enhancements

Potential improvements:
1. **Hybrid Search**: Combine keyword and semantic search for best of both worlds
2. **Search Filters**: Add filters for authors, tags, date ranges
3. **Query Suggestions**: Use embeddings to suggest related queries
4. **Model Upgrades**: Try larger models (e.g., BGE-base, ~130MB) for better quality
5. **Caching**: Implement IndexedDB caching for embeddings to reduce network usage
6. **Quantization**: Reduce embedding precision (float32 → int8) to shrink index size

## Troubleshooting

### Issue: npm install fails with sharp errors
**Solution**: The `sharp` package (optional dependency of transformers.js) may fail on some systems. This doesn't affect functionality since we're only doing text embeddings. The `.npmrc` file is configured to skip optional dependencies.

### Issue: Model download fails in browser
**Solution**: Ensure CDN access to `cdn.jsdelivr.net` or use a self-hosted copy of Transformers.js.

### Issue: Search is slow
**Solution**: The first search is slow due to model initialization. Subsequent searches are fast. Consider adding a "warm-up" search on page load.

## Dependencies

### Build-time
- `@xenova/transformers` (^2.17.2): ONNX Runtime for embeddings
- `fs-readdir-recursive`: Recursive directory reading
- `parser-front-matter`: YAML front matter parsing

### Runtime
- Transformers.js (CDN): Browser-compatible embedding model inference
- Modern browser with WebAssembly support

## References

- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js)
- [Sentence Transformers](https://www.sbert.net/)
- [Semantic Search Guide](https://www.pinecone.io/learn/semantic-search/)
