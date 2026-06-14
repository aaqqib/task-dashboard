import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@vercel/kv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_PATH = path.join(__dirname, '../data/db.json');

const app = express();
app.use(express.json());

// Serve static assets in production
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Database Integration
const defaultDB = {
  tasks: [],
  config: {
    telegramToken: '',
    authorizedChatId: '',
    authorizedUsername: '',
    digestEnabled: false,
    digestTimes: ['09:00', '20:00']
  }
};

const getKvEnv = () => {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return { url, token };
};

const isKvConfigured = () => {
  const { url, token } = getKvEnv();
  return !!(url && token);
};

let kvClient = null;
if (isKvConfigured()) {
  const { url, token } = getKvEnv();
  kvClient = createClient({
    url,
    token,
  });
}

const ensureLocalDir = () => {
  const dir = path.dirname(LOCAL_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

async function getDB() {
  if (kvClient) {
    try {
      const data = await kvClient.get('dashboard_db');
      return data || defaultDB;
    } catch (e) {
      console.error('KV get error, falling back:', e);
      return defaultDB;
    }
  } else {
    ensureLocalDir();
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(defaultDB, null, 2));
      return defaultDB;
    }
    try {
      const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('Error reading local db:', err);
      return defaultDB;
    }
  }
}

async function saveDB(data) {
  if (kvClient) {
    await kvClient.set('dashboard_db', data);
  } else {
    ensureLocalDir();
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
  }
}

// API Routes
app.get('/api/tasks', async (req, res) => {
  try {
    const db = await getDB();
    res.json(db.tasks);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { text, status } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });

    const db = await getDB();
    const newTask = {
      id: 'task_' + Math.random().toString(36).substr(2, 9),
      text,
      status: status || 'inbox',
      createdAt: new Date().toISOString()
    };
    db.tasks.push(newTask);
    await saveDB(db);
    res.status(201).json(newTask);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, status } = req.body;
    const db = await getDB();
    
    let updatedTask = null;
    db.tasks = db.tasks.map(t => {
      if (t.id === id) {
        updatedTask = { 
          ...t, 
          text: text !== undefined ? text : t.text,
          status: status !== undefined ? status : t.status,
          completedAt: status === 'done' ? new Date().toISOString() : t.completedAt
        };
        return updatedTask;
      }
      return t;
    });

    if (!updatedTask) return res.status(404).json({ error: 'Task not found' });
    
    await saveDB(db);
    res.json(updatedTask);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDB();
    
    const initialLength = db.tasks.length;
    db.tasks = db.tasks.filter(t => t.id !== id);

    if (db.tasks.length === initialLength) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await saveDB(db);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/config', async (req, res) => {
  try {
    const db = await getDB();
    res.json(db.config);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const newConfig = req.body;
    const db = await getDB();
    
    const oldToken = db.config.telegramToken;
    db.config = { ...db.config, ...newConfig };
    await saveDB(db);
    
    if (newConfig.telegramToken !== undefined && newConfig.telegramToken !== oldToken && !process.env.VERCEL) {
      stopPolling();
      if (db.config.telegramToken) {
        startPolling();
      }
    }

    res.json(db.config);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/telegram/set-webhook', async (req, res) => {
  const { url } = req.body;
  const db = await getDB();
  const token = db.config.telegramToken;

  if (!token) {
    return res.status(400).json({ error: 'Telegram Bot Token not configured' });
  }

  try {
    if (!url) {
      const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=`);
      const d = await r.json();
      stopPolling();
      startPolling();
      return res.json({ success: true, result: d, mode: 'polling' });
    } else {
      stopPolling();
      const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(url)}`);
      const d = await r.json();
      return res.json({ success: true, result: d, mode: 'webhook' });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/telegram/status', async (req, res) => {
  const db = await getDB();
  res.json({
    tokenConfigured: !!db.config.telegramToken,
    chatIdConfigured: !!db.config.authorizedChatId,
    mode: isPolling ? 'polling' : 'webhook/inactive',
    isKv: !!kvClient
  });
});

