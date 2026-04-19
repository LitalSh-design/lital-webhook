const express = require('express');
const https = require('https');
const app = express();
app.use(express.json());

// ── הגדרות ──
const VERIFY_TOKEN   = 'lital_webhook_secret_2024';
const PAGE_TOKEN     = 'EAFzIcbecZBb0BRFoIxvLHL2ZAxrNlB4D8QBArecmzePtVkXkrZBJjgt3ZBj0XJFS8XwOBHYioZBmzjcOr3raOTHzZCnV8G1bongfmvQZCCwlZCNINSXNW69NgcwgBZB2suR0lEKlrieSbqzsvohEPTy8wMZCBZCUZBtBPQuZAM7dqDMldJs3pSZCpeAiWVcKZBvlsZCYftPwUWZCVTxJSyXbcKZBZCcrdxYDhOn4VU6YA1SnEcl';
const IG_ID          = '17841406844210220';
const TRIGGER_WORD   = 'אוכל אותי';

// תגובות ציבוריות - נבחרת רנדומלית בכל פעם
const PUBLIC_REPLIES = [
  'שולחת לך לפרטי 💌',
  'אצלך ב-DM ❤️',
  'אלופה, אצלך בפרטי 🤍',
  'שלחתי לך הודעה פרטית 💌',
  'אצלך בפרטי עכשיו ❤️',
];

function randomReply() {
  return PUBLIC_REPLIES[Math.floor(Math.random() * PUBLIC_REPLIES.length)];
}

// הודעת DM
const LANDING_PAGE = 'https://lrs.ravpage.co.il/%D7%A4%D7%A8%D7%98%D7%99%D7%9D%20%D7%A9%D7%99%D7%97%D7%AA%20%D7%94%D7%AA%D7%90%D7%9E%D7%94';

const DM_TEXT = `הי, כאן ליטל שחר ❤️

כיף שהגעת.

אם הרגשת שזה מדבר אלייך - זה לא במקרה.

השארתי לך כאן משהו קטן שיעזור לך להבין מה באמת אוכל אותך:
👉 ${LANDING_PAGE}

אוהבת ליטל 🤍`;

// ── POST לגרף API ──
function apiPost(endpoint, params) {
  const body = JSON.stringify({ ...params, access_token: PAGE_TOKEN });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'graph.facebook.com',
      path: '/v19.0' + endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(d); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── תגובה ציבורית על תגובה ──
async function replyToComment(commentId, text) {
  const result = await apiPost(`/${commentId}/replies`, { message: text });
  if (result.error) console.error('שגיאה בתגובה ציבורית:', result.error.message);
  else console.log('✓ תגובה ציבורית נשלחה');
  return result;
}

// ── שליחת DM ──
async function sendDM(userId, text) {
  const result = await apiPost(`/${IG_ID}/messages`, {
    recipient: { id: userId },
    message: { text },
  });
  if (result.error) console.error('שגיאה ב-DM:', result.error.message);
  else console.log('✓ DM נשלח ל-', userId);
  return result;
}

// ── אימות Webhook (GET) ──
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✓ Webhook אומת');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ── קבלת אירועי Webhook (POST) ──
app.post('/webhook', async (req, res) => {
  // תמיד להחזיר 200 מיד - Meta מצפה לתגובה תוך 20 שניות
  res.sendStatus(200);

  const body = req.body;
  if (body.object !== 'instagram') return;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'comments') continue;

      const comment = change.value;
      const text    = (comment.text || '').trim();

      console.log(`תגובה חדשה: "${text}" מ-${comment.from?.username || 'unknown'}`);

      if (text.includes(TRIGGER_WORD)) {
        console.log('🎯 מילת טריגר זוהתה!');
        const commentId  = comment.id;
        const commenterId = comment.from?.id;

        // 1. תגובה ציבורית (רנדומלית)
        await replyToComment(commentId, randomReply());

        // 2. DM
        if (commenterId) {
          await sendDM(commenterId, DM_TEXT);
        } else {
          console.warn('לא נמצא ID של המגיב - לא ניתן לשלוח DM');
        }
      }
    }
  }
});

// ── בדיקת חיים ──
app.get('/', (req, res) => res.send('Lital Webhook Server - פועל ✓'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`שרת webhook פועל על פורט ${PORT}`));
