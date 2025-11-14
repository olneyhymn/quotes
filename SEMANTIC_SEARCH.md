# Semantic Search Implementation

This document describes the embedding-based semantic search system implemented for the quotes site.

## Overview

The site now features **embedding-based semantic search** that understands the meaning of your queries, not just keywords. This provides more relevant results by matching the semantic similarity between your search query and the quote content.

## Architecture

### Build Time (Pre-computation)
1. **Embedding Generation** (`site/build-embeddings.py`):
   - Reads all quote markdown files from `site/content/`
   - For each quote, creates a text representation combining title, content, authors, and tags
   - Uses the **all-MiniLM-L6-v2** embedding model (384 dimensions) via sentence-transformers
   - Generates vector embeddings for all quotes with batch processing
   - Outputs `static/embeddings_index.json` (~8-10MB for 621 quotes)

2. **Build Process** (GitHub Actions):
   - Runs after the traditional Lunr.js search index is built
   - Uses Python (already in workflow for image generation)
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
- **Model**: [sentence-transformers/all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
- **Dimensions**: 384
- **Size**: ~23MB (cached in browser after first load)
- **Performance**: Fast inference, suitable for client-side use

### Why This Model?
- Available in both Python (sentence-transformers) and browser (Transformers.js)
- Good balance of size, speed, and quality
- Well-suited for semantic text search
- Wide browser compatibility via WASM/WebGPU
- Battle-tested and mature library ecosystem

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
   pip install -r requirements.txt
   npm install
   ```

2. **Generate embeddings**:
   ```bash
   python build-embeddings.py > static/embeddings_index.json
   ```
   This will take 3-5 minutes for 621 quotes on first run (model download).

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
1. Installs Python dependencies (`pip install -r requirements.txt`)
2. Installs npm dependencies
3. Generates embeddings using `build-embeddings.py`
4. Builds the Hugo site
5. Deploys to Netlify

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

### Issue: pip install fails for sentence-transformers
**Solution**: Ensure you have Python 3.8+ and PyTorch installed. On some systems you may need to install PyTorch separately first:
```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install sentence-transformers
```

### Issue: Model download fails during build
**Solution**: The sentence-transformers library downloads models from HuggingFace Hub. Ensure the build environment has internet access. The model (~80MB total) will be cached in `~/.cache/huggingface/`.

### Issue: Model download fails in browser
**Solution**: Ensure CDN access to `cdn.jsdelivr.net` or use a self-hosted copy of Transformers.js.

### Issue: Search is slow
**Solution**: The first search is slow due to model initialization. Subsequent searches are fast. Consider adding a "warm-up" search on page load.

## Dependencies

### Build-time (Python)
- `sentence-transformers`: Generate embeddings using transformer models
- `python-frontmatter`: Parse YAML front matter from markdown files
- Python 3.8+ with PyTorch

### Build-time (Node.js)
- `fs-readdir-recursive`: Recursive directory reading (for Lunr.js index)
- `parser-front-matter`: YAML front matter parsing (for Lunr.js index)
- `lunr`: Traditional keyword search index

### Runtime (Browser)
- Transformers.js (CDN): Browser-compatible embedding model inference
- Modern browser with WebAssembly support

## References

- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js)
- [Sentence Transformers](https://www.sbert.net/)
- [Semantic Search Guide](https://www.pinecone.io/learn/semantic-search/)
