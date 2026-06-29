// public/js/admin.js
// Admin Dashboard Main Logic

const API_BASE = '/.netlify/functions/admin-api';
let AUTH_TOKEN = localStorage.getItem('admin_token') || '';
let currentPage = 'dashboard';
let charts = {};

// ============================================
// AUTH - تسجيل الدخول
// ============================================
function login() {
  const pw = document.getElementById('loginPassword').value.trim();
  if (!pw) {
    toast('أدخل كلمة المرور أولاً', 'error');
    return;
  }
  AUTH_TOKEN = pw;
  localStorage.setItem('admin_token', pw);
  document.getElementById('loginModal').classList.remove('open');
  showPage('dashboard');
}

// ============================================
// API - التواصل مع السيرفر
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
    if (res.status === 401) {
      toast('كلمة المرور غير صحيحة ❌', 'error');
      localStorage.removeItem('admin_token');
      AUTH_TOKEN = '';
      document.getElementById('loginModal').classList.add('open');
      return null;
    }
    return res.json();
  } catch (err) {
    console.error('API error:', err);
    return null;
  }
}

// ============================================
// TOAST - رسائل التنبيه
// ============================================
function toast(msg, type = 'success') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icons[type] || '•'} ${msg}`;
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
// NAVIGATION - التنقل بين الصفحات
// ============================================
function showPage(page) {
  currentPage = page;
  closeSidebar();

  const pages = {
    dashboard:  { title: '📊 الإحصائيات',            fn: loadDashboard },
    categories: { title: '📂 التصنيفات',              fn: loadCategories },
    content:    { title: '🎬 الأفلام والمسلسلات',     fn: loadContent },
    episodes:   { title: '📺 الحلقات',               fn: loadEpisodes },
    links:      { title: '🔗 روابط التحميل',          fn: loadLinks },
    users:      { title: '👥 المستخدمين',             fn: loadUsers },
    broadcast:  { title: '📢 رسائل جماعية',           fn: loadBroadcast },
    shortener:  { title: '✂️ اختصار الروابط',         fn: loadShortener },
    settings:   { title: '⚙️ الإعدادات',              fn: loadSettings }
  };

  const p = pages[page];
  if (!p) return;

  document.getElementById('pageTitle').textContent = p.title;
  document.getElementById('pageContent').innerHTML =
    '<div class="loading"><div class="spinner"></div> جاري التحميل...</div>';

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('onclick')?.includes(`'${page}'`));
  });

  p.fn();
}

function refreshPage() { showPage(currentPage); }

// ============================================
// DASHBOARD - الإحصائيات
// ============================================
async function loadDashboard() {
  const data = await api('/stats');

  if (!data) {
    document.getElementById('pageContent').innerHTML =
      `<div class="empty-state"><div class="empty-icon">❌</div>
       <h3>تعذّر تحميل الإحصائيات</h3>
       <p>تحقق من كلمة المرور أو المتغيرات في Netlify</p></div>`;
    return;
  }

  const o = data.overview || {};
  const daily_stats = data.daily_stats || [];
  const quality_distribution = data.quality_distribution || {};
  const top_content = data.top_content || [];

  document.getElementById('pageContent').innerHTML = `
  <div class="stats-grid">
    ${statCard('👥', o.total_users,     'إجمالي المستخدمين',  '#6c63ff')}
    ${statCard('📥', o.total_downloads, 'إجمالي التحميلات',   '#00d4ff')}
    ${statCard('👁️', o.total_views,     'إجمالي المشاهدات',   '#ffd93d')}
    ${statCard('🎬', o.total_movies,    'الأفلام',            '#ff6b6b')}
    ${statCard('📺', o.total_series,    'المسلسلات',          '#6bcb77')}
    ${statCard('🎞️', o.total_episodes,  'الحلقات',            '#a78bfa')}
    ${statCard('🔗', o.total_links,     'روابط التحميل',      '#f59e0b')}
    ${statCard('📂', o.total_categories,'التصنيفات',          '#ec4899')}
  </div>

  <div class="grid-2" style="margin-bottom:20px;">
    <div class="card">
      <div class="card-header"><h3 class="card-title">📈 المستخدمين الجدد (30 يوم)</h3></div>
      <div class="chart-container"><canvas id="usersChart"></canvas></div>
    </div>
    <div class="card">
      <div class="card-header"><h3 class="card-title">📥 التحميلات (30 يوم)</h3></div>
      <div class="chart-container"><canvas id="downloadsChart"></canvas></div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3 class="card-title">🏆 أكثر المحتوى مشاهدة</h3></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>العنوان</th><th>النوع</th><th>المشاهدات</th></tr></thead>
          <tbody>
            ${top_content.length ? top_content.map((c,i) => `
              <tr>
                <td><strong>${i+1}</strong></td>
                <td>${c.title}</td>
                <td><span class="badge badge-${c.type}">${c.type==='movie'?'🎬 فيلم':'📺 مسلسل'}</span></td>
                <td>👁️ ${(c.views||0).toLocaleString()}</td>
              </tr>`).join('')
              : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:30px">لا توجد بيانات بعد</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3 class="card-title">🎯 توزيع الجودات</h3></div>
      <div class="chart-container"><canvas id="qualityChart"></canvas></div>
    </div>
  </div>`;

  const days   = daily_stats.slice().reverse();
  const labels = days.map(d => d.date?.slice(5) || '');

  renderChart('usersChart', 'line', labels, [{
    label: 'مستخدمين جدد',
    data: days.map(d => d.new_users || 0),
    borderColor: '#6c63ff', backgroundColor: 'rgba(108,99,255,0.1)',
    fill: true, tension: 0.4
  }]);

  renderChart('downloadsChart', 'bar', labels, [{
    label: 'التحميلات',
    data: days.map(d => d.total_downloads || 0),
    backgroundColor: 'rgba(0,212,255,0.6)', borderColor: '#00d4ff', borderRadius: 4
  }]);

  renderChart('qualityChart', 'doughnut', Object.keys(quality_distribution), [{
    data: Object.values(quality_distribution),
    backgroundColor: ['#ffd93d','#6c63ff','#6bcb77','#94a3b8','#ff6b6b'],
    borderWidth: 2, borderColor: '#1a2236'
  }]);
}

function statCard(icon, value, label, color) {
  return `
  <div class="stat-card" style="--stat-color:${color}">
    <div class="stat-icon">${icon}</div>
    <div class="stat-value">${(value||0).toLocaleString()}</div>
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
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Cairo' } } } },
      scales: (type !== 'doughnut' && type !== 'pie') ? {
        x: { ticks: { color: '#64748b' }, grid: { color: '#1e2d45' } },
        y: { ticks: { color: '#64748b' }, grid: { color: '#1e2d45' } }
      } : {}
    }
  });
}

