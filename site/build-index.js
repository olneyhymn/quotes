const fs = require('fs').promises;
var read = require('fs-readdir-recursive')
const { promisify } = require('util');
const frontMatterParser = require('parser-front-matter');
// We'll use a simple-transformers library for our embedding needs
const natural = require('natural');
const { TfIdf } = natural;

const parse = promisify(frontMatterParser.parse.bind(frontMatterParser));

async function loadPostsWithFrontMatter(postsDirectoryPath) {
  const postNames = read(postsDirectoryPath);
  const posts = await Promise.all(
    postNames.map(async fileName => {
      const fileContent = await fs.readFile(
        `${postsDirectoryPath}/${fileName}`,
        'utf8'
      );
      const { content, data } = await parse(fileContent);
      return {
        content: content,
        ...data,
        authors: data.authors ? data.authors.join(' ') : '',
        tags: data.tags ? data.tags.join(' ') : ''
      };
    })
  );
  return posts;
}

const lunrjs = require('lunr');

function makeIndex(posts) {
  return lunrjs(function () {
    this.ref('title');
    this.field('title');
    this.field('content');
    this.field('authors');
    this.field('tags');
    this.field('description');
    posts.forEach(p => {
      this.add(p);
    });
  });
}

// Function to create TF-IDF embeddings for fuzzy topic searching
function createEmbeddings(posts) {
  const tfidf = new TfIdf();

  // Add documents to the corpus
  posts.forEach((post, index) => {
    const docText = `${post.title} ${post.content} ${post.authors} ${post.tags} ${post.description || ''}`;
    tfidf.addDocument(docText, post.title);
  });

  // Generate document vectors
  const documentVectors = {};
  tfidf.documents.forEach((doc, docIndex) => {
    const terms = Object.keys(doc);
    const vector = {};
    terms.forEach(term => {
      if (term !== '__key') {
        vector[term] = tfidf.tfidf(term, docIndex);
      }
    });
    documentVectors[tfidf.documents[docIndex].__key] = vector;
  });

  return documentVectors;
}

async function run() {
  const posts = await loadPostsWithFrontMatter(`${__dirname}/content`);

  // Create both traditional and embedding-based indices
  const lunrIndex = makeIndex(posts);
  const embeddings = createEmbeddings(posts);

  // Combine indices into one output
  const combinedIndex = {
    lunrIndex: lunrIndex,
    embeddings: embeddings,
    // Include a simple mapping of titles to full post data
    posts: posts.reduce((acc, post) => {
      acc[post.title] = post;
      return acc;
    }, {})
  };

  console.log(JSON.stringify(combinedIndex));
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error.stack);
    process.exit(1);
  });
