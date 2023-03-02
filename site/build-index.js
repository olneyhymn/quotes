const fs = require('fs').promises;
var read = require('fs-readdir-recursive')
const {promisify} = require('util');
const frontMatterParser = require('parser-front-matter');

const parse = promisify(frontMatterParser.parse.bind(frontMatterParser));

async function loadPostsWithFrontMatter(postsDirectoryPath) {
  const postNames = read(postsDirectoryPath);
  const posts = await Promise.all(
    postNames.map(async fileName => {
      const fileContent = await fs.readFile(
        `${postsDirectoryPath}/${fileName}`,
        'utf8'
      );
      const {content, data} = await parse(fileContent);
      return {
        content: content.slice(0, 3000),
        ...data
      };
    })
  );
  return posts;
}

const lunrjs = require('lunr');

function makeIndex(posts) {
  return lunrjs(function() {
    this.ref('title');
    this.field('title');
    this.field('content');
    this.field('sources');
    this.field('years');
    this.field('publishers');
    this.field('editors');
    posts.forEach(p => {
      this.add(p);
    });
  });
}

async function run() {
  const posts = await loadPostsWithFrontMatter(`${__dirname}/content`);
  const index = makeIndex(posts);
  console.log(JSON.stringify(index));
}

run()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error.stack);
    process.exit(1);
  });
