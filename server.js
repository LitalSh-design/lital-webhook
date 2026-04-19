const express = require('express');
const https = require('https');
const app = express();
app.use(express.json());

// ── הגדרות ──
const VERIFY_TOKEN   = 'lital_webhook_secret_2024';
// טוקן ישן - לקריאת תגובות (Facebook Graph API)
const OLD_TOKEN      = 'EAFzIcbecZBb0BRFoIxvLHL2ZAxrNlB4D8QBArecmzePtVkXkrZBJjgt3ZBj0XJFS8XwOBHYioZBmzjcOr3raOTHzZCnV8G1bongfmvQZCCwlZCNINSXNW69NgcwgBZB2suR0lEKlrieSbqzsvohEPTy8wMZCBZCUZBtBPQuZAM7dqDMldJs3pSZCpeAiWVcKZBvlsZCYftPwUWZCVTxJSyXbcKZBZCcrdxYDhOn4VU6YA1SnEcl';
// טוקן חדש - לשליחת DM (Instagram API)
const IG_TOKEN       = 'IGAAM1zaZCpblFBZAGE0YURidFVPOTRPeWUyM1Y0N2lBMlRsR0tIOFdFMXppN25BVG90ZA1hfcW9ySzllbWlock1jY2lSa19HRzZA2OTk4SXBGMFBhcHN6aHhwaWd4TG96ZAmlUamJPWVdUVDJ0M2QxVjh1NHJWOWlXVHV3RUVpakN5YwZDZD';
const OLD_IG_ID      = '17841406844210220'; // לקריאת מדיה ותגובות
const NEW_IG_ID      = '34923777137270567'; // לשליחת DM
const TRIGGER_WORD   = 'אוכל אותי';
const POLL_MS        = 2 * 60 * 1000;

const PUBLIC_REPLIES = [
  'שולחת לך לפרטי 💌',
  'אצלך ב-DM ❤️',
  'אלופה, אצלך בפרטי 🤍',
  'שלחתי לך הודעה פרטית 💌',
  'אצלך בפרטי עכשיו ❤️',
];

const LANDING_PAGE = 'https://lrs.ravpage.co.il/%D7%A4%D7%A8%D7%98%D7%99%D7%9D%20%D7%A9%D7%99%D7%97%D7%AA%20%D7%94%D7%AA%D7%90%D7%9E%D7%94';

const DM_TEXT = `הי, כאן ליטל שחר ❤️

כיף שהגעת.

אם הרגשת שזה מדבר אלייך - זה לא במקרה.

השארתי לך כאן משהו קטן שיעזור לך להבין מה באמת אוכל אותך:
👉 ${LANDING_PAGE}

אוהבת ליטל 🤍`;

const processedComments = new Set();

function randomReply() {
  return PUBLIC_REPLIES[Math.floor(Math.random() * PUBLIC_REPLIES.length)];
}

// GET עם Facebook Graph API
function fbGet(path) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    https.get(`https://graph.facebook.com/v19.0${path}${sep}access_token=${OLD_TOKEN}`, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
    }).on('error', reject);
  });
}

// POST עם Facebook Graph API (תגובה ציבורית)
function fbPost(endpoint, params) {
  const body = JSON.stringify({ ...params, access_token: OLD_TOKEN });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'graph.facebook.com',
      path: '/v19.0' + endpoint,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// POST עם Instagram API (DM)
function igPost(endpoint, params) {
  const body = JSON.stringify({ ...params, access_token: IG_TOKEN });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'graph.instagram.com',
      path: '/v21.0' + endpoint,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function replyToComment(commentId, text) {
  const result = await fbPost(`/${commentId}/replies`, { message: text });
  if (result.error) console.error('שגיאה בתגובה ציבורית:', result.error.message);
  else console.log('✓ תגובה ציבורית נשלחה');
}

async function sendDM(commentId, text) {
  const result = await igPost(`/${NEW_IG_ID}/messages`, {
    recipient: { comment_id: commentId },
    message: { text },
  });
  if (result.error) console.error('שגיאה ב-DM:', result.error.message);
  else console.log('✓ DM נשלח! message_id:', result.message_id);
}

async function pollComments() {
  try {
    const cutoff = Date.now() - 5 * 60 * 1000;
    const media = await fbGet(`/${OLD_IG_ID}/media?fields=id&limit=10`);
    if (!media.data) return;

    for (const post of media.data) {
      const comments = await fbGet(`/${post.id}/comments?fields=id,text,from,timestamp`);
      if (!comments.data) continue;

      for (const comment of comments.data) {
        if (processedComments.has(comment.id)) continue;
        processedComments.add(comment.id);

        const text = (comment.text || '').trim();
        const age = Date.now() - new Date(comment.timestamp).getTime();
        if (age > 5 * 60 * 1000) continue;
        if (!text.includes(TRIGGER_WORD)) continue;

        console.log(`🎯 טריגר! "${text}" מ-${comment.from?.username}`);
        await replyToComment(comment.id, randomReply());
        await sendDM(comment.id, DM_TEXT);
      }
    }
  } catch(e) {
    console.error('שגיאה בסריקה:', e.message);
  }
}

async function initProcessed() {
  try {
    const cutoff = Date.now() - 5 * 60 * 1000;
    const media = await fbGet(`/${OLD_IG_ID}/media?fields=id&limit=10`);
    if (!media.data) return;
    for (const post of media.data) {
      const comments = await fbGet(`/${post.id}/comments?fields=id,timestamp`);
      if (!comments.data) continue;
      comments.data.forEach(c => {
        if (new Date(c.timestamp).getTime() < cutoff) processedComments.add(c.id);
      });
    }
    console.log(`אתחול: ${processedComments.size} תגובות ישנות סומנו`);
  } catch(e) {
    console.error('שגיאה באתחול:', e.message);
  }
}

app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN)
    res.status(200).send(req.query['hub.challenge']);
  else res.sendStatus(403);
});

app.post('/webhook', (req, res) => res.sendStatus(200));

app.get('/', async (req, res) => {
  res.send('Lital Webhook Server - פועל ✓');
  await pollComments();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`שרת פועל על פורט ${PORT}`);
  await initProcessed();
  setInterval(pollComments, POLL_MS);
});
