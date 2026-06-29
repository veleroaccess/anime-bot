// netlify/functions/webhook.js
// Telegram Bot Webhook Handler

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const API_BASE = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// ============================================
// Supabase Helper
// ============================================
async function supabase(table, method = 'GET', body = null, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  const opts = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=representation'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.text();
    console.error('Supabase error:', err);
    return null;
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('json')) return res.json();
  return null;
}

// ============================================
// Telegram API Helper
// ============================================
async function tg(method, params) {
  const res = await fetch(`${API_BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return res.json();
}

async function sendMessage(chat_id, text, extra = {}) {
  return tg('sendMessage', { chat_id, text, parse_mode: 'HTML', ...extra });
}

async function editMessage(chat_id, message_id, text, extra = {}) {
  return tg('editMessageText', { chat_id, message_id, text, parse_mode: 'HTML', ...extra });
}

async function sendPhoto(chat_id, photo, caption, extra = {}) {
  return tg('sendPhoto', { chat_id, photo, caption, parse_mode: 'HTML', ...extra });
}

async function answerCallback(callback_query_id, text = '') {
  return tg('answerCallbackQuery', { callback_query_id, text });
}

// ============================================
// User Management
// ============================================
async function getOrCreateUser(telegramUser) {
  const { id, username, first_name, last_name } = telegramUser;
  
  // Check if exists
  const existing = await supabase('users', 'GET', null, `?telegram_id=eq.${id}&select=*`);
  
  if (existing && existing.length > 0) {
    // Update last active
    await supabase('users', 'PATCH', { last_active: new Date().toISOString() }, `?telegram_id=eq.${id}`);
    return existing[0];
  }
  
  // Create new user
  const newUser = await supabase('users', 'POST', {
    telegram_id: id,
    username: username || null,
    first_name: first_name || null,
    last_name: last_name || null
  });
  
  // Update daily stats
  const today = new Date().toISOString().split('T')[0];
  await supabase('bot_stats', 'POST', {
    date: today,
    new_users: 1,
    active_users: 1,
    total_messages: 1
  });
  
  return newUser ? newUser[0] : null;
}

async function logActivity(user_id, action, data = {}) {
  await supabase('activity_log', 'POST', {
    user_id,
    action,
    content_id: data.content_id || null,
    episode_id: data.episode_id || null,
    quality: data.quality || null
  });
  
  // Update daily stats
  const today = new Date().toISOString().split('T')[0];
  const existing = await supabase('bot_stats', 'GET', null, `?date=eq.${today}&select=*`);
  if (existing && existing.length > 0) {
    const stat = existing[0];
    await supabase('bot_stats', 'PATCH', {
      total_messages: stat.total_messages + 1,
      active_users: stat.active_users + 1
    }, `?date=eq.${today}`);
  } else {
    await supabase('bot_stats', 'POST', {
      date: today,
      new_users: 0,
      active_users: 1,
      total_messages: 1,
      total_downloads: 0
    });
  }
}

// ============================================
// Bot Settings
// ============================================
async function getSetting(key) {
  const res = await supabase('bot_settings', 'GET', null, `?key=eq.${key}&select=value`);
  return res && res.length > 0 ? res[0].value : null;
}

// ============================================
// Main Menu
// ============================================
async function showMainMenu(chat_id, user) {
  const welcomeMsg = await getSetting('welcome_message') || 'مرحباً بك! 🎌';
  const categories = await supabase('categories', 'GET', null, '?is_active=eq.true&order=sort_order.asc&select=*');
  
  if (!categories || categories.length === 0) {
    return sendMessage(chat_id, welcomeMsg + '\n\n⚠️ لا توجد تصنيفات متاحة حالياً.');
  }
  
  const keyboard = categories.map(cat => ([{
    text: `${cat.emoji} ${cat.name}`,
    callback_data: `cat_${cat.id}`
  }]));
  
  keyboard.push([{ text: '🔗 شرح تخطي الروابط', callback_data: 'tutorial' }]);
  
  return sendMessage(chat_id, welcomeMsg, {
    reply_markup: { inline_keyboard: keyboard }
  });
}

// ============================================
// Show Category Content
// ============================================
async function showCategory(chat_id, message_id, category_id) {
  const cat = await supabase('categories', 'GET', null, `?id=eq.${category_id}&select=*`);
  if (!cat || cat.length === 0) return;
  
  const contents = await supabase('content', 'GET', null, 
    `?category_id=eq.${category_id}&is_active=eq.true&order=title.asc&select=id,title,type,views`
  );
  
  if (!contents || contents.length === 0) {
    return editMessage(chat_id, message_id, `${cat[0].emoji} <b>${cat[0].name}</b>\n\n⚠️ لا يوجد محتوى في هذا التصنيف حالياً.`, {
      reply_markup: { inline_keyboard: [[{ text: '🔙 رجوع', callback_data: 'main_menu' }]] }
    });
  }
  
  const keyboard = contents.map(c => ([{
    text: `${c.type === 'movie' ? '🎬' : '📺'} ${c.title}`,
    callback_data: `content_${c.id}`
  }]));
  
  keyboard.push([{ text: '🔙 رجوع للقائمة الرئيسية', callback_data: 'main_menu' }]);
  
  return editMessage(chat_id, message_id, `${cat[0].emoji} <b>${cat[0].name}</b>\n\nاختر العنوان:`, {
    reply_markup: { inline_keyboard: keyboard }
  });
}

// ============================================
// Show Content (Movie or Series)
// ============================================
async function showContent(chat_id, message_id, content_id) {
  const content = await supabase('content', 'GET', null, 
    `?id=eq.${content_id}&select=*`
  );
  
  if (!content || content.length === 0) return;
  const item = content[0];
  
  // Update view count
  await supabase('content', 'PATCH', { views: item.views + 1 }, `?id=eq.${content_id}`);
  
  const keyboard = [];
  
  if (item.type === 'movie') {
    // فيلم: عرض الجودات مباشرة
    const links = await supabase('download_links', 'GET', null, 
      `?content_id=eq.${content_id}&episode_id=is.null&order=quality.asc&select=*`
    );
    
    if (links && links.length > 0) {
      const qualityRow = links.map(l => ({
        text: `📥 ${l.quality}`,
        callback_data: `dl_${l.id}`
      }));
      keyboard.push(qualityRow);
    }
    
    keyboard.push([{ text: 'ℹ️ تفاصيل الفيلم', callback_data: `details_${content_id}` }]);
    keyboard.push([{ text: '🔙 رجوع', callback_data: `cat_${item.category_id}` }]);
    
    const text = `🎬 <b>${item.title}</b>${item.title_ar ? `\n<i>${item.title_ar}</i>` : ''}\n\n اختر جودة التحميل:`;
    
    return editMessage(chat_id, message_id, text, {
      reply_markup: { inline_keyboard: keyboard }
    });
    
  } else {
    // مسلسل: عرض قائمة الحلقات
    const episodes = await supabase('episodes', 'GET', null, 
      `?content_id=eq.${content_id}&order=episode_number.asc&select=*`
    );
    
    if (!episodes || episodes.length === 0) {
      return editMessage(chat_id, message_id, `📺 <b>${item.title}</b>\n\n⚠️ لا توجد حلقات متاحة حالياً.`, {
        reply_markup: { inline_keyboard: [
          [{ text: 'ℹ️ تفاصيل المسلسل', callback_data: `details_${content_id}` }],
          [{ text: '🔙 رجوع', callback_data: `cat_${item.category_id}` }]
        ]}
      });
    }
    
    // عرض الحلقات كأزرار (5 في كل صف)
    const episodeButtons = [];
    for (let i = 0; i < episodes.length; i += 5) {
      const row = episodes.slice(i, i + 5).map(ep => ({
        text: `${ep.episode_number}`,
        callback_data: `ep_${ep.id}`
      }));
      episodeButtons.push(row);
    }
    
    keyboard.push(...episodeButtons);
    keyboard.push([{ text: 'ℹ️ تفاصيل المسلسل', callback_data: `details_${content_id}` }]);
    keyboard.push([{ text: '🔙 رجوع', callback_data: `cat_${item.category_id}` }]);
    
    const text = `📺 <b>${item.title}</b>${item.title_ar ? `\n<i>${item.title_ar}</i>` : ''}\n\n📋 عدد الحلقات: ${episodes.length}\n\nاختر رقم الحلقة:`;
    
    return editMessage(chat_id, message_id, text, {
      reply_markup: { inline_keyboard: keyboard }
    });
  }
}

// ============================================
// Show Episode Qualities
// ============================================
async function showEpisodeQualities(chat_id, message_id, episode_id) {
  const episode = await supabase('episodes', 'GET', null, `?id=eq.${episode_id}&select=*`);
  if (!episode || episode.length === 0) return;
  
  const ep = episode[0];
  const links = await supabase('download_links', 'GET', null, 
    `?episode_id=eq.${episode_id}&order=quality.asc&select=*`
  );
  
  const keyboard = [];
  
  if (links && links.length > 0) {
    const qualityRow = links.map(l => ({
      text: `📥 ${l.quality}`,
      callback_data: `dl_${l.id}`
    }));
    keyboard.push(qualityRow);
  } else {
    keyboard.push([{ text: '⚠️ لا توجد روابط', callback_data: 'no_links' }]);
  }
  
  keyboard.push([{ text: '🔙 رجوع للحلقات', callback_data: `content_${ep.content_id}` }]);
  
  return editMessage(chat_id, message_id, 
    `🎬 <b>الحلقة ${ep.episode_number}</b>${ep.title ? ` - ${ep.title}` : ''}\n\naختر جودة التحميل:`, {
    reply_markup: { inline_keyboard: keyboard }
  });
}

// ============================================
// Show Download Link
// ============================================
async function showDownloadLink(chat_id, message_id, link_id, user_id) {
  const link = await supabase('download_links', 'GET', null, 
    `?id=eq.${link_id}&select=*,content:content_id(title,type,category_id),episode:episode_id(episode_number,content_id)`
  );
  
  if (!link || link.length === 0) return;
  const l = link[0];
  
  // Update download count
  await supabase('download_links', 'PATCH', { downloads: l.downloads + 1 }, `?id=eq.${link_id}`);
  await supabase('content', 'PATCH', {}, `?id=eq.${l.content_id}`);
  
  // Log activity
  await logActivity(user_id, 'download', {
    content_id: l.content_id,
    episode_id: l.episode_id,
    quality: l.quality
  });
  
  // Update download stats
  const today = new Date().toISOString().split('T')[0];
  const stat = await supabase('bot_stats', 'GET', null, `?date=eq.${today}&select=*`);
  if (stat && stat.length > 0) {
    await supabase('bot_stats', 'PATCH', { total_downloads: stat[0].total_downloads + 1 }, `?date=eq.${today}`);
  }
  
  const tutorialUrl = await getSetting('tutorial_video_url') || 'https://t.me/';
  const downloadUrl = l.short_url || l.url;
  const contentTitle = l.content ? l.content.title : 'المحتوى';
  const backData = l.episode ? `ep_${l.episode_id}` : `content_${l.content_id}`;
  
  const keyboard = [
    [{ text: '🔗 رابط التحميل', url: downloadUrl }],
    [{ text: '📖 شرح تخطي الرابط', url: tutorialUrl }],
    [{ text: '🔙 رجوع', callback_data: backData }]
  ];
  
  const text = `✅ <b>${l.quality}</b>\n\n` +
    (l.episode ? `📺 الحلقة ${l.episode.episode_number}\n` : '') +
    `🎬 ${contentTitle}\n\n` +
    `📦 الحجم: ${l.file_size || 'غير محدد'}\n\n` +
    `اضغط على زر رابط التحميل أدناه 👇`;
  
  return editMessage(chat_id, message_id, text, {
    reply_markup: { inline_keyboard: keyboard }
  });
}

// ============================================
// Show Content Details
// ============================================
async function showDetails(chat_id, message_id, content_id) {
  const content = await supabase('content', 'GET', null, `?id=eq.${content_id}&select=*`);
  if (!content || content.length === 0) return;
  
  const item = content[0];
  const backData = item.type === 'movie' ? `content_${content_id}` : `content_${content_id}`;
  
  const tags = item.tags && item.tags.length > 0 ? item.tags.join(' • ') : 'غير محدد';
  const rating = item.rating ? `⭐ ${item.rating}/10` : '';
  const releaseDate = item.release_date ? `📅 ${item.release_date}` : '';
  
  const caption = `${item.type === 'movie' ? '🎬' : '📺'} <b>${item.title}</b>` +
    (item.title_ar ? `\n<i>${item.title_ar}</i>` : '') +
    (rating ? `\n\n${rating}` : '') +
    (releaseDate ? `\n${releaseDate}` : '') +
    (item.description ? `\n\n📝 <b>القصة:</b>\n${item.description}` : '') +
    `\n\n🏷️ <b>التصنيفات:</b> ${tags}` +
    `\n\n👁️ المشاهدات: ${item.views}`;
  
  const keyboard = [[{ text: '🔙 رجوع', callback_data: backData }]];
  
  if (item.poster_url) {
    try {
      await tg('editMessageMedia', {
        chat_id,
        message_id,
        media: { type: 'photo', media: item.poster_url, caption, parse_mode: 'HTML' },
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (e) {
      await sendPhoto(chat_id, item.poster_url, caption, { reply_markup: { inline_keyboard: keyboard } });
    }
  } else {
    return editMessage(chat_id, message_id, caption, { reply_markup: { inline_keyboard: keyboard } });
  }
}

// ============================================
// Main Handler
// ============================================
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, body: 'Bot is running!' };
  }
  
  try {
    const body = JSON.parse(event.body);
    
    // Handle callback queries
    if (body.callback_query) {
      const { id: cbId, from, message, data } = body.callback_query;
      const chat_id = message.chat.id;
      const message_id = message.message_id;
      const user_id = from.id;
      
      await answerCallback(cbId);
      await getOrCreateUser(from);
      
      if (data === 'main_menu') {
        await showMainMenu(chat_id, from);
        // Delete current message and send fresh
        await tg('deleteMessage', { chat_id, message_id });
        return { statusCode: 200, body: 'ok' };
      }
      
      if (data === 'tutorial') {
        const url = await getSetting('tutorial_video_url') || 'https://t.me/';
        await answerCallback(cbId);
        await sendMessage(chat_id, `🎬 <b>شرح تخطي الروابط المختصرة</b>\n\nاضغط الزر أدناه لمشاهدة شرح كيفية تخطي الروابط المختصرة والوصول لملفات التحميل بسهولة.`, {
          reply_markup: { inline_keyboard: [[{ text: '▶️ شاهد الشرح', url }], [{ text: '🔙 رجوع', callback_data: 'main_menu' }]] }
        });
        return { statusCode: 200, body: 'ok' };
      }
      
      if (data.startsWith('cat_')) {
        await showCategory(chat_id, message_id, data.replace('cat_', ''));
      } else if (data.startsWith('content_')) {
        await showContent(chat_id, message_id, data.replace('content_', ''));
      } else if (data.startsWith('ep_')) {
        await showEpisodeQualities(chat_id, message_id, data.replace('ep_', ''));
      } else if (data.startsWith('dl_')) {
        await showDownloadLink(chat_id, message_id, data.replace('dl_', ''), user_id);
      } else if (data.startsWith('details_')) {
        await showDetails(chat_id, message_id, data.replace('details_', ''));
      }
      
      return { statusCode: 200, body: 'ok' };
    }
    
    // Handle messages
    if (body.message) {
      const { from, chat, text } = body.message;
      await getOrCreateUser(from);
      await logActivity(from.id, 'message');
      
      if (text === '/start') {
        await showMainMenu(chat.id, from);
      } else if (text === '/menu') {
        await showMainMenu(chat.id, from);
      } else {
        await showMainMenu(chat.id, from);
      }
    }
    
    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('Webhook error:', err);
    return { statusCode: 200, body: 'ok' };
  }
};
