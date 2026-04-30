// Cross-provider WhatsApp sender (Evolution API or Twilio)
// Picks provider via WA_PROVIDER env var (default: evolution)

async function sendViaEvolution(to, text) {
  const baseUrl = process.env.EVOLUTION_URL || '';
  const apiKey = process.env.EVOLUTION_API_KEY || '';
  const instance = process.env.EVOLUTION_INSTANCE || 'runcoach';
  if (!baseUrl || !apiKey) throw new Error('Evolution API not configured');
  const res = await fetch(`${baseUrl}/message/sendText/${instance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
    body: JSON.stringify({ number: to, text })
  });
  if (!res.ok) throw new Error(`Evolution send failed: ${res.status}`);
  return res.json();
}

async function sendViaTwilio(to, text) {
  const sid = process.env.TWILIO_SID || '';
  const token = process.env.TWILIO_TOKEN || '';
  const from = process.env.TWILIO_FROM || 'whatsapp:+14155238886';
  if (!sid || !token) throw new Error('Twilio not configured');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const body = new URLSearchParams({ To: `whatsapp:+${to}`, From: from, Body: text });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  if (!res.ok) throw new Error(`Twilio send failed: ${res.status}`);
  return res.json();
}

async function sendWhatsApp(to, text) {
  const provider = (process.env.WA_PROVIDER || 'evolution').toLowerCase();
  if (provider === 'twilio') return sendViaTwilio(to, text);
  return sendViaEvolution(to, text);
}

module.exports = { sendWhatsApp };
