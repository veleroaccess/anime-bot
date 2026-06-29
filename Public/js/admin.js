// public/js/admin.js
// Admin Dashboard Main Logic

const API_BASE = '/.netlify/functions/admin-api';
let AUTH_TOKEN = localStorage.getItem('admin_token') || '';
let currentPage = 'dashboard';
let charts = {};

// ============================================
// AUTH
// ============================================
function login() {
  const pw = document.getElementById('loginPassword').value;
  AUTH_TOKEN = pw;
  localStorage.setItem('admin_token', pw);
  
  // Test auth
  api('/stats').then(data => {
    if (data && !data.error) {
      document.getElementById('loginModal').classList.remove('open');
      showPage('dashboard');
    } else {
      toast('كلمة المرور غير صحيحة ❌', 'error');
      localStorage.removeItem('admin_token');
    }
  }).catch(() => {
    toast('خطأ في الاتصال بالسيرفر', 'error');
  });
}

// ============================================
// API
// ============================================
async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`
    }
  };
  if (body) opts.body = JSON.stringify(body);
  
  try {
    const res = await fetch(`${API_BASE}${path}`, opts);
    return res.json();
  } catch (err) {
    console.error('API error:', err);
    return { error: err.message };
  }
}

// ============================================
// TOAST
// ============================================
function toast(msg, type = 'success') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icons[type]} ${msg}`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ============================================
// SIDEBAR
// ============================================
function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('mobileOverlay');
  s.classList.toggle('open');
  o.style.display = s.classList.contains('open') ? 'block' : 'none';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('mobileOverlay').style.display = 'none';
}

// ============================================
// NAVIGATION
// ============================================
function showPage(page) {
  currentPage = page;
  closeSidebar();
  
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const pages = {
    dashboard: { title: '📊 الإحصائيات', fn: loadDashboard },
    categories: { title: '📂 التصنيفات', fn: loadCategories },
    content: { title: '🎬 الأفلام والمسلسلات', fn: loadContent },
    episodes: { title: '📺 الحلقات', fn: loadEpisodes },
    links: { title: '🔗 روابط التحميل', fn: loadLinks },
    users: { title: '👥 المستخدمين', fn: loadUsers },
    broadcast: { title: '📢 رسائل جماعية', fn: loadBroadcast },
    shortener: { title: '✂️ اختصار الروابط', fn: loadShortener },
    settings: { title: '⚙️ الإعدادات', fn: loadSettings }
  };
  
  const p = pages[page];
  if (!p) return;
  
  document.getElementById('pageTitle').textContent = p.title;
  document.getElementById('pageContent').innerHTML = '<div class="loading"><div class="spinner"></div> جاري التحميل...</div>';
  
  // Mark active nav
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.getAttribute('onclick')?.includes(page)) el.classList.add('active');
  });
  
  p.fn();
}

