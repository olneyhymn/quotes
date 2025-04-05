const fs = require('fs').promises;
var read = require('fs-readdir-recursive')
const { promisify } = require('util');
const frontMatterParser = require('parser-front-matter');
// We'll use the natural library for our embedding needs
const natural = require('natural');
const { TfIdf } = natural;

const parse = promisify(frontMatterParser.parse.bind(frontMatterParser));

async function loadPostsWithFrontMatter(postsDirectoryPath) {
  try {
    const postNames = read(postsDirectoryPath);
    console.log(`Found ${postNames.length} post files to process`);

    const posts = await Promise.all(
      postNames.map(async fileName => {
        try {
          const fileContent = await fs.readFile(
            `${postsDirectoryPath}/${fileName}`,
            'utf8'
          );
          const { content, data } = await parse(fileContent);
          return {
            content: content,
            ...data,
            fileName: fileName,
            url: fileName.replace(/\.md$/, ''),
            authors: data.authors ? data.authors.join(' ') : '',
            tags: data.tags ? data.tags.join(' ') : ''
          };
        } catch (err) {
          console.error(`Error processing file ${fileName}:`, err);
          return null;
        }
      })
    );

    // Filter out any null entries from errors
    return posts.filter(post => post !== null);
  } catch (err) {
    console.error("Error loading posts:", err);
    return [];
  }
}

const lunrjs = require('lunr');

function makeIndex(posts) {
  try {
    console.log(`Creating lunr index with ${posts.length} posts`);
    return lunrjs(function () {
      this.ref('title');
      this.field('title', { boost: 10 });
      this.field('content');
      this.field('authors');
      this.field('tags', { boost: 5 });
      this.field('description');

      posts.forEach(p => {
        try {
          if (p && p.title) {
            this.add(p);
          }
        } catch (err) {
          console.error(`Error adding post to index: ${err.message}`);
        }
      });
    });
  } catch (err) {
    console.error("Error creating lunr index:", err);
    return null;
  }
}

// Function to create TF-IDF embeddings for fuzzy topic searching
function createEmbeddings(posts) {
  try {
    console.log("Creating TF-IDF embeddings");
    const tfidf = new TfIdf();

    // Add documents to the corpus
    posts.forEach((post, index) => {
      if (!post || !post.title) return;

      try {
        const docText = `${post.title} ${post.content} ${post.authors} ${post.tags} ${post.description || ''}`;
        tfidf.addDocument(docText, post.title);
      } catch (err) {
        console.error(`Error adding document to TF-IDF: ${err.message}`);
      }
    });

    // Generate document vectors
    const documentVectors = {};
    tfidf.documents.forEach((doc, docIndex) => {
      try {
        if (!doc || !doc.__key) return;

        const terms = Object.keys(doc);
        const vector = {};
        terms.forEach(term => {
          if (term !== '__key') {
            vector[term] = tfidf.tfidf(term, docIndex);
          }
        });
        documentVectors[tfidf.documents[docIndex].__key] = vector;
      } catch (err) {
        console.error(`Error generating vector for document: ${err.message}`);
      }
    });

    return documentVectors;
  } catch (err) {
    console.error("Error creating embeddings:", err);
    return {};
  }
}

async function run() {
  try {
    console.log("Starting search index build process");

    // Load posts
    const posts = await loadPostsWithFrontMatter(`${__dirname}/content`);
    if (!posts || posts.length === 0) {
      throw new Error("No posts loaded");
    }

    console.log(`Loaded ${posts.length} posts`);

    // Create both traditional and embedding-based indices
    const lunrIndex = makeIndex(posts);
    const embeddings = createEmbeddings(posts);

    // Format post data for client-side consumption
    const postData = {};
    posts.forEach(post => {
      if (post && post.title) {
        // Include only necessary fields to reduce index size
        postData[post.title] = {
          title: post.title,
          content: post.content,
          authors: post.authors,
          url: post.url || `/${post.fileName.replace(/\.md$/, '')}/`
        };
      }
    });

    // Combine indices into one output
    const combinedIndex = {
      lunrIndex: lunrIndex,
      embeddings: embeddings,
      posts: postData
    };

    console.log("Index build complete");
    console.log(`  - ${Object.keys(postData).length} posts indexed`);
    console.log(`  - ${Object.keys(embeddings).length} document vectors created`);

    // Output the index
    console.log(JSON.stringify(combinedIndex));
  } catch (error) {
    console.error("Error building search index:", error);

    // Output a minimal working index even on error
    console.log(JSON.stringify({
      lunrIndex: null,
      embeddings: {},
      posts: {}
    }));

    process.exit(1);
  }
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error.stack);
    process.exit(1);
  });