app.post('/api/telegram/test', async (req, res) => {
  const db = await getDB();
  const { telegramToken, authorizedChatId } = db.config;
  if (!telegramToken || !authorizedChatId) {
    return res.status(400).json({ error: 'Token and Chat ID must be configured' });
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: authorizedChatId,
        text: '🔔 <b>Connection Test!</b>\n\nYour dashboard is connected successfully to your Telegram bot. Nice job!',
        parse_mode: 'HTML'
      })
    });
    const d = await r.json();
    res.json(d);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/webhook', async (req, res) => {
  try {
    const update = req.body;
    await handleTelegramUpdate(update);
    res.sendStatus(200);
  } catch (e) {
    console.error('Webhook error:', e);
    res.sendStatus(200);
  }
});

app.get('/api/cron/digest', async (req, res) => {
  try {
    const db = await getDB();
    const { telegramToken, authorizedChatId, digestEnabled } = db.config;
    if (!digestEnabled || !telegramToken || !authorizedChatId) {
      return res.status(400).json({ error: 'Digest not configured or enabled' });
    }
    
    const activeTasks = db.tasks.filter(t => t.status !== 'done');
    const today = activeTasks.filter(t => t.status === 'today');
    const week = activeTasks.filter(t => t.status === 'week');
    const inbox = activeTasks.filter(t => t.status === 'inbox' || !t.status);

    let msg = `🌅 <b>Scheduled Task Digest:</b>\n\n`;
    if (today.length > 0) {
      msg += `<b>📅 Today (${today.length}):</b>\n` + today.map(t => `• ${t.text}`).join('\n') + `\n\n`;
    }
    if (week.length > 0) {
      msg += `<b>📆 This Week (${week.length}):</b>\n` + week.map(t => `• ${t.text}`).join('\n') + `\n\n`;
    }
    if (inbox.length > 0) {
      msg += `<b>📥 Inbox (${inbox.length}):</b>\n` + inbox.map(t => `• ${t.text}`).join('\n') + `\n\n`;
    }
    
    if (activeTasks.length === 0) {
      msg = `🌅 <b>Scheduled Task Digest:</b> All caught up! No active tasks.`;
    } else {
      msg += `Send /list to manage your tasks.`;
    }
    
    await sendTelegramMessage(telegramToken, authorizedChatId, msg);
    res.json({ success: true, message: 'Digest sent' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

if (fs.existsSync(distPath)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start Server
let isPolling = false;
let lastUpdateId = 0;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startPolling();
  });
  
  let lastDigestSentTimeStr = '';
  setInterval(async () => {
    try {
      const db = await getDB();
      const { digestEnabled, digestTimes } = db.config;
      if (!digestEnabled) return;
      
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${hours}:${minutes}`;

      if (digestTimes.includes(currentTimeStr)) {
        if (lastDigestSentTimeStr === currentTimeStr) return;
        lastDigestSentTimeStr = currentTimeStr;
        
        const { telegramToken, authorizedChatId } = db.config;
        if (!telegramToken || !authorizedChatId) return;
        
        console.log(`Sending daily digest locally for time: ${currentTimeStr}`);
        
        const activeTasks = db.tasks.filter(t => t.status !== 'done');
        const today = activeTasks.filter(t => t.status === 'today');
        const week = activeTasks.filter(t => t.status === 'week');
        const inbox = activeTasks.filter(t => t.status === 'inbox' || !t.status);

        let msg = `🌅 <b>Your Daily Tasks Summary:</b>\n\n`;
        if (today.length > 0) {
          msg += `<b>📅 Today (${today.length}):</b>\n` + today.map(t => `• ${t.text}`).join('\n') + `\n\n`;
        }
        if (week.length > 0) {
          msg += `<b>📆 This Week (${week.length}):</b>\n` + week.map(t => `• ${t.text}`).join('\n') + `\n\n`;
        }
        if (inbox.length > 0) {
          msg += `<b>📥 Inbox (${inbox.length}):</b>\n` + inbox.map(t => `• ${t.text}`).join('\n') + `\n\n`;
        }

        if (activeTasks.length === 0) {
          msg = `🌅 <b>Your Daily Tasks Summary:</b> No active tasks today! Enjoy your day! 🎉`;
        } else {
          msg += `Keep up the good work! Send /list to view details or manage tasks.`;
        }

        await sendTelegramMessage(telegramToken, authorizedChatId, msg);
      }
    } catch (e) {
      console.error('Error running local digest cron:', e);
    }
  }, 30000);
}

async function handleTelegramUpdate(update) {
  if (!update.message) return;
  const { chat, text } = update.message;
  if (!text) return;
  
  const trimmedText = text.trim();
  const db = await getDB();
  const token = db.config.telegramToken;
  if (!token) return;

  const reply = async (msgText) => {
    await sendTelegramMessage(token, chat.id, msgText);
  };

  const authChatId = String(db.config.authorizedChatId);
  if (!authChatId) {
    if (trimmedText === '/start') {
      await reply(`👋 Hello! Welcome to your personal task bot.\n\nTo pair this bot with your dashboard, copy your Chat ID below and paste it in the dashboard Settings under <b>Authorized Chat ID</b>:\n\n<code>${chat.id}</code>`);
    } else {
      await reply(`⚠️ This bot is not paired with a dashboard yet.\n\nYour Chat ID is: <code>${chat.id}</code>\n\nPlease enter this Chat ID in your dashboard Settings to authorize commands.`);
    }
    return;
  }

  if (String(chat.id) !== authChatId) {
    await reply(`🔒 Unauthorized. Only the owner can use this bot.`);
    return;
  }

  if (trimmedText.startsWith('/start')) {
    await reply(`👋 <b>Task Dashboard Connected!</b>\n\nYou can manage your tasks directly from here using the following commands:\n\n• Just send any text to add a task to your <b>Inbox</b> 📥\n• <code>/today &lt;task&gt;</code> - Add task to <b>Today</b> 📅\n• <code>/week &lt;task&gt;</code> - Add task to <b>This Week</b> 📆\n• <code>/later &lt;task&gt;</code> - Add task to <b>Later</b> ⏳\n• <code>/list</code> - List all active tasks\n• <code>/done &lt;task number&gt;</code> - Complete a task`);
    return;
  }

  if (trimmedText.startsWith('/list')) {
    const activeTasks = db.tasks.filter(t => t.status !== 'done');
    if (activeTasks.length === 0) {
      await reply(`🎉 <b>No active tasks!</b> You are all caught up.`);
      return;
    }
    
    const inbox = activeTasks.filter(t => t.status === 'inbox' || !t.status);
    const today = activeTasks.filter(t => t.status === 'today');
    const week = activeTasks.filter(t => t.status === 'week');
    const later = activeTasks.filter(t => t.status === 'later');
    
    let listMsg = `📋 <b>Your Active Tasks:</b>\n\n`;
    let count = 1;
    
    const appendSection = (title, items) => {
      if (items.length === 0) return;
      listMsg += `<b>${title} (${items.length}):</b>\n`;
      items.forEach(t => {
        listMsg += `${count}. ${t.text}\n`;
        count++;
      });
      listMsg += `\n`;
    };
    
    appendSection('📥 Inbox', inbox);
    appendSection('📅 Today', today);
    appendSection('📆 This Week', week);
    appendSection('⏳ Later', later);
    
    listMsg += `<i>Complete a task using /done &lt;number&gt; (e.g. /done 1)</i>`;
    await reply(listMsg);
    return;
  }

  if (trimmedText.startsWith('/done')) {
    const parts = trimmedText.split(' ');
    if (parts.length < 2) {
      await reply(`⚠️ Usage: <code>/done &lt;number&gt;</code>. Send <code>/list</code> first to see task numbers.`);
      return;
    }
    const num = parseInt(parts[1], 10);
    if (isNaN(num) || num < 1) {
      await reply(`⚠️ Invalid number. Use <code>/done &lt;number&gt;</code>.`);
      return;
    }
    
    const activeTasks = db.tasks.filter(t => t.status !== 'done');
    const inbox = activeTasks.filter(t => t.status === 'inbox' || !t.status);
    const today = activeTasks.filter(t => t.status === 'today');
    const week = activeTasks.filter(t => t.status === 'week');
    const later = activeTasks.filter(t => t.status === 'later');
    
    const flatList = [...inbox, ...today, ...week, ...later];
    if (num > flatList.length) {
      await reply(`⚠️ Task number ${num} not found. You only have ${flatList.length} active tasks.`);
      return;
    }
    
    const targetTask = flatList[num - 1];
    db.tasks = db.tasks.map(t => {
      if (t.id === targetTask.id) {
        return { ...t, status: 'done', completedAt: new Date().toISOString() };
      }
      return t;
    });
    
    await saveDB(db);
    await reply(`✅ Completed: <b>"${targetTask.text}"</b>`);
    return;
  }

  if (trimmedText.startsWith('/today')) {
    const taskText = trimmedText.substring(6).trim();
    if (!taskText) {
      await reply(`⚠️ Usage: <code>/today Buy milk</code>`);
      return;
    }
    const newTask = {
      id: 'task_' + Math.random().toString(36).substr(2, 9),
      text: taskText,
      status: 'today',
      createdAt: new Date().toISOString()
    };
    db.tasks.push(newTask);
    await saveDB(db);
    await reply(`📅 Added to Today: <b>"${taskText}"</b>`);
    return;
  }

  if (trimmedText.startsWith('/week')) {
    const taskText = trimmedText.substring(5).trim();
    if (!taskText) {
      await reply(`⚠️ Usage: <code>/week Finish paper</code>`);
      return;
    }
    const newTask = {
      id: 'task_' + Math.random().toString(36).substr(2, 9),
      text: taskText,
      status: 'week',
      createdAt: new Date().toISOString()
    };
    db.tasks.push(newTask);
    await saveDB(db);
    await reply(`📆 Added to This Week: <b>"${taskText}"</b>`);
    return;
  }

  if (trimmedText.startsWith('/later')) {
    const taskText = trimmedText.substring(6).trim();
    if (!taskText) {
      await reply(`⚠️ Usage: <code>/later Plan trip</code>`);
      return;
    }
    const newTask = {
      id: 'task_' + Math.random().toString(36).substr(2, 9),
      text: taskText,
      status: 'later',
      createdAt: new Date().toISOString()
    };
    db.tasks.push(newTask);
    await saveDB(db);
    await reply(`⏳ Added to Later: <b>"${taskText}"</b>`);
    return;
  }

  // Raw text -> Inbox
  const newTask = {
    id: 'task_' + Math.random().toString(36).substr(2, 9),
    text: trimmedText,
    status: 'inbox',
    createdAt: new Date().toISOString()
  };
  db.tasks.push(newTask);
  await saveDB(db);
  await reply(`📥 Added to Inbox: <b>"${trimmedText}"</b>`);
}

async function sendTelegramMessage(token, chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
  } catch (e) {
    console.error('Failed to send telegram message:', e);
  }
}

async function startPolling() {
  if (isPolling) return;
  const db = await getDB();
  const token = db.config.telegramToken;
  if (!token) return;

  isPolling = true;
  console.log('Telegram Bot Polling started.');
  
  try {
    await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=`);
  } catch (e) {
    console.error('Error clearing webhook:', e);
  }

  pollLoop();
}

async function pollLoop() {
  if (!isPolling) return;
  const db = await getDB();
  const token = db.config.telegramToken;
  if (!token) {
    isPolling = false;
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          await handleTelegramUpdate(update);
        }
      }
    } else {
      await new Promise(r => setTimeout(r, 5000));
    }
  } catch (e) {
    await new Promise(r => setTimeout(r, 5000));
  }

  if (isPolling) {
    pollLoop();
  }
}

function stopPolling() {
  isPolling = false;
  console.log('Telegram Bot Polling stopped.');
}

export default app;