// ============================================
// CATEGORIES - التصنيفات
// ============================================
async function loadCategories() {
  const cats = await api('/categories') || [];

  document.getElementById('pageContent').innerHTML = `
  <div class="card">
    <div class="card-header">
      <h3 class="card-title">📂 التصنيفات</h3>
      <button class="btn btn-primary btn-sm" onclick="openCategoryModal()">+ إضافة تصنيف</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>الإيموجي</th><th>الاسم</th><th>الوصف</th><th>الترتيب</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
        <tbody>
          ${cats.length ? cats.map(c => `
            <tr>
              <td style="font-size:24px">${c.emoji||'📁'}</td>
              <td><strong>${c.name}</strong></td>
              <td style="color:var(--text-secondary)">${c.description||'-'}</td>
              <td>${c.sort_order}</td>
              <td><span class="badge badge-${c.is_active?'active':'inactive'}">${c.is_active?'✅ نشط':'❌ مخفي'}</span></td>
              <td style="display:flex;gap:6px;">
                <button class="btn btn-secondary btn-sm" onclick='openCategoryModal(${JSON.stringify(c)})'>✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteItem('categories',${c.id},'التصنيف')">🗑️</button>
              </td>
            </tr>`).join('')
            : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px">لا توجد تصنيفات — أضف واحداً!</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function openCategoryModal(cat = null) {
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">${cat ? '✏️ تعديل تصنيف' : '➕ إضافة تصنيف'}</h2>
      <button class="btn btn-secondary btn-icon" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label>الإيموجي</label>
          <input id="f_emoji" value="${cat?.emoji||'🎬'}">
        </div>
        <div class="form-group">
          <label>الترتيب</label>
          <input id="f_order" type="number" value="${cat?.sort_order||0}">
        </div>
      </div>
      <div class="form-group">
        <label>اسم التصنيف *</label>
        <input id="f_name" value="${cat?.name||''}" placeholder="مثال: أفلام مدبلجة">
      </div>
      <div class="form-group">
        <label>الوصف</label>
        <input id="f_desc" value="${cat?.description||''}" placeholder="وصف مختصر">
      </div>
      <div class="form-group">
        <label>الحالة</label>
        <select id="f_active">
          <option value="true"  ${cat?.is_active!==false?'selected':''}>✅ نشط</option>
          <option value="false" ${cat?.is_active===false?'selected':''}>❌ مخفي</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveCategory(${cat?.id||'null'})">💾 حفظ</button>
    </div>`);
}

