// netlify/functions/admin-api.js
// Admin Dashboard API

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'anime-bot-admin-2024';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SWIFTLNX_KEY = process.env.SWIFTLNX_API_KEY || 'bb004ba55a1b965b3e5e8b46466a66d06fa7775d';
const SWIFTLNX_BASE = 'https://swiftlnx.com/api';

// ============================================
// Supabase Helper
// ============================================
async function sb(table, method = 'GET', body = null, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const opts = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('json')) return res.json();
  return [];
}

// ============================================
// Auth Check
// ============================================
function checkAuth(headers) {
  const auth = headers['authorization'] || headers['Authorization'] || '';
  return auth === `Bearer ${ADMIN_TOKEN}`;
}

// ============================================
// Route Handler
// ============================================
export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  if (!checkAuth(event.headers)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  
  const path = event.path.replace('/.netlify/functions/admin-api', '').replace('/api/admin-api', '');
  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : {};
  const params = event.queryStringParameters || {};
  
  try {
    // ==================== DASHBOARD STATS ====================
    if (path === '/stats' || path === '/stats/') {
      const [users, content, categories, episodes, links, stats, recentActivity] = await Promise.all([
        sb('users', 'GET', null, '?select=id,joined_at,last_active'),
        sb('content', 'GET', null, '?select=id,type,views,downloads,created_at'),
        sb('categories', 'GET', null, '?select=id,name'),
        sb('episodes', 'GET', null, '?select=id,content_id'),
        sb('download_links', 'GET', null, '?select=id,quality,downloads'),
        sb('bot_stats', 'GET', null, '?order=date.desc&limit=30&select=*'),
        sb('activity_log', 'GET', null, '?order=created_at.desc&limit=10&select=*')
      ]);
      
      const totalDownloads = links.reduce((s, l) => s + (l.downloads || 0), 0);
      const totalViews = content.reduce((s, c) => s + (c.views || 0), 0);
      const movies = content.filter(c => c.type === 'movie').length;
      const series = content.filter(c => c.type === 'series').length;
      
      // Quality distribution
      const qualityDist = {};
      links.forEach(l => { qualityDist[l.quality] = (qualityDist[l.quality] || 0) + 1; });
      
      // Top content
      const topContent = await sb('content', 'GET', null, '?order=views.desc&limit=5&select=id,title,type,views,downloads');
      
      return {
        statusCode: 200, headers, body: JSON.stringify({
          overview: {
            total_users: users.length,
            total_content: content.length,
            total_movies: movies,
            total_series: series,
            total_categories: categories.length,
            total_episodes: episodes.length,
            total_links: links.length,
            total_downloads: totalDownloads,
            total_views: totalViews
          },
          daily_stats: stats,
          quality_distribution: qualityDist,
          top_content: topContent,
          recent_activity: recentActivity
        })
      };
    }
    
    // ==================== CATEGORIES ====================
    if (path === '/categories') {
      if (method === 'GET') {
        const cats = await sb('categories', 'GET', null, '?order=sort_order.asc&select=*');
        return { statusCode: 200, headers, body: JSON.stringify(cats) };
      }
      if (method === 'POST') {
        const cat = await sb('categories', 'POST', body);
        return { statusCode: 200, headers, body: JSON.stringify(cat) };
      }
    }
    
    if (path.startsWith('/categories/')) {
      const id = path.split('/')[2];
      if (method === 'PUT') {
        const cat = await sb('categories', 'PATCH', body, `?id=eq.${id}`);
        return { statusCode: 200, headers, body: JSON.stringify(cat) };
      }
      if (method === 'DELETE') {
        await sb('categories', 'DELETE', null, `?id=eq.${id}`);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }
    
    // ==================== CONTENT ====================
    if (path === '/content') {
      if (method === 'GET') {
        const page = parseInt(params.page) || 1;
        const limit = parseInt(params.limit) || 20;
        const offset = (page - 1) * limit;
        const type = params.type || '';
        const cat = params.category || '';
        
        let query = `?order=created_at.desc&limit=${limit}&offset=${offset}&select=*,categories(name,emoji)`;
        if (type) query += `&type=eq.${type}`;
        if (cat) query += `&category_id=eq.${cat}`;
        
        const items = await sb('content', 'GET', null, query);
        return { statusCode: 200, headers, body: JSON.stringify(items) };
      }
      if (method === 'POST') {
        const item = await sb('content', 'POST', { ...body, updated_at: new Date().toISOString() });
        return { statusCode: 200, headers, body: JSON.stringify(item) };
      }
    }
    
    if (path.startsWith('/content/')) {
      const id = path.split('/')[2];
      if (method === 'GET') {
        const item = await sb('content', 'GET', null, `?id=eq.${id}&select=*`);
        return { statusCode: 200, headers, body: JSON.stringify(item[0] || null) };
      }
      if (method === 'PUT') {
        const item = await sb('content', 'PATCH', { ...body, updated_at: new Date().toISOString() }, `?id=eq.${id}`);
        return { statusCode: 200, headers, body: JSON.stringify(item) };
      }
      if (method === 'DELETE') {
        await sb('content', 'DELETE', null, `?id=eq.${id}`);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }
    
    // ==================== EPISODES ====================
    if (path === '/episodes') {
      if (method === 'GET') {
        const content_id = params.content_id;
        const query = content_id
          ? `?content_id=eq.${content_id}&order=episode_number.asc&select=*`
          : '?order=created_at.desc&limit=50&select=*';
        const eps = await sb('episodes', 'GET', null, query);
        return { statusCode: 200, headers, body: JSON.stringify(eps) };
      }
      if (method === 'POST') {
        const ep = await sb('episodes', 'POST', body);
        return { statusCode: 200, headers, body: JSON.stringify(ep) };
      }
    }
    
    if (path.startsWith('/episodes/')) {
      const id = path.split('/')[2];
      if (method === 'PUT') {
        const ep = await sb('episodes', 'PATCH', body, `?id=eq.${id}`);
        return { statusCode: 200, headers, body: JSON.stringify(ep) };
      }
      if (method === 'DELETE') {
        await sb('episodes', 'DELETE', null, `?id=eq.${id}`);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }
    
    // ==================== LINKS ====================
    if (path === '/links') {
      if (method === 'GET') {
        const content_id = params.content_id;
        const episode_id = params.episode_id;
        let query = '?order=created_at.desc&select=*';
        if (episode_id) query += `&episode_id=eq.${episode_id}`;
        else if (content_id) query += `&content_id=eq.${content_id}&episode_id=is.null`;
        const lnks = await sb('download_links', 'GET', null, query);
        return { statusCode: 200, headers, body: JSON.stringify(lnks) };
      }
      if (method === 'POST') {
        const lnk = await sb('download_links', 'POST', body);
        return { statusCode: 200, headers, body: JSON.stringify(lnk) };
      }
    }
    
    if (path.startsWith('/links/')) {
      const id = path.split('/')[2];
      if (method === 'PUT') {
        const lnk = await sb('download_links', 'PATCH', body, `?id=eq.${id}`);
        return { statusCode: 200, headers, body: JSON.stringify(lnk) };
      }
      if (method === 'DELETE') {
        await sb('download_links', 'DELETE', null, `?id=eq.${id}`);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }
    
    // ==================== USERS ====================
    if (path === '/users') {
      const page = parseInt(params.page) || 1;
      const limit = parseInt(params.limit) || 50;
      const offset = (page - 1) * limit;
      const users = await sb('users', 'GET', null, `?order=joined_at.desc&limit=${limit}&offset=${offset}&select=*`);
      return { statusCode: 200, headers, body: JSON.stringify(users) };
    }
    
    if (path.startsWith('/users/') && path.endsWith('/block')) {
      const id = path.split('/')[2];
      const user = await sb('users', 'GET', null, `?telegram_id=eq.${id}&select=is_blocked`);
      if (user.length > 0) {
        await sb('users', 'PATCH', { is_blocked: !user[0].is_blocked }, `?telegram_id=eq.${id}`);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    
    // ==================== SETTINGS ====================
    if (path === '/settings') {
      if (method === 'GET') {
        const settings = await sb('bot_settings', 'GET', null, '?select=*');
        return { statusCode: 200, headers, body: JSON.stringify(settings) };
      }
      if (method === 'PUT') {
        const { key, value } = body;
        await sb('bot_settings', 'PATCH', { value, updated_at: new Date().toISOString() }, `?key=eq.${key}`);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }
    
    // ==================== BROADCAST ====================
    if (path === '/broadcast' && method === 'POST') {
      const { message, preview_only } = body;
      const users = await sb('users', 'GET', null, '?is_blocked=eq.false&select=telegram_id');
      
      if (preview_only) {
        return { statusCode: 200, headers, body: JSON.stringify({ preview: message, users_count: users.length }) };
      }
      
      let sent = 0, failed = 0;
      for (const user of users.slice(0, 100)) { // limit to 100 for safety
        try {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: user.telegram_id, text: message, parse_mode: 'HTML' })
          });
          sent++;
          await new Promise(r => setTimeout(r, 50));
        } catch { failed++; }
      }
      
      return { statusCode: 200, headers, body: JSON.stringify({ sent, failed, total: users.length }) };
    }
    
    // ==================== SWIFTLNX API ====================
    if (path === '/shorten' && method === 'POST') {
      const { url, title } = body;
      
      const res = await fetch(`${SWIFTLNX_BASE}/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SWIFTLNX_KEY}` },
        body: JSON.stringify({ url, title })
      });
      const data = await res.json();
      
      if (data.short_url || data.shortenedUrl || data.short) {
        const shortUrl = data.short_url || data.shortenedUrl || data.short;
        await sb('short_links', 'POST', {
          original_url: url,
          short_url: shortUrl,
          short_code: data.code || data.alias || null,
          title: title || null,
          clicks: 0
        });
        return { statusCode: 200, headers, body: JSON.stringify({ short_url: shortUrl, ...data }) };
      }
      
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }
    
    if (path === '/shorten/list') {
      const [localLinks, apiLinks] = await Promise.all([
        sb('short_links', 'GET', null, '?order=created_at.desc&select=*'),
        fetch(`${SWIFTLNX_BASE}/links`, {
          headers: { 'Authorization': `Bearer ${SWIFTLNX_KEY}` }
        }).then(r => r.json()).catch(() => ({ data: [] }))
      ]);
      
      return { statusCode: 200, headers, body: JSON.stringify({ local: localLinks, api: apiLinks }) };
    }
    
    if (path === '/shorten/stats') {
      const res = await fetch(`${SWIFTLNX_BASE}/stats`, {
        headers: { 'Authorization': `Bearer ${SWIFTLNX_KEY}` }
      });
      const data = await res.json();
      const local = await sb('short_links', 'GET', null, '?select=*');
      const totalClicks = local.reduce((s, l) => s + (l.clicks || 0), 0);
      
      return { statusCode: 200, headers, body: JSON.stringify({ ...data, local_links: local.length, local_total_clicks: totalClicks }) };
    }
    
    if (path === '/shorten/webhook' && method === 'POST') {
      // Handle swiftlnx webhook for click tracking
      const { code, clicks } = body;
      if (code) {
        await sb('short_links', 'PATCH', { clicks: clicks || 0 }, `?short_code=eq.${code}`);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }
    
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
    
  } catch (err) {
    console.error('Admin API error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