function refreshPage() { showPage(currentPage); }

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
  const data = await api('/stats');
  if (!data || data.error) {
    document.getElementById('pageContent').innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><h3>خطأ في تحميل الإحصائيات</h3><p>${data?.error || 'تأكد من اتصالك'}</p></div>`;
    return;
  }
  
  const { overview: o, daily_stats, quality_distribution, top_content } = data;
  
  document.getElementById('pageContent').innerHTML = `
  <!-- Stats Grid -->
  <div class="stats-grid">
    ${statCard('👥', o.total_users, 'إجمالي المستخدمين', '#6c63ff')}
    ${statCard('📥', o.total_downloads, 'إجمالي التحميلات', '#00d4ff')}
    ${statCard('👁️', o.total_views, 'إجمالي المشاهدات', '#ffd93d')}
    ${statCard('🎬', o.total_movies, 'الأفلام', '#ff6b6b')}
    ${statCard('📺', o.total_series, 'المسلسلات', '#6bcb77')}
    ${statCard('🎞️', o.total_episodes, 'الحلقات', '#a78bfa')}
    ${statCard('🔗', o.total_links, 'روابط التحميل', '#f59e0b')}
    ${statCard('📂', o.total_categories, 'التصنيفات', '#ec4899')}
  </div>
  
  <!-- Charts Row -->
  <div class="grid-2" style="margin-bottom:20px;">
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">📈 المستخدمين الجدد (30 يوم)</h3>
      </div>
      <div class="chart-container"><canvas id="usersChart"></canvas></div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">📥 التحميلات (30 يوم)</h3>
      </div>
      <div class="chart-container"><canvas id="downloadsChart"></canvas></div>
    </div>
  </div>
  
  <!-- Bottom Row -->
  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">🏆 أكثر المحتوى مشاهدة</h3>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>العنوان</th><th>النوع</th><th>المشاهدات</th></tr></thead>
          <tbody>
            ${(top_content || []).map((c, i) => `
              <tr>
                <td><strong>${i + 1}</strong></td>
                <td>${c.title}</td>
                <td><span class="badge badge-${c.type}">${c.type === 'movie' ? '🎬 فيلم' : '📺 مسلسل'}</span></td>
                <td>👁️ ${c.views?.toLocaleString()}</td>
              </tr>
            `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">لا توجد بيانات</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">🎯 توزيع الجودات</h3>
      </div>
      <div class="chart-container"><canvas id="qualityChart"></canvas></div>
    </div>
  </div>
  `;
  
  // Charts
  const days = daily_stats?.slice().reverse() || [];
  const labels = days.map(d => d.date?.slice(5) || '');
  
  renderChart('usersChart', 'line', labels, [{
    label: 'مستخدمين جدد',
    data: days.map(d => d.new_users || 0),
    borderColor: '#6c63ff',
    backgroundColor: 'rgba(108,99,255,0.1)',
    fill: true, tension: 0.4
  }]);
  
  renderChart('downloadsChart', 'bar', labels, [{
    label: 'التحميلات',
    data: days.map(d => d.total_downloads || 0),
    backgroundColor: 'rgba(0,212,255,0.6)',
    borderColor: '#00d4ff',
    borderRadius: 4
  }]);
  
  const qDist = quality_distribution || {};
  renderChart('qualityChart', 'doughnut', Object.keys(qDist), [{
    data: Object.values(qDist),
    backgroundColor: ['#ffd93d', '#6c63ff', '#6bcb77', '#94a3b8', '#ff6b6b'],
    borderWidth: 2,
    borderColor: '#1a2236'
  }]);
  
  // Bot status
  checkBotStatus();
}

function statCard(icon, value, label, color) {
  return `
  <div class="stat-card" style="--stat-color:${color}">
    <div class="stat-icon">${icon}</div>
    <div class="stat-value">${(value || 0).toLocaleString()}</div>
    <div class="stat-label">${label}</div>
  </div>`;
}

function renderChart(id, type, labels, datasets) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  
  if (charts[id]) charts[id].destroy();
  
  charts[id] = new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Cairo' } } }
      },
      scales: type !== 'doughnut' && type !== 'pie' ? {
        x: { ticks: { color: '#64748b' }, grid: { color: '#1e2d45' } },
        y: { ticks: { color: '#64748b' }, grid: { color: '#1e2d45' } }
      } : {}
    }
  });
}

async function checkBotStatus() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${await getBotToken()}/getMe`);
    const data = await res.json();
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    if (data.ok) {
      dot.style.background = '#6bcb77';
      text.textContent = `@${data.result.username} ✅`;
    }
  } catch {}
}

async function getBotToken() {
  // Token from env - this just returns placeholder, actual is in Netlify env
  return '8653592455:AAGDWtqS5-U8hu0RixYEUCMqwSfwEU2Ibfo';
}

// ============================================
// CATEGORIES
// ============================================
async function loadCategories() {
  const cats = await api('/categories');
  
  document.getElementById('pageContent').innerHTML = `
  <div class="card">
    <div class="card-header">
      <h3 class="card-title">📂 التصنيفات</h3>
      <button class="btn btn-primary btn-sm" onclick="openCategoryModal()">+ إضافة تصنيف</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>الإيموجي</th><th>الاسم</th><th>الوصف</th><th>الترتيب</th><th>الحالة</th><th>الإجراءات</th></tr>
        </thead>
        <tbody>
          ${(cats || []).map(c => `
            <tr>
              <td style="font-size:24px">${c.emoji || '📁'}</td>
              <td><strong>${c.name}</strong></td>
              <td style="color:var(--text-secondary)">${c.description || '-'}</td>
              <td>${c.sort_order}</td>
              <td><span class="badge badge-${c.is_active ? 'active' : 'inactive'}">${c.is_active ? '✅ نشط' : '❌ مخفي'}</span></td>
              <td>
                <button class="btn btn-secondary btn-sm" onclick="openCategoryModal(${JSON.stringify(c).replace(/"/g, '&quot;')})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteItem('categories', ${c.id}, 'التصنيف')">🗑️</button>
              </td>
            </tr>
          `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px">لا توجد تصنيفات</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function openCategoryModal(cat = null) {
  const isEdit = !!cat;
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">${isEdit ? '✏️ تعديل تصنيف' : '➕ إضافة تصنيف'}</h2>
      <button class="btn btn-secondary btn-icon" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label>الإيموجي</label>
          <input id="f_emoji" value="${cat?.emoji || '🎬'}" placeholder="🎬">
        </div>
        <div class="form-group">
          <label>الترتيب</label>
          <input id="f_order" type="number" value="${cat?.sort_order || 0}">
        </div>
      </div>
      <div class="form-group">
        <label>اسم التصنيف *</label>
        <input id="f_name" value="${cat?.name || ''}" placeholder="مثال: أفلام مدبلجة">
      </div>
      <div class="form-group">
        <label>الوصف</label>
        <input id="f_desc" value="${cat?.description || ''}" placeholder="وصف مختصر للتصنيف">
      </div>
      <div class="form-group">
        <label>الحالة</label>
        <select id="f_active">
          <option value="true" ${cat?.is_active !== false ? 'selected' : ''}>✅ نشط</option>
          <option value="false" ${cat?.is_active === false ? 'selected' : ''}>❌ مخفي</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveCategory(${cat?.id || 'null'})">💾 حفظ</button>
    </div>
  `);
}

