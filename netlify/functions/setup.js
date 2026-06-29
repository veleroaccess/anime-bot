// netlify/functions/setup.js
// Setup webhook and initial configuration

export const handler = async (event) => {
  const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const SITE_URL = process.env.URL || process.env.DEPLOY_URL;
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'anime-bot-admin-2024';
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };
  
  const auth = event.headers['authorization'] || '';
  if (auth !== `Bearer ${ADMIN_TOKEN}`) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  
  try {
    const webhookUrl = `${SITE_URL}/.netlify/functions/webhook`;
    
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, drop_pending_updates: true })
    });
    
    const data = await res.json();
    
    // Get bot info
    const botInfo = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getMe`).then(r => r.json());
    
    // Get webhook info
    const webhookInfo = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getWebhookInfo`).then(r => r.json());
    
    return {
      statusCode: 200, headers, body: JSON.stringify({
        webhook_set: data,
        bot_info: botInfo.result,
        webhook_info: webhookInfo.result
      })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