async function saveCategory(id) {
  const body = {
    name:        document.getElementById('f_name').value.trim(),
    emoji:       document.getElementById('f_emoji').value.trim(),
    description: document.getElementById('f_desc').value.trim(),
    sort_order:  parseInt(document.getElementById('f_order').value) || 0,
    is_active:   document.getElementById('f_active').value === 'true'
  };
  if (!body.name) { toast('اسم التصنيف مطلوب', 'error'); return; }

  const res = await api(id ? `/categories/${id}` : '/categories', id ? 'PUT' : 'POST', body);
  if (res) { toast(id ? '✅ تم التعديل' : '✅ تمت الإضافة'); closeModal(); loadCategories(); }
}

// ============================================
// CONTENT - الأفلام والمسلسلات
// ============================================
async function loadContent() {
  const [items, cats] = await Promise.all([api('/content') || [], api('/categories') || []]);
  window._contentCats = cats || [];

  document.getElementById('pageContent').innerHTML = `
  <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
    <button class="btn btn-primary" onclick="openContentModal(null)">+ إضافة فيلم/مسلسل</button>
    <select id="filterType" onchange="filterContent()" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);padding:8px 12px;border-radius:8px;">
      <option value="">كل الأنواع</option>
      <option value="movie">🎬 أفلام</option>
      <option value="series">📺 مسلسلات</option>
    </select>
  </div>
  <div class="card">
    <div class="card-header">
      <h3 class="card-title">🎬 الأفلام والمسلسلات</h3>
      <span style="color:var(--text-muted);font-size:13px">${(items||[]).length} عنصر</span>
    </div>
    <div class="table-wrap" id="contentTable">
      ${renderContentTable(items || [], cats || [])}
    </div>
  </div>`;

  window._contentItems = items || [];
}

function renderContentTable(items, cats) {
  return `<table>
    <thead><tr><th>#</th><th>العنوان</th><th>النوع</th><th>التصنيف</th><th>المشاهدات</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
    <tbody>
      ${items.length ? items.map(c => `
        <tr>
          <td style="color:var(--text-muted)">${c.id}</td>
          <td>
            <div style="font-weight:600">${c.title}</div>
            ${c.title_ar ? `<div style="font-size:12px;color:var(--text-secondary)">${c.title_ar}</div>` : ''}
          </td>
          <td><span class="badge badge-${c.type}">${c.type==='movie'?'🎬 فيلم':'📺 مسلسل'}</span></td>
          <td>${c.categories ? c.categories.emoji+' '+c.categories.name : '-'}</td>
          <td>👁️ ${(c.views||0).toLocaleString()}</td>
          <td><span class="badge badge-${c.is_active?'active':'inactive'}">${c.is_active?'✅':'❌'}</span></td>
          <td style="display:flex;gap:4px;flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" onclick="openContentModal(${c.id})">✏️</button>
            ${c.type==='series'
              ? `<button class="btn btn-primary btn-sm" onclick="manageEpisodes(${c.id},'${c.title.replace(/'/g,"\\'")}')">📺</button>`
              : `<button class="btn btn-primary btn-sm" onclick="manageLinks(${c.id},null,'${c.title.replace(/'/g,"\\'")}')">🔗</button>`}
            <button class="btn btn-danger btn-sm" onclick="deleteItem('content',${c.id},'المحتوى')">🗑️</button>
          </td>
        </tr>`).join('')
        : '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px">لا يوجد محتوى بعد</td></tr>'}
    </tbody>
  </table>`;
}

async function filterContent() {
  const type = document.getElementById('filterType').value;
  const path = type ? `/content?type=${type}` : '/content';
  const items = await api(path) || [];
  document.getElementById('contentTable').innerHTML = renderContentTable(items, window._contentCats || []);
}