async function saveCategory(id) {
  const body = {
    name: document.getElementById('f_name').value,
    emoji: document.getElementById('f_emoji').value,
    description: document.getElementById('f_desc').value,
    sort_order: parseInt(document.getElementById('f_order').value) || 0,
    is_active: document.getElementById('f_active').value === 'true'
  };
  
  if (!body.name) { toast('اسم التصنيف مطلوب', 'error'); return; }
  
  const method = id ? 'PUT' : 'POST';
  const path = id ? `/categories/${id}` : '/categories';
  const res = await api(path, method, body);
  
  if (res && !res.error) {
    toast(id ? 'تم تعديل التصنيف ✅' : 'تم إضافة التصنيف ✅');
    closeModal();
    loadCategories();
  } else {
    toast('حدث خطأ: ' + (res?.error || 'غير معروف'), 'error');
  }
}

// ============================================
// CONTENT
// ============================================
async function loadContent() {
  const [items, cats] = await Promise.all([api('/content'), api('/categories')]);
  
  document.getElementById('pageContent').innerHTML = `
  <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
    <button class="btn btn-primary" onclick="openContentModal(null, ${JSON.stringify(cats || []).replace(/"/g, '&quot;')})">+ إضافة فيلم/مسلسل</button>
    <select id="filterType" class="btn btn-secondary" onchange="filterContent()" style="padding:8px 12px;">
      <option value="">كل الأنواع</option>
      <option value="movie">🎬 أفلام</option>
      <option value="series">📺 مسلسلات</option>
    </select>
    <select id="filterCat" class="btn btn-secondary" onchange="filterContent()" style="padding:8px 12px;">
      <option value="">كل التصنيفات</option>
      ${(cats || []).map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('')}
    </select>
  </div>
  
  <div class="card">
    <div class="card-header">
      <h3 class="card-title">🎬 الأفلام والمسلسلات</h3>
      <span style="color:var(--text-muted);font-size:13px">${(items || []).length} عنصر</span>
    </div>
    <div class="table-wrap" id="contentTable">
      ${renderContentTable(items, cats)}
    </div>
  </div>`;
  
  window._contentItems = items;
  window._contentCats = cats;
}

