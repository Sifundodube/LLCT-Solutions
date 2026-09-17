const articleList = document.getElementById('articleList');
const isArticleLocalStaticPreview =
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  window.location.port !== '4000';
const ARTICLES_API_BASE = isArticleLocalStaticPreview ? 'http://localhost:4000/api' : '/api';

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character]));
}

async function loadArticles() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${ARTICLES_API_BASE}/articles`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Could not load articles.');
    const articles = await response.json();
    articleList.innerHTML = articles.length
      ? articles.map((article) => `<article class="published-article"><div><span class="resource-label">${new Date(article.created_at).toLocaleDateString()}</span><h4>${escapeHtml(article.title)}</h4><p>${escapeHtml(article.summary)}</p></div><button type="button" class="service-link article-read-button" data-article-id="${article.id}">Read article <i class="fas fa-arrow-right"></i></button><div class="article-content" hidden>${escapeHtml(article.content).replace(/\n/g, '<br />')}</div></article>`).join('')
      : '<p class="plans-loading">New articles will appear here soon.</p>';

    articleList.querySelectorAll('.article-read-button').forEach((button) => {
      button.addEventListener('click', () => {
        const article = button.closest('.published-article');
        const content = article.querySelector('.article-content');
        const expanded = !content.hidden;
        content.hidden = expanded;
        button.innerHTML = expanded ? 'Read article <i class="fas fa-arrow-right"></i>' : 'Hide article <i class="fas fa-arrow-up"></i>';
      });
    });
  } catch (error) {
    articleList.innerHTML = '<p class="plans-loading">Articles could not be loaded. Please refresh and try again.</p>';
    console.error('[articles] could not load articles:', error);
  } finally {
    window.clearTimeout(timeout);
  }
}

if (articleList) loadArticles();