async function openContentModal(id) {
  const cats = window._contentCats || await api('/categories') || [];
  let item = null;
  if (id) item = await api(`/content/${id}`);

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">${item ? '✏️ تعديل المحتوى' : '➕ إضافة محتوى'}</h2>
      <button class="btn btn-secondary btn-icon" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label>النوع *</label>
          <select id="f_type">
            <option value="movie"  ${item?.type==='movie' ?'selected':''}>🎬 فيلم</option>
            <option value="series" ${item?.type==='series'?'selected':''}>📺 مسلسل</option>
          </select>
        </div>
        <div class="form-group">
          <label>التصنيف</label>
          <select id="f_cat">
            <option value="">بدون تصنيف</option>
            ${cats.map(c=>`<option value="${c.id}" ${item?.category_id==c.id?'selected':''}>${c.emoji} ${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>العنوان (أصلي) *</label>
        <input id="f_title" value="${item?.title||''}" placeholder="مثال: Naruto">
      </div>
      <div class="form-group">
        <label>العنوان بالعربي</label>
        <input id="f_title_ar" value="${item?.title_ar||''}" placeholder="مثال: ناروتو">
      </div>
      <div class="form-group">
        <label>القصة / الوصف</label>
        <textarea id="f_desc">${item?.description||''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>رابط الصورة (Poster)</label>
          <input id="f_poster" value="${item?.poster_url||''}" placeholder="https://...">
        </div>
        <div class="form-group">
          <label>سنة الإصدار</label>
          <input id="f_release" value="${item?.release_date||''}" placeholder="2024">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>التقييم (0-10)</label>
          <input id="f_rating" type="number" step="0.1" min="0" max="10" value="${item?.rating||''}">
        </div>
        <div class="form-group">
          <label>التصنيفات (مفصولة بفاصلة)</label>
          <input id="f_tags" value="${(item?.tags||[]).join(', ')}" placeholder="أكشن, مغامرة">
        </div>
      </div>
      <div class="form-group">
        <label>الحالة</label>
        <select id="f_active">
          <option value="true"  ${item?.is_active!==false?'selected':''}>✅ نشط</option>
          <option value="false" ${item?.is_active===false?'selected':''}>❌ مخفي</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveContent(${item?.id||'null'})">💾 حفظ</button>
    </div>`);
}

async function saveContent(id) {
  const tags = (document.getElementById('f_tags').value||'').split(',').map(t=>t.trim()).filter(Boolean);
  const body = {
    type:         document.getElementById('f_type').value,
    category_id:  document.getElementById('f_cat').value || null,
    title:        document.getElementById('f_title').value.trim(),
    title_ar:     document.getElementById('f_title_ar').value.trim() || null,
    description:  document.getElementById('f_desc').value.trim() || null,
    poster_url:   document.getElementById('f_poster').value.trim() || null,
    release_date: document.getElementById('f_release').value.trim() || null,
    rating:       parseFloat(document.getElementById('f_rating').value) || null,
    tags,
    is_active:    document.getElementById('f_active').value === 'true'
  };
  if (!body.title) { toast('العنوان مطلوب', 'error'); return; }

  const res = await api(id ? `/content/${id}` : '/content', id ? 'PUT' : 'POST', body);
  if (res) { toast(id ? '✅ تم التعديل' : '✅ تمت الإضافة'); closeModal(); loadContent(); }
}

// ============================================
// EPISODES - الحلقات
// ============================================
async function loadEpisodes() {
  const contents = await api('/content?type=series') || [];

  document.getElementById('pageContent').innerHTML = `
  <div class="card" style="margin-bottom:16px;">
    <div class="card-header"><h3 class="card-title">📺 إدارة الحلقات</h3></div>
    <div class="form-group" style="padding:0 0 4px;">
      <label>اختر المسلسل</label>
      <select id="seriesSelect" onchange="loadSeriesEpisodes(this.value, this.options[this.selectedIndex].text)">
        <option value="">-- اختر مسلسلاً --</option>
        ${contents.map(c=>`<option value="${c.id}">${c.title}</option>`).join('')}
      </select>
    </div>
  </div>
  <div id="episodesArea"></div>`;
}

async function loadSeriesEpisodes(contentId, title) {
  if (!contentId) { document.getElementById('episodesArea').innerHTML = ''; return; }
  const eps = await api(`/episodes?content_id=${contentId}`) || [];

  document.getElementById('episodesArea').innerHTML = `
  <div class="card">
    <div class="card-header">
      <h3 class="card-title">📺 حلقات: ${title||''}</h3>
      <button class="btn btn-primary btn-sm" onclick="openEpisodeModal(null,${contentId})">+ إضافة حلقة</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>رقم الحلقة</th><th>الموسم</th><th>العنوان</th><th>الروابط</th><th>الإجراءات</th></tr></thead>
        <tbody>
          ${eps.length ? eps.map(ep=>`
            <tr>
              <td><strong>الحلقة ${ep.episode_number}</strong></td>
              <td>الموسم ${ep.season}</td>
              <td>${ep.title||'-'}</td>
              <td><button class="btn btn-secondary btn-sm" onclick="manageLinks(${contentId},${ep.id},'الحلقة ${ep.episode_number}')">🔗 الروابط</button></td>
              <td style="display:flex;gap:6px;">
                <button class="btn btn-secondary btn-sm" onclick='openEpisodeModal(${JSON.stringify(ep)},${contentId})'>✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteItem('episodes',${ep.id},'الحلقة',()=>loadSeriesEpisodes('${contentId}','${(title||'').replace(/'/g,"\\'")}'))">🗑️</button>
              </td>
            </tr>`).join('')
            : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px">لا توجد حلقات — أضف أول حلقة!</td></tr>'}
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
          <input id="f_epnum" type="number" min="1" value="${ep?.episode_number||''}">
        </div>
        <div class="form-group">
          <label>الموسم</label>
          <input id="f_season" type="number" min="1" value="${ep?.season||1}">
        </div>
      </div>
      <div class="form-group">
        <label>عنوان الحلقة (اختياري)</label>
        <input id="f_eptitle" value="${ep?.title||''}" placeholder="مثال: البداية">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">إلغاء</button>
      <button class="btn btn-primary" onclick="saveEpisode(${ep?.id||'null'},${contentId})">💾 حفظ</button>
    </div>`);
}

