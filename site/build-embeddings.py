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

# Constants
MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'
EMBEDDING_DIMENSIONS = 384
BATCH_SIZE = 32


def is_draft(post_data: Dict[str, Any]) -> bool:
    """Check if a post is a draft, handling both boolean and string values."""
    draft_value = post_data.get('draft', False)

    # Handle string values from YAML (e.g., 'false', 'true')
    if isinstance(draft_value, str):
        return draft_value.lower() in ('true', '1', 'yes')

    # Handle boolean values
    return bool(draft_value)


def load_quotes(content_dir: Path) -> List[Dict[str, Any]]:
    """Load all quote files from the content directory."""
    quotes = []
    skipped_count = {'index': 0, 'draft': 0, 'empty': 0, 'error': 0}

    # Recursively find all .md files
    for md_file in content_dir.rglob('*.md'):
        # Skip Hugo index files (_index.md)
        if md_file.name == '_index.md':
            skipped_count['index'] += 1
            continue

        try:
            # Parse front matter
            with open(md_file, 'r', encoding='utf-8') as f:
                post = frontmatter.load(f)

            # Skip drafts (handle both string and boolean values)
            if is_draft(post):
                skipped_count['draft'] += 1
                continue

            # Skip posts without meaningful content
            content = post.content.strip()
            if not content:
                skipped_count['empty'] += 1
                continue

            # Create slug - respect Hugo's front matter slug field if present
            relative_path = md_file.relative_to(content_dir)

            # Get the section (directory containing the file)
            if len(relative_path.parts) > 1:
                section = relative_path.parts[0]
            else:
                section = ''

            # Use front matter slug if available, otherwise use filename
            if 'slug' in post and post['slug']:
                # Hugo uses /section/slug/ format when front matter slug is present
                slug = f"{section}/{post['slug']}" if section else post['slug']
            else:
                # Hugo uses filename-based slug when no front matter slug
                slug = str(relative_path.with_suffix('')).replace('\\', '/')

            # Extract metadata with validation
            quote = {
                'title': post.get('title', '').strip(),
                'slug': slug,
                'content': content,
                'authors': post.get('authors', []) if isinstance(post.get('authors', []), list) else [],
                'tags': post.get('tags', []) if isinstance(post.get('tags', []), list) else [],
                'description': post.get('description', '').strip(),
                'date': str(post.get('date', ''))
            }

            # Skip if title is missing (likely not a valid quote)
            if not quote['title']:
                print(f"Warning: Skipping {md_file} - no title found", file=sys.stderr)
                skipped_count['empty'] += 1
                continue

            quotes.append(quote)

        except Exception as e:
            print(f"Error loading {md_file}: {e}", file=sys.stderr)
            skipped_count['error'] += 1
            continue

    # Print summary
    print(f"Skipped: {skipped_count['index']} index files, {skipped_count['draft']} drafts, "
          f"{skipped_count['empty']} empty/invalid, {skipped_count['error']} errors",
          file=sys.stderr)

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


def generate_embeddings(quotes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Generate embeddings for all quotes."""
    if not quotes:
        raise ValueError("No quotes provided for embedding generation")

    print(f"Loading model: {MODEL_NAME}", file=sys.stderr)
    try:
        model = SentenceTransformer(MODEL_NAME)
    except Exception as e:
        print(f"Error loading model: {e}", file=sys.stderr)
        raise

    print(f"Generating embeddings for {len(quotes)} quotes...", file=sys.stderr)

    # Prepare texts for embedding
    texts = [create_embedding_text(quote) for quote in quotes]

    # Validate texts
    if not all(texts):
        print("Warning: Some quotes produced empty embedding text", file=sys.stderr)

    # Generate embeddings in batches for efficiency
    try:
        embeddings = model.encode(
            texts,
            show_progress_bar=True,
            batch_size=BATCH_SIZE,
            normalize_embeddings=True  # Normalize for cosine similarity
        )
    except Exception as e:
        print(f"Error generating embeddings: {e}", file=sys.stderr)
        raise

    # Validate embedding dimensions
    if len(embeddings) > 0 and embeddings[0].shape[0] != EMBEDDING_DIMENSIONS:
        raise ValueError(
            f"Expected {EMBEDDING_DIMENSIONS} dimensions, got {embeddings[0].shape[0]}"
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
    try:
        script_dir = Path(__file__).parent
        content_dir = script_dir / 'content'

        if not content_dir.exists():
            print(f"Error: Content directory not found: {content_dir}", file=sys.stderr)
            sys.exit(1)

        # Load quotes
        print(f"Loading quotes from {content_dir}", file=sys.stderr)
        quotes = load_quotes(content_dir)
        print(f"Loaded {len(quotes)} valid quotes", file=sys.stderr)

        if not quotes:
            print("Error: No valid quotes found!", file=sys.stderr)
            sys.exit(1)

        # Generate embeddings
        embeddings = generate_embeddings(quotes)

        # Validate output
        if len(embeddings) != len(quotes):
            print(f"Warning: Mismatch between quotes ({len(quotes)}) and embeddings ({len(embeddings)})",
                  file=sys.stderr)

        # Create output structure with metadata
        output = {
            'model': MODEL_NAME,
            'dimensions': EMBEDDING_DIMENSIONS,
            'count': len(embeddings),
            'version': '1.0',  # Schema version for compatibility checking
            'generatedAt': None,  # Will be set by JavaScript Date in browser
            'embeddings': embeddings
        }

        # Output to stdout (will be redirected to file)
        json_output = json.dumps(output, ensure_ascii=False, indent=None)
        print(json_output)

        # Print summary to stderr
        print(f"\n✓ Successfully generated {len(embeddings)} embeddings", file=sys.stderr)
        print(f"✓ Model: {MODEL_NAME}", file=sys.stderr)
        print(f"✓ Dimensions: {EMBEDDING_DIMENSIONS}", file=sys.stderr)
        print(f"✓ Output size: {len(json_output) / 1024 / 1024:.2f} MB", file=sys.stderr)

    except Exception as e:
        print(f"\n✗ Fatal error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
