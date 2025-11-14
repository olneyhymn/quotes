/**
 * Search UI Handler
 * Manages the search interface and result display
 */

class SearchUI {
  constructor(semanticSearch, postsBySlug) {
    this.semanticSearch = semanticSearch;
    this.postsBySlug = postsBySlug;
    this.$target = document.querySelector('#app');
    this.$statusContainer = document.querySelector('.search-status');
    this.$statusText = document.querySelector('#status-text');
    this.$spinner = document.querySelector('#spinner');
  }

  /**
   * Update status message with optional spinner
   */
  setStatus(message, showSpinner = false) {
    if (this.$statusText) {
      this.$statusText.textContent = message;
    }
    if (this.$spinner) {
      this.$spinner.style.display = showSpinner ? 'inline-block' : 'none';
    }
  }

  /**
   * Hide status container
   */
  hideStatus() {
    if (this.$statusContainer) {
      this.$statusContainer.style.display = 'none';
    }
  }

  /**
   * Show status container
   */
  showStatus() {
    if (this.$statusContainer) {
      this.$statusContainer.style.display = 'block';
    }
  }

  /**
   * Display error message
   */
  showError(message, error) {
    console.error('Search error:', error);
    this.setStatus('Unable to perform search', false);

    if (this.$target) {
      this.$target.innerHTML = `
        <div class="search-error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3>Something went wrong</h3>
          <p>${this.escapeHtml(message)}</p>
          <p class="error-hint">Please try again or check your connection.</p>
        </div>
      `;
    }
  }

  /**
   * Display no results message
   */
  showNoResults(query) {
    this.hideStatus();
    if (this.$target) {
      this.$target.innerHTML = `
        <div class="search-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <h3>No quotes found</h3>
          <p>Try different words or browse <a href="/q/">all quotes</a></p>
        </div>
      `;
    }
  }

  /**
   * Display empty query message
   */
  showEmptyQuery() {
    this.hideStatus();
    if (this.$target) {
      this.$target.innerHTML = `
        <div class="search-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <h3>Start searching</h3>
          <p>Enter a word or phrase to find related quotes</p>
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
   * Format author names
   */
  formatAuthors(authors) {
    if (!authors || authors.length === 0) return '';
    const authorList = Array.isArray(authors) ? authors.join(', ') : String(authors);
    return authorList;
  }

  /**
   * Truncate text with ellipsis
   */
  truncate(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  /**
   * Format a search result item
   */
  formatResult(result, index) {
    // Try to find full content from posts
    const fullPost = this.postsBySlug[result.slug];
    const content = fullPost ? fullPost.content : result.contentPreview;
    const authors = this.formatAuthors(result.authors);
    const link = `/${result.slug}/`;

    // Add animation delay based on index for staggered appearance
    const animationDelay = index * 40; // 40ms between each result

    return `
      <article class="search-result" style="animation-delay: ${animationDelay}ms;">
        <h2 class="result-title">
          <a href="${link}">${this.escapeHtml(result.title)}</a>
        </h2>
        <blockquote class="result-quote">
          ${content}
        </blockquote>
        <div class="result-meta">
          ${authors ? `<span class="result-author"><a href="${link}">${this.escapeHtml(authors)}</a></span>` : ''}
          ${result.tags && result.tags.length > 0 ? `
            <div class="result-tags">
              ${result.tags.slice(0, 3).map(tag =>
                `<span class="tag">${this.escapeHtml(tag)}</span>`
              ).join('')}
            </div>
          ` : ''}
        </div>
      </article>
    `;
  }

  /**
   * Display search results
   */
  showResults(results) {
    if (!this.$target) return;

    this.hideStatus();

    const resultsHtml = `
      <div class="results-header">
        <div class="results-count">${results.length} ${results.length === 1 ? 'quote' : 'quotes'} found</div>
      </div>
      <div class="search-results">
        ${results.map((result, index) => this.formatResult(result, index)).join('')}
      </div>
    `;

    this.$target.innerHTML = resultsHtml;
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
      // Initialize search with loading animation
      this.showStatus();
      this.setStatus('Loading search...', true);
      await this.semanticSearch.initialize();

      this.setStatus('Searching quotes...', true);

      // Perform search
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