async function saveEpisode(id, contentId) {
  const body = {
    content_id:      contentId,
    episode_number:  parseInt(document.getElementById('f_epnum').value),
    season:          parseInt(document.getElementById('f_season').value) || 1,
    title:           document.getElementById('f_eptitle').value.trim() || null
  };
  if (!body.episode_number) { toast('رقم الحلقة مطلوب', 'error'); return; }

  const res = await api(id ? `/episodes/${id}` : '/episodes', id ? 'PUT' : 'POST', body);
  if (res) {
    toast('✅ تم الحفظ');
    closeModal();
    loadSeriesEpisodes(contentId);
  }
}

// ============================================
// LINKS - روابط التحميل
// ============================================
async function loadLinks() {
  const links = await api('/links') || [];

  document.getElementById('pageContent').innerHTML = `
  <div class="card">
    <div class="card-header">
      <h3 class="card-title">🔗 جميع روابط التحميل</h3>
      <span style="color:var(--text-muted);font-size:13px">${links.length} رابط</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>المحتوى</th><th>الحلقة</th><th>الجودة</th><th>التحميلات</th><th>الرابط</th><th></th></tr></thead>
        <tbody>
          ${links.length ? links.map(l=>`
            <tr>
              <td>${l.content_id||'-'}</td>
              <td>${l.episode_id ? `حلقة` : '(فيلم)'}</td>
              <td><span class="badge">${l.quality}</span></td>
              <td>📥 ${l.downloads||0}</td>
              <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                <a href="${l.short_url||l.url}" target="_blank" style="color:var(--accent);font-size:12px">${l.short_url||l.url}</a>
              </td>
              <td><button class="btn btn-danger btn-sm" onclick="deleteItem('links',${l.id},'الرابط')">🗑️</button></td>
            </tr>`).join('')
            : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px">لا توجد روابط</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function manageLinks(contentId, episodeId, label) {
  const path = episodeId ? `/links?episode_id=${episodeId}` : `/links?content_id=${contentId}`;
  const links = await api(path) || [];

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">🔗 روابط: ${label}</h2>
      <button class="btn btn-secondary btn-icon" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      ${links.length ? `
      <div style="margin-bottom:16px;">
        <p style="color:var(--text-secondary);font-size:13px;margin-bottom:8px;">الروابط الحالية:</p>
        ${links.map(l=>`
          <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg-secondary);border-radius:8px;margin-bottom:6px;">
            <span class="badge">${l.quality}</span>
            <a href="${l.short_url||l.url}" target="_blank" style="flex:1;font-size:12px;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.short_url||l.url}</a>
            <button class="btn btn-danger btn-sm" onclick="deleteLinkInModal(${l.id},${contentId},${episodeId||'null'},'${label.replace(/'/g,"\\'")}')">🗑️</button>
          </div>`).join('')}
      </div>` : '<p style="color:var(--text-muted);margin-bottom:16px;">لا توجد روابط حالياً</p>'}

      <p style="font-weight:600;margin-bottom:10px;">➕ إضافة رابط جديد:</p>
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
      <button class="btn btn-primary" onclick="saveLink(${contentId},${episodeId||'null'},'${label.replace(/'/g,"\\'")}')">💾 إضافة</button>
    </div>`);
}

