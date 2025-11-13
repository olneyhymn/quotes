const fs = require('fs').promises;
const read = require('fs-readdir-recursive');
const {promisify} = require('util');
const frontMatterParser = require('parser-front-matter');
const { pipeline } = require('@xenova/transformers');

const parse = promisify(frontMatterParser.parse.bind(frontMatterParser));

// Load all quotes from markdown files
async function loadPostsWithFrontMatter(postsDirectoryPath) {
  const postNames = read(postsDirectoryPath);
  const posts = await Promise.all(
    postNames.map(async fileName => {
      const fileContent = await fs.readFile(
        `${postsDirectoryPath}/${fileName}`,
        'utf8'
      );
      const {content, data} = await parse(fileContent);

      // Create a clean slug/URL from filename
      const slug = fileName.replace(/\.md$/, '').replace(/\\/g, '/');

      return {
        title: data.title || '',
        slug: slug,
        content: content.trim(),
        authors: data.authors || [],
        tags: data.tags || [],
        description: data.description || '',
        date: data.date || ''
      };
    })
  );
  return posts;
}

// Create text representation for embedding
function createEmbeddingText(post) {
  const parts = [];

  if (post.title) parts.push(post.title);
  if (post.content) parts.push(post.content);
  if (post.authors && post.authors.length > 0) {
    parts.push(`Authors: ${post.authors.join(', ')}`);
  }
  if (post.tags && post.tags.length > 0) {
    parts.push(`Tags: ${post.tags.join(', ')}`);
  }

  return parts.join('\n\n');
}

// Generate embeddings for all posts
async function generateEmbeddings(posts) {
  console.error('Loading embedding model (this may take a moment on first run)...');

  // Use the feature-extraction pipeline with all-MiniLM-L6-v2 model
  // This model produces 384-dimensional embeddings
  const extractor = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2'
  );

  console.error(`Generating embeddings for ${posts.length} quotes...`);

  const embeddings = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];

    // Create text to embed
    const textToEmbed = createEmbeddingText(post);

    // Generate embedding
    const output = await extractor(textToEmbed, { pooling: 'mean', normalize: true });

    // Convert to regular array
    const embedding = Array.from(output.data);

    // Create content preview (first 200 chars)
    const contentPreview = post.content.substring(0, 200);

    embeddings.push({
      title: post.title,
      slug: post.slug,
      authors: post.authors,
      tags: post.tags,
      description: post.description,
      contentPreview: contentPreview,
      date: post.date,
      embedding: embedding
    });

    // Progress indicator
    if ((i + 1) % 50 === 0) {
      console.error(`Processed ${i + 1}/${posts.length} quotes...`);
    }
  }

  console.error('Embedding generation complete!');

  return embeddings;
}

async function run() {
  try {
    const posts = await loadPostsWithFrontMatter(`${__dirname}/content`);
    console.error(`Loaded ${posts.length} posts`);

    const embeddings = await generateEmbeddings(posts);

    // Output to stdout (will be redirected to file)
    console.log(JSON.stringify({
      model: 'Xenova/all-MiniLM-L6-v2',
      dimensions: 384,
      count: embeddings.length,
      generatedAt: new Date().toISOString(),
      embeddings: embeddings
    }));

    console.error(`Generated ${embeddings.length} embeddings`);
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error.stack);
    process.exit(1);
  });
