#!/usr/bin/env python3
"""
Generate embeddings for all quotes using sentence-transformers.

This script:
1. Reads all markdown files from the content directory
2. Generates embeddings using the all-MiniLM-L6-v2 model
3. Outputs a JSON file with embeddings and metadata
"""

import json
import sys
from pathlib import Path
from typing import List, Dict, Any
import frontmatter
from sentence_transformers import SentenceTransformer


def load_quotes(content_dir: Path) -> List[Dict[str, Any]]:
    """Load all quote files from the content directory."""
    quotes = []

    # Recursively find all .md files
    for md_file in content_dir.rglob('*.md'):
        try:
            # Parse front matter
            with open(md_file, 'r', encoding='utf-8') as f:
                post = frontmatter.load(f)

            # Create slug from file path relative to content dir
            relative_path = md_file.relative_to(content_dir)
            slug = str(relative_path.with_suffix('')).replace('\\', '/')

            # Extract metadata
            quote = {
                'title': post.get('title', ''),
                'slug': slug,
                'content': post.content.strip(),
                'authors': post.get('authors', []),
                'tags': post.get('tags', []),
                'description': post.get('description', ''),
                'date': str(post.get('date', ''))
            }

            quotes.append(quote)

        except Exception as e:
            print(f"Error loading {md_file}: {e}", file=sys.stderr)
            continue

    return quotes


def create_embedding_text(quote: Dict[str, Any]) -> str:
    """Create a text representation of a quote for embedding."""
    parts = []

    if quote['title']:
        parts.append(quote['title'])

    if quote['content']:
        parts.append(quote['content'])

    if quote['authors']:
        authors_str = ', '.join(quote['authors']) if isinstance(quote['authors'], list) else str(quote['authors'])
        parts.append(f"Authors: {authors_str}")

    if quote['tags']:
        tags_str = ', '.join(quote['tags']) if isinstance(quote['tags'], list) else str(quote['tags'])
        parts.append(f"Tags: {tags_str}")

    return '\n\n'.join(parts)


def generate_embeddings(quotes: List[Dict[str, Any]], model_name: str = 'sentence-transformers/all-MiniLM-L6-v2') -> List[Dict[str, Any]]:
    """Generate embeddings for all quotes."""
    print(f"Loading model: {model_name}", file=sys.stderr)
    model = SentenceTransformer(model_name)

    print(f"Generating embeddings for {len(quotes)} quotes...", file=sys.stderr)

    # Prepare texts for embedding
    texts = [create_embedding_text(quote) for quote in quotes]

    # Generate embeddings in batches for efficiency
    embeddings = model.encode(
        texts,
        show_progress_bar=True,
        batch_size=32,
        normalize_embeddings=True  # Normalize for cosine similarity
    )

    # Build results
    results = []
    for i, quote in enumerate(quotes):
        # Create content preview
        content_preview = quote['content'][:200] if quote['content'] else ''

        result = {
            'title': quote['title'],
            'slug': quote['slug'],
            'authors': quote['authors'],
            'tags': quote['tags'],
            'description': quote['description'],
            'contentPreview': content_preview,
            'date': quote['date'],
            'embedding': embeddings[i].tolist()  # Convert numpy array to list
        }
        results.append(result)

        if (i + 1) % 50 == 0:
            print(f"Processed {i + 1}/{len(quotes)} quotes...", file=sys.stderr)

    print("Embedding generation complete!", file=sys.stderr)
    return results


def main():
    """Main function."""
    script_dir = Path(__file__).parent
    content_dir = script_dir / 'content'

    if not content_dir.exists():
        print(f"Error: Content directory not found: {content_dir}", file=sys.stderr)
        sys.exit(1)

    # Load quotes
    print(f"Loading quotes from {content_dir}", file=sys.stderr)
    quotes = load_quotes(content_dir)
    print(f"Loaded {len(quotes)} quotes", file=sys.stderr)

    if not quotes:
        print("Error: No quotes found!", file=sys.stderr)
        sys.exit(1)

    # Generate embeddings
    embeddings = generate_embeddings(quotes)

    # Create output structure
    output = {
        'model': 'sentence-transformers/all-MiniLM-L6-v2',
        'dimensions': 384,
        'count': len(embeddings),
        'generatedAt': None,  # Will be set by JavaScript Date
        'embeddings': embeddings
    }

    # Output to stdout (will be redirected to file)
    print(json.dumps(output, ensure_ascii=False))
    print(f"Generated {len(embeddings)} embeddings", file=sys.stderr)


if __name__ == '__main__':
    main()