async function deleteLinkInModal(linkId, contentId, episodeId, label) {
  await api(`/links/${linkId}`, 'DELETE');
  toast('✅ تم الحذف');
  manageLinks(contentId, episodeId, label);
}

async function saveLink(contentId, episodeId, label) {
  const url = document.getElementById('f_url').value.trim();
  if (!url) { toast('رابط التحميل مطلوب', 'error'); return; }

  const body = {
    content_id: contentId,
    episode_id: episodeId || null,
    quality:    document.getElementById('f_quality').value,
    url,
    short_url:  document.getElementById('f_short').value.trim() || null,
    file_size:  document.getElementById('f_size').value.trim() || null
  };

  const res = await api('/links', 'POST', body);
  if (res) { toast('✅ تم إضافة الرابط'); manageLinks(contentId, episodeId, label); }
}

// ============================================
// USERS - المستخدمين
// ============================================
async function loadUsers() {
  const users = await api('/users') || [];

  document.getElementById('pageContent').innerHTML = `
  <div class="card">
    <div class="card-header">
      <h3 class="card-title">👥 المستخدمين</h3>
      <span style="color:var(--text-muted);font-size:13px">${users.length} مستخدم</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID تليجرام</th><th>الاسم</th><th>@username</th><th>الانضمام</th><th>الحالة</th><th></th></tr></thead>
        <tbody>
          ${users.length ? users.map(u=>`
            <tr>
              <td style="font-size:12px;color:var(--text-muted)">${u.telegram_id}</td>
              <td>${u.first_name||''} ${u.last_name||''}</td>
              <td>${u.username?'@'+u.username:'-'}</td>
              <td style="font-size:12px">${u.joined_at?.slice(0,10)}</td>
              <td><span class="badge badge-${u.is_blocked?'inactive':'active'}">${u.is_blocked?'🚫 محظور':'✅ نشط'}</span></td>
              <td>
                <button class="btn btn-sm ${u.is_blocked?'btn-success':'btn-danger'}" onclick="toggleBlock('${u.telegram_id}')">
                  ${u.is_blocked?'✅ فك الحظر':'🚫 حظر'}
                </button>
              </td>
            </tr>`).join('')
            : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px">لا يوجد مستخدمين بعد</td></tr>'}
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
// BROADCAST - رسائل جماعية
// ============================================
async function loadBroadcast() {
  document.getElementById('pageContent').innerHTML = `
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3 class="card-title">📢 إرسال رسالة جماعية</h3></div>
      <div style="padding:16px;">
        <div class="form-group">
          <label>الرسالة (يدعم HTML: &lt;b&gt; &lt;i&gt; &lt;a&gt;)</label>
          <textarea id="broadcastMsg" style="min-height:150px;" placeholder="أهلاً بكم في تحديث جديد..."></textarea>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-secondary" onclick="previewBroadcast()">👁️ معاينة</button>
          <button class="btn btn-warning" onclick="sendBroadcast()">📢 إرسال للجميع</button>
        </div>
        <div id="broadcastResult" style="margin-top:12px;"></div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3 class="card-title">💡 تلميحات</h3></div>
      <div style="padding:16px;color:var(--text-secondary);font-size:14px;line-height:2;">
        <p>✅ &lt;b&gt;نص عريض&lt;/b&gt;</p>
        <p>✅ &lt;i&gt;نص مائل&lt;/i&gt;</p>
        <p>✅ &lt;a href="..."&gt;رابط&lt;/a&gt;</p>
        <p>⚠️ ترسل لجميع المستخدمين غير المحظورين</p>
        <p>⚠️ الحد الأقصى حالياً 100 مستخدم لكل مرة</p>
      </div>
    </div>
  </div>`;
}

async function previewBroadcast() {
  const msg = document.getElementById('broadcastMsg').value;
  if (!msg) { toast('الرسالة فارغة', 'error'); return; }
  const res = await api('/broadcast', 'POST', { message: msg, preview_only: true });
  if (res) toast(`سيتم الإرسال لـ ${res.users_count||0} مستخدم`, 'info');
}

async function sendBroadcast() {
  const msg = document.getElementById('broadcastMsg').value;
  if (!msg) { toast('الرسالة فارغة', 'error'); return; }
  if (!confirm('هل أنت متأكد من إرسال الرسالة لجميع المستخدمين؟')) return;

  document.getElementById('broadcastResult').innerHTML = '<div class="loading"><div class="spinner"></div> جاري الإرسال...</div>';
  const res = await api('/broadcast', 'POST', { message: msg });
  if (res) {
    document.getElementById('broadcastResult').innerHTML = `
      <div class="card" style="margin-top:8px;padding:12px;">
        <p>✅ نجح: <strong>${res.sent||0}</strong></p>
        <p>❌ فشل: <strong>${res.failed||0}</strong></p>
        <p>📊 الإجمالي: <strong>${res.total||0}</strong></p>
      </div>`;
  }
}

// ============================================
// URL SHORTENER - اختصار الروابط
// ============================================
async function loadShortener() {
  const [statsData, linksData] = await Promise.all([
    api('/shorten/stats'),
    api('/shorten/list')
  ]);
  const localLinks = linksData?.local || [];

  document.getElementById('pageContent').innerHTML = `
  <div class="stats-grid" style="margin-bottom:20px;">
    ${statCard('🔗', localLinks.length,                  'روابطي المختصرة',  '#6c63ff')}
    ${statCard('👆', statsData?.local_total_clicks||0,   'إجمالي النقرات',   '#00d4ff')}
    ${statCard('📊', statsData?.total_links||0,          'روابط API',        '#ffd93d')}
    ${statCard('📈', statsData?.total_clicks||0,         'نقرات API',        '#6bcb77')}
  </div>

  <div class="grid-2" style="margin-bottom:20px;">
    <div class="card">
      <div class="card-header"><h3 class="card-title">✂️ اختصار رابط جديد</h3></div>
      <div style="padding:16px;">
        <div class="form-group">
          <label>الرابط الأصلي *</label>
          <input id="sh_url" type="url" placeholder="https://...">
        </div>
        <div class="form-group">
          <label>وصف (اختياري)</label>
          <input id="sh_title" placeholder="مثال: حلقة 5 - ناروتو 720p">
        </div>
        <button class="btn btn-primary" style="width:100%" onclick="shortenUrl()">✂️ اختصر الرابط</button>
        <div id="shortenResult" style="margin-top:12px;"></div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3 class="card-title">📈 إحصائيات روابطي</h3></div>
      <div class="chart-container"><canvas id="linksChart"></canvas></div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h3 class="card-title">📋 روابطي المختصرة</h3>
      <button class="btn btn-secondary btn-sm" onclick="loadShortener()">🔄 تحديث</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>العنوان</th><th>الرابط المختصر</th><th>النقرات</th><th>التاريخ</th></tr></thead>
        <tbody>
          ${localLinks.length ? localLinks.map(l=>`
            <tr>
              <td>${l.title||'-'}</td>
              <td>
                <a href="${l.short_url}" target="_blank" style="color:var(--accent)">${l.short_url}</a>
                <button class="btn btn-sm btn-secondary" onclick="copyText('${l.short_url}')" style="margin-right:4px;">📋</button>
              </td>
              <td>👆 ${l.clicks||0}</td>
              <td style="font-size:12px">${l.created_at?.slice(0,10)}</td>
            </tr>`).join('')
            : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:40px">لا توجد روابط بعد</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;

  if (localLinks.length > 0) {
    const top = localLinks.slice(0,10);
    renderChart('linksChart','bar',
      top.map(l=>l.title||l.short_url?.split('/').pop()||'-'),
      [{ label:'النقرات', data: top.map(l=>l.clicks||0),
         backgroundColor:'rgba(108,99,255,0.7)', borderColor:'#6c63ff', borderRadius:4 }]);
  }
}

async function shortenUrl() {
  const url   = document.getElementById('sh_url').value.trim();
  const title = document.getElementById('sh_title').value.trim();
  if (!url) { toast('أدخل الرابط أولاً', 'error'); return; }

  document.getElementById('shortenResult').innerHTML = '<div class="spinner" style="margin:auto;display:block;"></div>';
  const res = await api('/shorten', 'POST', { url, title });

  if (res?.short_url || res?.short) {
    const shortUrl = res.short_url || res.short;
    document.getElementById('shortenResult').innerHTML = `
      <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;display:flex;align-items:center;gap:8px;margin-top:8px;">
        <span style="flex:1;color:var(--accent)">${shortUrl}</span>
        <button class="btn btn-primary btn-sm" onclick="copyText('${shortUrl}')">📋 نسخ</button>
      </div>`;
    toast('✅ تم اختصار الرابط');
  } else {
    document.getElementById('shortenResult').innerHTML = `<p style="color:var(--danger);margin-top:8px;">❌ فشل الاختصار — تحقق من الـ API Key</p>`;
  }
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('✅ تم النسخ'));
}

