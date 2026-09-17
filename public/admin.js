const loginView = document.getElementById('adminLogin');
const dashboard = document.getElementById('adminDashboard');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
const articleForm = document.getElementById('articleForm');
const articleMessage = document.getElementById('articleMessage');
const subscriberRows = document.getElementById('subscriberRows');
const subscriberMessage = document.getElementById('subscriberMessage');
const adminArticleList = document.getElementById('adminArticleList');
const articleId = document.getElementById('articleId');
const articleFormHeading = document.getElementById('articleFormHeading');
const articleSubmitButton = document.getElementById('articleSubmitButton');
const cancelArticleEdit = document.getElementById('cancelArticleEdit');
let loadedArticles = [];
const apiOrigin =
  window.location.port === '5500' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? `${window.location.protocol}//${window.location.hostname}:4000`
    : '';

function showMessage(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle('error', isError);
  element.hidden = false;
}

async function api(path, options) {
  const response = await fetch(`${apiOrigin}/api${path}`, {
    credentials: 'include',
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function renderSubscribers(subscribers) {
  subscriberRows.innerHTML = subscribers.length
    ? subscribers.map((subscriber) => `<tr><td>${new Date(subscriber.created_at).toLocaleDateString()}</td><td>${subscriber.name}</td><td><a href="mailto:${subscriber.email}">${subscriber.email}</a></td><td>${subscriber.type}</td><td>${subscriber.plan_id}</td><td><span class="status status-${subscriber.status}">${subscriber.status}</span></td></tr>`).join('')
    : '<tr><td colspan="6">No subscribers yet.</td></tr>';
}

function renderArticles(articles) {
  loadedArticles = articles;
  adminArticleList.innerHTML = articles.length
    ? articles.map((article) => `<div class="admin-article-row"><div><strong>${article.title}</strong><span>${new Date(article.created_at).toLocaleDateString()}</span></div><div class="article-row-actions"><button type="button" class="btn-outline article-edit" data-id="${article.id}">Edit</button><button type="button" class="btn-danger article-delete" data-id="${article.id}">Delete</button></div></div>`).join('')
    : '<p>No articles published yet.</p>';

  adminArticleList.querySelectorAll('.article-edit').forEach((button) => {
    button.addEventListener('click', () => beginArticleEdit(button.dataset.id));
  });
  adminArticleList.querySelectorAll('.article-delete').forEach((button) => {
    button.addEventListener('click', () => deleteArticle(button.dataset.id));
  });
}

function resetArticleForm() {
  articleForm.reset();
  articleId.value = '';
  articleFormHeading.textContent = 'Publish an article';
  articleSubmitButton.textContent = 'Upload and publish';
  cancelArticleEdit.hidden = true;
}

function beginArticleEdit(id) {
  const article = loadedArticles.find((item) => item.id === id);
  if (!article) return;
  articleId.value = article.id;
  document.getElementById('articleTitle').value = article.title;
  document.getElementById('articlePdf').value = '';
  articleFormHeading.textContent = 'Edit article';
  articleSubmitButton.textContent = 'Save changes';
  cancelArticleEdit.hidden = false;
  document.getElementById('articleTitle').focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteArticle(id) {
  const article = loadedArticles.find((item) => item.id === id);
  if (!article || !window.confirm(`Delete "${article.title}"? This also removes its stored PDF.`)) return;
  try {
    await api(`/admin/articles/${id}`, { method: 'DELETE' });
    if (articleId.value === id) resetArticleForm();
    await loadDashboard();
  } catch (error) {
    showMessage(articleMessage, error.message, true);
  }
}

async function loadDashboard() {
  const results = await Promise.allSettled([api('/admin/subscribers'), api('/admin/articles')]);
  const subscriberResult = results[0];
  const articleResult = results[1];

  if (subscriberResult.status === 'fulfilled') {
    renderSubscribers(subscriberResult.value);
    subscriberMessage.hidden = true;
  } else {
    showMessage(subscriberMessage, subscriberResult.reason.message, true);
  }

  if (articleResult.status === 'fulfilled') {
    renderArticles(articleResult.value);
  } else {
    renderArticles([]);
    showMessage(articleMessage, 'Articles are not available yet. Run the articles table setup in Supabase.', true);
  }
}

async function showDashboard() {
  loginView.hidden = true;
  dashboard.hidden = false;
  await loadDashboard();
}

function showLogin() {
  dashboard.hidden = true;
  loginView.hidden = false;
  loginForm.reset();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginMessage.hidden = true;
  try {
    await api('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: document.getElementById('adminPassword').value,
      }),
    });
    await showDashboard();
  } catch (error) {
    showMessage(loginMessage, error.message, true);
  }
});

articleForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  articleMessage.hidden = true;
  const formData = new FormData(articleForm);
  try {
    const id = articleId.value;
    if (!id && !document.getElementById('articlePdf').files.length) {
      throw new Error('Please choose a PDF file.');
    }
    await api(id ? `/admin/articles/${id}` : '/admin/articles', {
      method: id ? 'PATCH' : 'POST',
      body: formData,
    });
    resetArticleForm();
    showMessage(
      articleMessage,
      id ? 'Article updated successfully.' : 'Article published successfully.'
    );
    await loadDashboard();
  } catch (error) {
    showMessage(articleMessage, error.message, true);
  }
});

document
  .getElementById('refreshSubscribers')
  .addEventListener('click', loadDashboard);
cancelArticleEdit.addEventListener('click', resetArticleForm);
document.getElementById('logoutButton').addEventListener('click', async () => {
  await api('/admin/logout', { method: 'POST' });
  showLogin();
});

api('/admin/session')
  .then(showDashboard)
  .catch(() => {});

window.addEventListener('pagehide', () => {
  fetch(`${apiOrigin}/api/admin/logout`, {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
  }).catch(() => {});
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});
