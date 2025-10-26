const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const themeBtn = document.getElementById('themeBtn');

const profileEl = document.getElementById('profile');
const repoListEl = document.getElementById('repoList');
const activityListEl = document.getElementById('activityList');
const contributionsEl = document.getElementById('contributions');
const historyListEl = document.getElementById('historyList');
const trendingListEl = document.getElementById('trendingList');
const pinnedListEl = document.getElementById('pinnedList');
const statsArea = document.getElementById('statsArea');
const summaryText = document.getElementById('summaryText');


const API = 'https://api.github.com/users/';
const MAX_HISTORY = 8;
const HISTORY_KEY = 'gh_finder_history_v1';
const THEME_KEY = 'gh_finder_theme_v1';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadHistory();
  fetchTrending();
});

searchBtn.addEventListener('click', () => doSearch(searchInput.value.trim()));
searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(searchInput.value.trim()); });
themeBtn.addEventListener('click', toggleTheme);
document.getElementById('clearHistory').addEventListener('click', clearHistory);

function initTheme() {
  const theme = localStorage.getItem(THEME_KEY) || 'light';
  if (theme === 'dark') document.body.classList.add('dark');
  updateThemeBtn();
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  localStorage.setItem(THEME_KEY, document.body.classList.contains('dark') ? 'dark' : 'light');
  updateThemeBtn();
}

function updateThemeBtn() {
  themeBtn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
}

function loadHistory() {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  renderHistory(history);
}

function saveHistory(username) {
  if (!username) return;
  let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  history = history.filter(h => h.toLowerCase() !== username.toLowerCase());
  history.unshift(username);
  history = history.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory(history);
}

function renderHistory(history) {
  if (!history || history.length === 0) {
    historyListEl.innerHTML = '<div class="muted">No recent searches</div>';
    return;
  }
  historyListEl.innerHTML = '';
  history.forEach(u => {
    const d = document.createElement('div');
    d.className = 'history-item';
    d.innerHTML = `<button class="small" onclick="doSearch('${u}')">${u}</button>
                   <button class="small" style="margin-left:8px" onclick="removeHistoryItem('${u}')">✖</button>`;
    historyListEl.appendChild(d);
  });
}

function removeHistoryItem(u) {
  let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  history = history.filter(h => h !== u);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory(history);
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  loadHistory();
}

/* -----------------------
   Main search flow
   ----------------------- */
async function doSearch(username) {
  if (!username) return alert('Enter a GitHub username');
  profileEl.innerHTML = 'Loading...';
  repoListEl.innerHTML = '';
  activityListEl.innerHTML = '';
  contributionsEl.innerHTML = '';
  pinnedListEl.innerHTML = '';
  statsArea.innerHTML = 'Loading stats...';
  summaryText.textContent = 'Generating summary...';
  saveHistory(username);

  try {
    const profileRes = await fetch(`${API}${encodeURIComponent(username)}`);
    if (!profileRes.ok) {
      profileEl.innerHTML = `<p>User not found</p>`;
      return;
    }
    const profile = await profileRes.json();
    renderProfile(profile);

    const reposRes = await fetch(`${API}${encodeURIComponent(username)}/repos?per_page=100`);
    const repos = await reposRes.json();
    renderRepos(repos);

    const pinned = (Array.isArray(repos) ? repos.slice().sort((a, b) => b.stargazers_count - a.stargazers_count) : []).slice(0, 3);
    renderPinned(pinned);

    const eventsRes = await fetch(`${API}${encodeURIComponent(username)}/events/public?per_page=5`);
    const events = await eventsRes.json();
    renderActivity(events);

    renderContributions(username);
    renderStatsCard(username);

    const summary = generateSummary(profile, repos, events);
    summaryText.textContent = summary;

  } catch (err) {
    console.error(err);
    profileEl.innerHTML = `<p>Error fetching data</p>`;
  }
}

function renderProfile(p) {
  profileEl.innerHTML = `
    <div style="text-align:center">
      <img class="avatar" src="${p.avatar_url}" alt="avatar"/>
      <h2>${p.name || p.login}</h2>
      <div class="muted">@${p.login} • Joined: ${new Date(p.created_at).toDateString()}</div>
      <p style="margin-top:8px">${p.bio || '<span class="muted">No bio</span>'}</p>
      <div class="profile-row">
        <div class="small">👥 Followers: ${p.followers}</div>
        <div class="small">➡️ Following: ${p.following}</div>
        <div class="small">📦 Repos: ${p.public_repos}</div>
      </div>
      <div style="margin-top:8px">
        ${p.company ? `<span class="muted">🏢 ${escapeHtml(p.company)}</span>` : ''}
        ${p.blog ? `<a class="muted" href="${p.blog.startsWith('http') ? p.blog : 'https://' + p.blog}" target="_blank" style="margin-left:8px">🔗 Website</a>` : ''}
      </div>
    </div>
  `;
}