// ============================================
// SETTINGS - الإعدادات
// ============================================
async function loadSettings() {
  const settings = await api('/settings') || [];
  const s = {};
  settings.forEach(x => s[x.key] = x.value);

  document.getElementById('pageContent').innerHTML = `
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3 class="card-title">⚙️ إعدادات البوت</h3></div>
      <div style="padding:16px;">
        <div class="form-group">
          <label>رسالة الترحيب</label>
          <textarea id="s_welcome">${s.welcome_message||''}</textarea>
        </div>
        <div class="form-group">
          <label>رابط فيديو شرح تخطي الروابط</label>
          <input id="s_tutorial" value="${s.tutorial_video_url||''}" placeholder="https://t.me/...">
        </div>
        <div class="form-group">
          <label>حالة البوت</label>
          <select id="s_status">
            <option value="active"       ${s.bot_status==='active'      ?'selected':''}>✅ نشط</option>
            <option value="maintenance"  ${s.bot_status==='maintenance' ?'selected':''}>🔧 صيانة</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="saveSettings()">💾 حفظ الإعدادات</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3 class="card-title">🔧 تفعيل البوت</h3></div>
      <div style="padding:16px;">
        <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;line-height:1.8;">
          بعد رفع المشروع على Netlify، اضغط الزر أدناه لتفعيل الويب هوك وربط البوت بالسيرفر.
        </p>
        <button class="btn btn-success" onclick="setupWebhook()" style="width:100%;margin-bottom:16px;">🔗 تفعيل Webhook</button>
        <div id="webhookResult"></div>
        <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;font-size:12px;color:var(--text-muted);line-height:2;">
          <strong>متغيرات البيئة المطلوبة:</strong><br>
          TELEGRAM_BOT_TOKEN<br>
          SUPABASE_URL<br>
          SUPABASE_SERVICE_KEY<br>
          ADMIN_TOKEN<br>
          SWIFTLNX_API_KEY
        </div>
      </div>
    </div>
  </div>`;
}