function renderContentTable(items, cats) {
  return `<table>
    <thead><tr><th>#</th><th>العنوان</th><th>النوع</th><th>التصنيف</th><th>المشاهدات</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
    <tbody>
      ${(items || []).map(c => `
        <tr>
          <td style="color:var(--text-muted)">${c.id}</td>
          <td>
            <div style="font-weight:600">${c.title}</div>
            ${c.title_ar ? `<div style="font-size:12px;color:var(--text-secondary)">${c.title_ar}</div>` : ''}
          </td>
          <td><span class="badge badge-${c.type}">${c.type === 'movie' ? '🎬 فيلم' : '📺 مسلسل'}</span></td>
          <td>${c.categories ? c.categories.emoji + ' ' + c.categories.name : '-'}</td>
          <td>👁️ ${(c.views || 0).toLocaleString()}</td>
          <td><span class="badge badge-${c.is_active ? 'active' : 'inactive'}">${c.is_active ? '✅' : '❌'}</span></td>
          <td style="display:flex;gap:6px;">
            <button class="btn btn-secondary btn-sm" onclick="openContentModal(${c.id})">✏️</button>
            ${c.type === 'series' ? `<button class="btn btn-primary btn-sm" onclick="manageEpisodes(${c.id}, '${c.title}')">📺 حلقات</button>` : `<button class="btn btn-primary btn-sm" onclick="manageLinks(${c.id}, null, '${c.title}')">🔗 روابط</button>`}
            <button class="btn btn-danger btn-sm" onclick="deleteItem('content', ${c.id}, 'المحتوى')">🗑️</button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">لا يوجد محتوى</td></tr>'}
    </tbody>
  </table>`;
}

async function filterContent() {
  const type = document.getElementById('filterType').value;
  const cat = document.getElementById('filterCat').value;
  let path = '/content?';
  if (type) path += `type=${type}&`;
  if (cat) path += `category=${cat}`;
  const items = await api(path);
  document.getElementById('contentTable').innerHTML = renderContentTable(items, window._contentCats);
}

async function openContentModal(id, cats) {
  let item = null;
  if (!cats) cats = window._contentCats || await api('/categories');
  if (id) {
    item = await api(`/content/${id}`);
  }
  
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">${item ? '✏️ تعديل المحتوى' : '➕ إضافة محتوى جديد'}</h2>
      <button class="btn btn-secondary btn-icon" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label>النوع *</label>
          <select id="f_type">
            <option value="movie" ${item?.type === 'movie' ? 'selected' : ''}>🎬 فيلم</option>
            <option value="series" ${item?.type === 'series' ? 'selected' : ''}>📺 مسلسل</option>
          </select>
        </div>
        <div class="form-group">
          <label>التصنيف</label>
          <select id="f_cat">
            <option value="">بدون تصنيف</option>
            ${(cats || []).map(c => `<option value="${c.id}" ${item?.category_id == c.id ? 'selected' : ''}>${c.emoji} ${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>العنوان (إنجليزي/أصلي) *</label>
        <input id="f_title" value="${item?.title || ''}" placeholder="مثال: Naruto">
      </div>
      <div class="form-group">
        <label>العنوان بالعربي</label>
        <input id="f_title_ar" value="${item?.title_ar || ''}" placeholder="مثال: ناروتو">
      </div>
      <div class="form-group">
        <label>القصة / الوصف</label>
        <textarea id="f_desc">${item?.description || ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>رابط الصورة (Poster)</label>
          <input id="f_poster" value="${item?.poster_url || ''}" placeholder="https://...">
        </div>
        <div class="form-group">
          <label>تاريخ الإصدار</label>
          <input id="f_release" value="${item?.release_date || ''}" placeholder="2023">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>التقييم (من 10)</label>
          <input id="f_rating" type="number" step="0.1" min="0" max="10" value="${item?.rating || ''}">
        </div>
        <div class="form-group">
          <label>التصنيفات (مفصولة بفاصلة)</label>
          <input id="f_tags" value="${(item?.tags || []).join(', ')}" placeholder="أكشن, مغامرة, كوميديا">
        </div>
      </div>
      <div class="form-group">
        <label>الحالة</label>
        <select id="f_active">
          <option value="true" ${item?.is_active !== false ? 'selected' : ''}>✅ نشط</option>
          <option value="false" ${item?.is_active === false ? 'selected' : ''}>❌ مخفي</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveContent(${item?.id || 'null'})">💾 حفظ</button>
    </div>
  `);
}

async function saveContent(id) {
  const tagsRaw = document.getElementById('f_tags').value;
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
  
  const body = {
    type: document.getElementById('f_type').value,
    category_id: document.getElementById('f_cat').value || null,
    title: document.getElementById('f_title').value,
    title_ar: document.getElementById('f_title_ar').value || null,
    description: document.getElementById('f_desc').value || null,
    poster_url: document.getElementById('f_poster').value || null,
    release_date: document.getElementById('f_release').value || null,
    rating: parseFloat(document.getElementById('f_rating').value) || null,
    tags,
    is_active: document.getElementById('f_active').value === 'true'
  };
  
  if (!body.title) { toast('العنوان مطلوب', 'error'); return; }
  
  const res = await api(id ? `/content/${id}` : '/content', id ? 'PUT' : 'POST', body);
  if (res && !res.error) {
    toast(id ? '✅ تم التعديل' : '✅ تم الإضافة');
    closeModal();
    loadContent();
  } else {
    toast('خطأ: ' + (res?.error || ''), 'error');
  }
}

// ============================================
// EPISODES
// ============================================
async function loadEpisodes() {
  const contents = await api('/content?type=series');
  
  document.getElementById('pageContent').innerHTML = `
  <div class="card" style="margin-bottom:16px;">
    <div class="card-header">
      <h3 class="card-title">📺 إدارة الحلقات</h3>
    </div>
    <div class="form-group">
      <label>اختر المسلسل</label>
      <select id="seriesSelect" onchange="loadSeriesEpisodes(this.value, this.options[this.selectedIndex].text)">
        <option value="">-- اختر مسلسلاً --</option>
        ${(contents || []).map(c => `<option value="${c.id}">${c.title}</option>`).join('')}
      </select>
    </div>
  </div>
  <div id="episodesArea"></div>`;
}

async function loadSeriesEpisodes(contentId, title) {
  if (!contentId) { document.getElementById('episodesArea').innerHTML = ''; return; }
  
  const eps = await api(`/episodes?content_id=${contentId}`);
  
  document.getElementById('episodesArea').innerHTML = `
  <div class="card">
    <div class="card-header">
      <h3 class="card-title">📺 حلقات: ${title || ''}</h3>
      <button class="btn btn-primary btn-sm" onclick="openEpisodeModal(null, ${contentId})">+ إضافة حلقة</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>رقم الحلقة</th><th>الموسم</th><th>العنوان</th><th>الروابط</th><th>الإجراءات</th></tr></thead>
        <tbody>
          ${(eps || []).map(ep => `
            <tr>
              <td><strong>الحلقة ${ep.episode_number}</strong></td>
              <td>الموسم ${ep.season}</td>
              <td>${ep.title || '-'}</td>
              <td>
                <button class="btn btn-secondary btn-sm" onclick="manageLinks(${contentId}, ${ep.id}, 'الحلقة ${ep.episode_number}')">🔗 الروابط</button>
              </td>
              <td>
                <button class="btn btn-secondary btn-sm" onclick="openEpisodeModal(${JSON.stringify(ep).replace(/"/g, '&quot;')}, ${contentId})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteItem('episodes', ${ep.id}, 'الحلقة', () => loadSeriesEpisodes('${contentId}', '${title}'))">🗑️</button>
              </td>
            </tr>
          `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px">لا توجد حلقات</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function openEpisodeModal(ep, contentId) {
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">${ep ? '✏️ تعديل حلقة' : '➕ إضافة حلقة'}</h2>
      <button class="btn btn-secondary btn-icon" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label>رقم الحلقة *</label>
          <input id="f_epnum" type="number" min="1" value="${ep?.episode_number || ''}">
        </div>
        <div class="form-group">
          <label>الموسم</label>
          <input id="f_season" type="number" min="1" value="${ep?.season || 1}">
        </div>
      </div>
      <div class="form-group">
        <label>عنوان الحلقة (اختياري)</label>
        <input id="f_eptitle" value="${ep?.title || ''}" placeholder="مثال: البداية">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveEpisode(${ep?.id || 'null'}, ${contentId})">💾 حفظ</button>
    </div>
  `);
}

async function saveEpisode(id, contentId) {
  const body = {
    content_id: contentId,
    episode_number: parseInt(document.getElementById('f_epnum').value),
    season: parseInt(document.getElementById('f_season').value) || 1,
    title: document.getElementById('f_eptitle').value || null
  };
  
  if (!body.episode_number) { toast('رقم الحلقة مطلوب', 'error'); return; }
  
  const res = await api(id ? `/episodes/${id}` : '/episodes', id ? 'PUT' : 'POST', body);
  if (res && !res.error) {
    toast('✅ تم الحفظ');
    closeModal();
    loadSeriesEpisodes(contentId);
  } else {
    toast('خطأ: ' + (res?.error || ''), 'error');
  }
}

// ============================================
// LINKS
// ============================================
async function loadLinks() {
  const links = await api('/links');
  
  document.getElementById('pageContent').innerHTML = `
  <div class="card">
    <div class="card-header">
      <h3 class="card-title">🔗 جميع روابط التحميل</h3>
      <span style="color:var(--text-muted);font-size:13px">${(links || []).length} رابط</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>المحتوى</th><th>الحلقة</th><th>الجودة</th><th>التحميلات</th><th>الرابط</th><th>الإجراءات</th></tr></thead>
        <tbody>
          ${(links || []).map(l => `
            <tr>
              <td>${l.content_id || '-'}</td>
              <td>${l.episode_id ? `حلقة ${l.episode_id}` : '(فيلم)'}</td>
              <td><span class="badge badge-${l.quality.replace('p','')}">${l.quality}</span></td>
              <td>📥 ${l.downloads || 0}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">
                <a href="${l.short_url || l.url}" target="_blank" style="color:var(--accent);font-size:12px">${l.short_url || l.url}</a>
              </td>
              <td>
                <button class="btn btn-danger btn-sm" onclick="deleteItem('links', ${l.id}, 'الرابط')">🗑️</button>
              </td>
            </tr>
          `).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px">لا توجد روابط</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function manageLinks(contentId, episodeId, label) {
  const links = await api(`/links?${episodeId ? `episode_id=${episodeId}` : `content_id=${contentId}`}`);
  
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">🔗 روابط: ${label}</h2>
      <button class="btn btn-secondary btn-icon" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <!-- Existing Links -->
      ${(links || []).length > 0 ? `
      <div style="margin-bottom:20px;">
        <h4 style="margin-bottom:10px;color:var(--text-secondary)">الروابط الحالية:</h4>
        ${(links || []).map(l => `
          <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg-secondary);border-radius:8px;margin-bottom:6px;">
            <span class="badge badge-${l.quality.replace('p','')}">${l.quality}</span>
            <a href="${l.short_url || l.url}" target="_blank" style="flex:1;font-size:12px;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.short_url || l.url}</a>
            <button class="btn btn-danger btn-sm" onclick="deleteLinkFromModal(${l.id}, ${contentId}, ${episodeId || 'null'}, '${label}')">🗑️</button>
          </div>
        `).join('')}
      </div>` : '<p style="color:var(--text-muted);margin-bottom:16px;">لا توجد روابط حالياً</p>'}
      
      <!-- Add New Link -->
      <h4 style="margin-bottom:10px;">➕ إضافة رابط:</h4>
      <div class="form-group">
        <label>الجودة *</label>
        <select id="f_quality">
          <option>1080p</option><option>720p</option><option>480p</option><option>360p</option><option>4K</option>
        </select>
      </div>
      <div class="form-group">
        <label>رابط التحميل *</label>
        <input id="f_url" placeholder="https://...">
      </div>
      <div class="form-group">
        <label>رابط مختصر (اختياري)</label>
        <input id="f_short" placeholder="https://swiftlnx.com/...">
      </div>
      <div class="form-group">
        <label>حجم الملف (اختياري)</label>
        <input id="f_size" placeholder="مثال: 800 MB">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">إغلاق</button>
      <button class="btn btn-primary" onclick="saveLink(${contentId}, ${episodeId || 'null'}, '${label}')">💾 إضافة</button>
    </div>
  `);
}

async function deleteLinkFromModal(linkId, contentId, episodeId, label) {
  await api(`/links/${linkId}`, 'DELETE');
  toast('✅ تم الحذف');
  manageLinks(contentId, episodeId, label);
}

async function saveLink(contentId, episodeId, label) {
  const body = {
    content_id: contentId,
    episode_id: episodeId || null,
    quality: document.getElementById('f_quality').value,
    url: document.getElementById('f_url').value,
    short_url: document.getElementById('f_short').value || null,
    file_size: document.getElementById('f_size').value || null
  };
  
  if (!body.url) { toast('رابط التحميل مطلوب', 'error'); return; }
  
  const res = await api('/links', 'POST', body);
  if (res && !res.error) {
    toast('✅ تم إضافة الرابط');
    manageLinks(contentId, episodeId, label);
  } else {
    toast('خطأ: ' + (res?.error || ''), 'error');
  }
}

// ============================================
// USERS
// ============================================
async function loadUsers() {
  const users = await api('/users');
  
  document.getElementById('pageContent').innerHTML = `
  <div class="card">
    <div class="card-header">
      <h3 class="card-title">👥 المستخدمين</h3>
      <span style="color:var(--text-muted);font-size:13px">${(users || []).length} مستخدم</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>الاسم</th><th>@username</th><th>تاريخ الانضمام</th><th>آخر نشاط</th><th>الحالة</th><th></th></tr></thead>
        <tbody>
          ${(users || []).map(u => `
            <tr>
              <td style="color:var(--text-muted);font-size:12px">${u.telegram_id}</td>
              <td>${u.first_name || ''} ${u.last_name || ''}</td>
              <td>${u.username ? `@${u.username}` : '-'}</td>
              <td style="font-size:12px">${u.joined_at?.slice(0,10)}</td>
              <td style="font-size:12px">${u.last_active?.slice(0,10)}</td>
              <td><span class="badge badge-${u.is_blocked ? 'inactive' : 'active'}">${u.is_blocked ? '🚫 محظور' : '✅ نشط'}</span></td>
              <td><button class="btn btn-sm ${u.is_blocked ? 'btn-success' : 'btn-danger'}" onclick="toggleBlock('${u.telegram_id}')">
                ${u.is_blocked ? '✅ فك الحظر' : '🚫 حظر'}
              </button></td>
            </tr>
          `).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">لا يوجد مستخدمين</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function toggleBlock(telegramId) {
  await api(`/users/${telegramId}/block`, 'POST');
  toast('✅ تم تغيير حالة المستخدم');
  loadUsers();
}

// ============================================
// BROADCAST
// ============================================
async function loadBroadcast() {
  document.getElementById('pageContent').innerHTML = `
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3 class="card-title">📢 إرسال رسالة جماعية</h3></div>
      <div class="modal-body">
        <div class="form-group">
          <label>الرسالة (يدعم HTML)</label>
          <textarea id="broadcastMsg" style="min-height:150px" placeholder="<b>أهلاً</b> بكم في تحديث جديد...&#10;&#10;&#10;يمكن استخدام:&#10;&lt;b&gt;عريض&lt;/b&gt;&#10;&lt;i&gt;مائل&lt;/i&gt;"></textarea>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-secondary" onclick="previewBroadcast()">👁️ معاينة</button>
          <button class="btn btn-warning" onclick="sendBroadcast()">📢 إرسال للجميع</button>
        </div>
      </div>
    </div>
    
    <div class="card">
      <div class="card-header"><h3 class="card-title">💡 تلميحات</h3></div>
      <div style="padding:16px;color:var(--text-secondary);font-size:14px;line-height:1.8;">
        <p>✅ يدعم HTML: &lt;b&gt; &lt;i&gt; &lt;a&gt; &lt;code&gt;</p>
        <p>✅ يمكن إضافة إيموجي مباشرة</p>
        <p>⚠️ سيتم إرسالها لجميع المستخدمين غير المحظورين</p>
        <p>⚠️ الرسائل الجماعية لها حد 30 رسالة/ثانية</p>
        <p>ℹ️ الحد الأقصى حالياً 100 مستخدم لكل مرة</p>
      </div>
    </div>
  </div>
  <div id="broadcastResult"></div>`;
}

async function previewBroadcast() {
  const msg = document.getElementById('broadcastMsg').value;
  const res = await api('/broadcast', 'POST', { message: msg, preview_only: true });
  toast(`سيتم الإرسال لـ ${res?.users_count || 0} مستخدم`, 'info');
}

async function sendBroadcast() {
  const msg = document.getElementById('broadcastMsg').value;
  if (!msg) { toast('الرسالة فارغة', 'error'); return; }
  if (!confirm('هل أنت متأكد من إرسال الرسالة لجميع المستخدمين؟')) return;
  
  document.getElementById('broadcastResult').innerHTML = '<div class="loading"><div class="spinner"></div> جاري الإرسال...</div>';
  const res = await api('/broadcast', 'POST', { message: msg });
  document.getElementById('broadcastResult').innerHTML = `
  <div class="card" style="margin-top:16px;">
    <h3>نتيجة الإرسال</h3>
    <p>✅ نجح: ${res?.sent || 0}</p>
    <p>❌ فشل: ${res?.failed || 0}</p>
    <p>📊 الإجمالي: ${res?.total || 0}</p>
  </div>`;
}

// ============================================
// SETTINGS
// ============================================
async function loadSettings() {
  const settings = await api('/settings');
  
  const settingMap = {};
  (settings || []).forEach(s => settingMap[s.key] = s.value);
  
  document.getElementById('pageContent').innerHTML = `
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3 class="card-title">⚙️ إعدادات البوت</h3></div>
      <div style="padding:16px;">
        <div class="form-group">
          <label>رسالة الترحيب</label>
          <textarea id="s_welcome">${settingMap.welcome_message || ''}</textarea>
        </div>
        <div class="form-group">
          <label>رابط شرح تخطي الروابط</label>
          <input id="s_tutorial" value="${settingMap.tutorial_video_url || ''}">
        </div>
        <div class="form-group">
          <label>حالة البوت</label>
          <select id="s_status">
            <option value="active" ${settingMap.bot_status === 'active' ? 'selected' : ''}>✅ نشط</option>
            <option value="maintenance" ${settingMap.bot_status === 'maintenance' ? 'selected' : ''}>🔧 صيانة</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="saveSettings()">💾 حفظ الإعدادات</button>
      </div>
    </div>
    
    <div class="card">
      <div class="card-header"><h3 class="card-title">🔧 إعداد البوت</h3></div>
      <div style="padding:16px;">
        <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">بعد رفع المشروع على Netlify، اضغط هنا لتفعيل الويب هوك:</p>
        <button class="btn btn-success" onclick="setupWebhook()" style="width:100%;margin-bottom:10px;">🔗 تفعيل Webhook</button>
        <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;font-size:12px;color:var(--text-muted);">
          <p><strong>متغيرات البيئة المطلوبة في Netlify:</strong></p>
          <code>TELEGRAM_BOT_TOKEN</code><br>
          <code>SUPABASE_URL</code><br>
          <code>SUPABASE_SERVICE_KEY</code><br>
          <code>ADMIN_TOKEN</code>
        </div>
      </div>
    </div>
  </div>`;
}

async function saveSettings() {
  const updates = [
    { key: 'welcome_message', value: document.getElementById('s_welcome').value },
    { key: 'tutorial_video_url', value: document.getElementById('s_tutorial').value },
    { key: 'bot_status', value: document.getElementById('s_status').value }
  ];
  
  await Promise.all(updates.map(u => api('/settings', 'PUT', u)));
  toast('✅ تم حفظ الإعدادات');
}

// ============================================
// URL SHORTENER
// ============================================
async function loadShortener() {
  const statsData = await api('/shorten/stats');
  const linksData = await api('/shorten/list');
  const localLinks = linksData?.local || [];
  
  document.getElementById('pageContent').innerHTML = `
  <!-- Stats -->
  <div class="stats-grid" style="margin-bottom:20px;">
    ${statCard('🔗', localLinks.length, 'روابط أنشأتها', '#6c63ff')}
    ${statCard('👆', statsData?.local_total_clicks || 0, 'إجمالي النقرات', '#00d4ff')}
    ${statCard('📊', statsData?.total_links || 0, 'إجمالي روابط API', '#ffd93d')}
    ${statCard('📈', statsData?.total_clicks || statsData?.clicks || 0, 'نقرات API', '#6bcb77')}
  </div>
  
  <div class="grid-2">
    <!-- Shorten Form -->
    <div class="card">
      <div class="card-header"><h3 class="card-title">✂️ اختصار رابط جديد</h3></div>
      <div style="padding:16px;">
        <div class="form-group">
          <label>الرابط الأصلي *</label>
          <input id="sh_url" placeholder="https://..." type="url">
        </div>
        <div class="form-group">
          <label>وصف (اختياري)</label>
          <input id="sh_title" placeholder="مثال: حلقة 5 - ناروتو 720p">
        </div>
        <button class="btn btn-primary" style="width:100%" onclick="shortenUrl()">✂️ اختصر الرابط</button>
        <div id="shortenResult" style="margin-top:12px;"></div>
      </div>
    </div>
    
    <!-- API Stats Chart -->
    <div class="card">
      <div class="card-header"><h3 class="card-title">📈 إحصائيات روابطي</h3></div>
      <div class="chart-container"><canvas id="linksChart"></canvas></div>
    </div>
  </div>
  
  <!-- Links Table -->
  <div class="card" style="margin-top:20px;">
    <div class="card-header">
      <h3 class="card-title">📋 روابطي المختصرة</h3>
      <button class="btn btn-secondary btn-sm" onclick="loadShortener()">🔄 تحديث</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>العنوان</th><th>الرابط الأصلي</th><th>الرابط المختصر</th><th>النقرات</th><th>التاريخ</th></tr></thead>
        <tbody>
          ${localLinks.map(l => `
            <tr>
              <td>${l.title || '-'}</td>
              <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">
                <a href="${l.original_url}" target="_blank" style="color:var(--text-muted)">${l.original_url}</a>
              </td>
              <td>
                <a href="${l.short_url}" target="_blank" style="color:var(--accent)">${l.short_url}</a>
                <button class="btn btn-sm btn-secondary" onclick="copyText('${l.short_url}')" style="margin-right:4px;">📋</button>
              </td>
              <td>👆 ${l.clicks || 0}</td>
              <td style="font-size:12px">${l.created_at?.slice(0,10)}</td>
            </tr>
          `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px">لا توجد روابط</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
  
  // Chart
  if (localLinks.length > 0) {
    const top10 = localLinks.slice(0, 10);
    renderChart('linksChart', 'bar', top10.map(l => l.title || l.short_url?.split('/').pop()), [{
      label: 'النقرات',
      data: top10.map(l => l.clicks || 0),
      backgroundColor: 'rgba(108,99,255,0.7)',
      borderColor: '#6c63ff',
      borderRadius: 4
    }]);
  }
}

async function shortenUrl() {
  const url = document.getElementById('sh_url').value;
  const title = document.getElementById('sh_title').value;
  
  if (!url) { toast('أدخل الرابط أولاً', 'error'); return; }
  
  document.getElementById('shortenResult').innerHTML = '<div class="spinner" style="margin:auto;display:block;"></div>';
  
  const res = await api('/shorten', 'POST', { url, title });
  
  if (res?.short_url || res?.short) {
    const shortUrl = res.short_url || res.short;
    document.getElementById('shortenResult').innerHTML = `
      <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;display:flex;align-items:center;gap:8px;">
        <span style="flex:1;color:var(--accent)">${shortUrl}</span>
        <button class="btn btn-primary btn-sm" onclick="copyText('${shortUrl}')">📋 نسخ</button>
      </div>`;
    toast('✅ تم اختصار الرابط');
  } else {
    document.getElementById('shortenResult').innerHTML = `<p style="color:var(--danger)">❌ خطأ: ${JSON.stringify(res)}</p>`;
    toast('خطأ في الاختصار', 'error');
  }
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('✅ تم النسخ'));
}

// ============================================
// MODAL
// ============================================
function openModal(html) {
  document.getElementById('dynamicModalContent').innerHTML = html;
  document.getElementById('dynamicModal').classList.add('open');
}

function closeModal() {
  document.getElementById('dynamicModal').classList.remove('open');
}

document.getElementById('dynamicModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ============================================
// DELETE
// ============================================
async function deleteItem(table, id, label, callback) {
  if (!confirm(`هل تريد حذف هذا ${label}؟ لا يمكن التراجع!`)) return;
  const res = await api(`/${table}/${id}`, 'DELETE');
  if (res?.success) {
    toast(`✅ تم حذف ${label}`);
    if (callback) callback();
    else refreshPage();
  } else {
    toast('❌ خطأ في الحذف', 'error');
  }
}

// ============================================
// SETUP WEBHOOK
// ============================================
async function setupWebhook() {
  const res = await fetch('/.netlify/functions/setup', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
  }).then(r => r.json());
  
  if (res?.webhook_set?.ok) {
    toast(`✅ تم تفعيل البوت: @${res.bot_info?.username}`);
  } else {
    toast('⚠️ ' + JSON.stringify(res?.webhook_set), 'warning');
  }
}

// ============================================
// INIT
// ============================================
window.addEventListener('load', () => {
  if (AUTH_TOKEN) {
    api('/stats').then(data => {
      if (data && !data.error) {
        document.getElementById('loginModal').classList.remove('open');
        showPage('dashboard');
      }
    });
  }
});

// Manage episodes shortcut
async function manageEpisodes(contentId, title) {
  showPage('episodes');
  setTimeout(() => {
    const select = document.getElementById('seriesSelect');
    if (select) {
      select.value = contentId;
      loadSeriesEpisodes(contentId, title);
    }
  }, 500);
}
