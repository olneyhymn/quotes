(function () {
  function displaySearchResults(results, store) {
    var searchResults = document.getElementById('search-results');

    if (results.length) { // Are there any results?
      var appendString = '';

      for (var i = 0; i < results.length; i++) {  // Iterate over the results
        var item = store[results[i].ref];
        appendString += '<li><a href="' + item.url + '"><h3>' + item.title + '</h3></a>';
        appendString += '<p>' + item.content.substring(0, 150) + '...</p></li>';
      }

      searchResults.innerHTML = appendString;
    } else {
      searchResults.innerHTML = '<li>No results found</li>';
    }
  }

  function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');

    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split('=');

      if (pair[0] === variable) {
        return decodeURIComponent(pair[1].replace(/\+/g, '%20'));
      }
    }
  }

  // Calculate cosine similarity between two vectors
  function cosineSimilarity(vec1, vec2) {
    const common_terms = Object.keys(vec1).filter(term => term in vec2);

    // If no common terms, return 0
    if (common_terms.length === 0) return 0;

    let dot_product = 0;
    for (const term of common_terms) {
      dot_product += vec1[term] * vec2[term];
    }

    // Calculate magnitudes
    let mag1 = 0;
    let mag2 = 0;

    for (const val of Object.values(vec1)) {
      mag1 += val * val;
    }

    for (const val of Object.values(vec2)) {
      mag2 += val * val;
    }

    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);

    // Prevent division by zero
    if (mag1 === 0 || mag2 === 0) return 0;

    return dot_product / (mag1 * mag2);
  }

  // Create TF-IDF vector for search query
  function createQueryVector(query, corpus) {
    // Simple tokenization with stopwords removal
    const stopwords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by'];
    const terms = query.toLowerCase().split(/\W+/).filter(term =>
      term.length > 1 && !stopwords.includes(term)
    );

    // Create a vector based on term frequency
    const vector = {};
    terms.forEach(term => {
      if (!vector[term]) vector[term] = 0;
      vector[term] += 1;
    });

    return vector;
  }

  // Perform semantic search using embeddings
  function semanticSearch(query, embeddings) {
    const queryVector = createQueryVector(query);
    const results = [];

    // Calculate similarity between query and each document
    for (const [docId, docVector] of Object.entries(embeddings)) {
      const similarity = cosineSimilarity(queryVector, docVector);
      if (similarity > 0) { // Only include results with some relevance
        results.push({
          ref: docId,
          score: similarity
        });
      }
    }

    // Sort by similarity score (descending)
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  var searchTerm = getQueryVariable('query');

  if (searchTerm) {
    document.getElementById('search-box').setAttribute("value", searchTerm);

    // Fetch search index JSON which now includes both lunr index and embeddings
    fetch('/search_index.json').then(response => response.json())
      .then(data => {
        // Load lunr index
        var lunrIndex = lunr.Index.load(data.lunrIndex);

        // Perform traditional search
        var lunrResults = lunrIndex.search(searchTerm);

        // Perform semantic search if no or few results
        if (lunrResults.length < 3) {
          const semanticResults = semanticSearch(searchTerm, data.embeddings);

          // Merge results, ensuring no duplicates
          const existingRefs = new Set(lunrResults.map(r => r.ref));
          semanticResults.forEach(result => {
            if (!existingRefs.has(result.ref)) {
              lunrResults.push(result);
            }
          });

          // Re-sort by score
          lunrResults.sort((a, b) => b.score - a.score);
        }

        // Use the store from combined index
        displaySearchResults(lunrResults, data.posts);
      });
  }
})();