async function saveSettings() {
  const updates = [
    { key: 'welcome_message',   value: document.getElementById('s_welcome').value },
    { key: 'tutorial_video_url',value: document.getElementById('s_tutorial').value },
    { key: 'bot_status',        value: document.getElementById('s_status').value }
  ];
  await Promise.all(updates.map(u => api('/settings', 'PUT', u)));
  toast('✅ تم حفظ الإعدادات');
}

// ============================================
// SETUP WEBHOOK
// ============================================
async function setupWebhook() {
  const resultEl = document.getElementById('webhookResult');
  if (resultEl) resultEl.innerHTML = '<div class="loading"><div class="spinner"></div> جاري التفعيل...</div>';

  try {
    const res = await fetch('/.netlify/functions/setup', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    const data = await res.json();

    if (data?.webhook_set?.ok) {
      toast(`✅ تم تفعيل البوت: @${data.bot_info?.username}`);
      if (resultEl) resultEl.innerHTML = `<div style="color:var(--success);padding:10px;background:rgba(107,203,119,0.1);border-radius:8px;margin-top:8px;">✅ البوت نشط: @${data.bot_info?.username}</div>`;
    } else {
      toast('⚠️ تحقق من TELEGRAM_BOT_TOKEN', 'warning');
      if (resultEl) resultEl.innerHTML = `<div style="color:var(--danger);padding:10px;background:rgba(255,107,107,0.1);border-radius:8px;margin-top:8px;">❌ ${JSON.stringify(data?.webhook_set)}</div>`;
    }
  } catch(e) {
    toast('❌ خطأ في الاتصال', 'error');
  }
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

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('dynamicModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
});

// ============================================
// DELETE
// ============================================
async function deleteItem(table, id, label, callback) {
  if (!confirm(`هل تريد حذف هذا ${label}؟ لا يمكن التراجع!`)) return;
  const res = await api(`/${table}/${id}`, 'DELETE');
  if (res?.success || res !== null) {
    toast(`✅ تم حذف ${label}`);
    if (callback) callback();
    else refreshPage();
  }
}

// ============================================
// MANAGE EPISODES SHORTCUT
// ============================================
async function manageEpisodes(contentId, title) {
  showPage('episodes');
  setTimeout(() => {
    const select = document.getElementById('seriesSelect');
    if (select) {
      select.value = contentId;
      loadSeriesEpisodes(contentId, title);
    }
  }, 600);
}

// ============================================
// INIT - تشغيل عند فتح الصفحة
// ============================================
window.addEventListener('load', () => {
  if (AUTH_TOKEN) {
    document.getElementById('loginModal').classList.remove('open');
    showPage('dashboard');
  }
});
