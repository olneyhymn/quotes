/**
 * Search UI Handler
 * Manages the search interface and result display
 */

class SearchUI {
  constructor(semanticSearch, postsBySlug) {
    this.semanticSearch = semanticSearch;
    this.postsBySlug = postsBySlug;
    this.$target = document.querySelector('#app');
    this.$statusText = document.querySelector('#status-text');
  }

  /**
   * Update status message
   */
  setStatus(message) {
    if (this.$statusText) {
      this.$statusText.textContent = message;
    }
  }

  /**
   * Display error message
   */
  showError(message, error) {
    console.error('Search error:', error);
    this.setStatus('Error performing search');

    if (this.$target) {
      this.$target.innerHTML = `
        <div style="color: red; padding: 20px; background: #fee; border-radius: 5px;">
          <strong>Error:</strong> ${this.escapeHtml(message)}
          <br><br>
          ${error ? `<small>${this.escapeHtml(error.message)}</small>` : ''}
          <br><br>
          <small>Check the console for more details.</small>
        </div>
      `;
    }
  }

  /**
   * Display no results message
   */
  showNoResults(query) {
    this.setStatus('Search complete');
    if (this.$target) {
      this.$target.innerHTML = `
        <div style="padding: 20px;">
          No search results found for "${this.escapeHtml(query)}"
        </div>
      `;
    }
  }

  /**
   * Display empty query message
   */
  showEmptyQuery() {
    this.setStatus('Enter a search query to begin');
    if (this.$target) {
      this.$target.innerHTML = `
        <div style="padding: 20px;">
          Please enter a search query in the search box above.
        </div>
      `;
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format a search result item
   */
  formatResult(result) {
    // Try to find full content from posts
    const fullPost = this.postsBySlug[result.slug];
    const content = fullPost ? fullPost.content : result.contentPreview;
    const authors = Array.isArray(result.authors)
      ? result.authors.join(', ')
      : result.authors || '';
    const link = `/${result.slug}/`;

    // Format similarity score as percentage
    const similarityPercent = (result.score * 100).toFixed(1);

    return `
      <div style="margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee;">
        <h2 class="item-title">
          <a href="${link}">${this.escapeHtml(result.title)}</a>
          <span style="font-size: 0.6em; color: #666; font-weight: normal; margin-left: 10px;">
            (${similarityPercent}% match)
          </span>
        </h2>
        <blockquote>
          ${content}
          ${authors ? `<span class="author"><i><a href="${link}">${this.escapeHtml(authors)}</a></i></span>` : ''}
        </blockquote>
      </div>
    `;
  }

  /**
   * Display search results
   */
  showResults(results) {
    if (!this.$target) return;

    this.setStatus(`Found ${results.length} semantically similar quotes`);
    this.$target.innerHTML = results.map(result => this.formatResult(result)).join('');
  }

  /**
   * Perform search and display results
   */
  async performSearch(query) {
    if (!query || query.trim().length === 0) {
      this.showEmptyQuery();
      return;
    }

    try {
      // Initialize semantic search
      this.setStatus('Loading semantic search model (this may take a moment on first load)...');
      await this.semanticSearch.initialize();
      this.setStatus('Search ready! Performing search...');

      // Perform semantic search
      const results = await this.semanticSearch.search(query, 20);

      // Display results
      if (results.length > 0) {
        this.showResults(results);
      } else {
        this.showNoResults(query);
      }

    } catch (error) {
      this.showError('An error occurred while searching.', error);
    }
  }
}

// Export for use in search page
if (typeof window !== 'undefined') {
  window.SearchUI = SearchUI;
}