function renderRepos(repos) {
  if (!Array.isArray(repos) || repos.length === 0) {
    repoListEl.innerHTML = '<div class="muted">No repositories</div>';
    return;
  }
  const top = repos.slice().sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 5);
  repoListEl.innerHTML = '';
  top.forEach(r => {
    const el = document.createElement('div');
    el.className = 'repo-item';
    el.innerHTML = `<a href="${r.html_url}" target="_blank">${r.name}</a>
      <div class="muted">${r.description ? escapeHtml(r.description) : ''}</div>
      <div class="muted">⭐ ${r.stargazers_count} • 🍴 ${r.forks_count} • ${r.language || '—'}</div>`;
    repoListEl.appendChild(el);
  });
}

function renderPinned(pinned) {
  if (!pinned || pinned.length === 0) {
    pinnedListEl.innerHTML = '<div class="muted">No pinned repos</div>';
    return;
  }
  pinnedListEl.innerHTML = '';
  pinned.forEach(r => {
    const el = document.createElement('div');
    el.className = 'pinned-item';
    el.innerHTML = `<a href="${r.html_url}" target="_blank">${r.name}</a>
      <div class="muted">${r.description ? escapeHtml(r.description) : ''}</div>
      <div class="muted">⭐ ${r.stargazers_count} • 🍴 ${r.forks_count}</div>`;
    pinnedListEl.appendChild(el);
  });
}

function renderActivity(events) {
  if (!Array.isArray(events) || events.length === 0) {
    activityListEl.innerHTML = '<div class="muted">No recent activity</div>';
    return;
  }
  activityListEl.innerHTML = '';
  events.slice(0, 5).forEach(ev => {
    const el = document.createElement('div');
    el.className = 'activity-item';
    el.innerHTML = `<strong>${ev.type}</strong> → <span class="muted">${ev.repo?.name || ''}</span>`;
    activityListEl.appendChild(el);
  });
}

function renderContributions(username) {
  contributionsEl.innerHTML = `<h3>📈 Contribution Graph</h3>
    <img src="https://ghchart.rshah.org/0073e6/${encodeURIComponent(username)}" alt="Contribution Graph">`;
}

async function renderStatsCard(username) {
  statsArea.innerHTML = `<p>Loading stats...</p>`;

  try {
    const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`);
    const userData = await userRes.json();

    if (userData.message === "Not Found") {
      statsArea.innerHTML = `<div class="muted">❌ User not found. Try another username.</div>`;
      return;
    }

    if (userData.type === "Organization") {
      statsArea.innerHTML = `
        <div class="error-msg" style="text-align:center; padding:10px;">
          <h4>📢 Organization Profile</h4>
          <p class="muted">GitHub stats are only available for individual developer accounts.</p>
        </div>`;
      return;
    }

    const img = document.createElement("img");
    img.src = `https://github-readme-stats.vercel.app/api?username=${encodeURIComponent(username)}&show_icons=true&theme=radical`;
    img.alt = "GitHub Stats";
    img.style = "width:100%;border-radius:8px;";
    img.onerror = () => {
      statsArea.innerHTML = `
        <div class="error-msg" style="text-align:center; padding:10px;">
          ⚠️ Stats currently unavailable. Please try again later.
        </div>`;
    };

    statsArea.innerHTML = "";
    statsArea.appendChild(img);

  } catch (error) {
    console.error("Stats error:", error);
    statsArea.innerHTML = `
      <div class="error-msg" style="text-align:center; padding:10px;">
        ⚠️ Unable to load stats. Please check your internet connection.
      </div>`;
  }
}

async function fetchTrending() {
  try {
    const res = await fetch('https://api.github.com/search/repositories?q=stars:%3E50000&sort=stars&per_page=6');
    const data = await res.json();
    const list = Array.isArray(data.items) ? data.items : [];
    trendingListEl.innerHTML = '';
    list.forEach(r => {
      const d = document.createElement('div');
      d.className = 'trend-item';
      d.innerHTML = `<a href="${r.html_url}" target="_blank">${r.full_name}</a>
                     <div class="muted">⭐ ${r.stargazers_count} • ${r.language || '—'}</div>`;
      trendingListEl.appendChild(d);
    });
  } catch (e) {
    trendingListEl.innerHTML = '<div class="muted">Could not load trending repos</div>';
  }
}

function generateSummary(profile, repos = [], events = []) {
  const name = profile.name || profile.login;
  const topLangs = topLanguages(repos, 3);
  const repoCount = profile.public_repos || 0;
  const followerCount = profile.followers || 0;
  const activityType = (events[0] && events[0].type) ? events[0].type.replace('Event', '') : null;

  let s = `${name} is a GitHub user with ${repoCount} public repo${repoCount === 1 ? '' : 's'} and ${followerCount} follower${followerCount === 1 ? '' : 's'}. `;
  if (topLangs.length > 0) s += `They commonly work with ${topLangs.join(', ')}. `;
  if (activityType) s += `Recent activity includes ${activityType.toLowerCase()} actions. `;
  const topRepo = repos.slice().sort((a, b) => b.stargazers_count - a.stargazers_count)[0];
  if (topRepo) s += `Top repository: ${topRepo.name} (${topRepo.stargazers_count} ⭐).`;
  return s;
}

function topLanguages(repos, n = 3) {
  const counts = {};
  (repos || []).forEach(r => { if (r.language) counts[r.language] = (counts[r.language] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]);
}

function escapeHtml(s) {
  if (!s) return s;
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

window.doSearch = doSearch;
