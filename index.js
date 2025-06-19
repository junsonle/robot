const express = require('express');
const fetch = require('node-fetch');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.post('/speak', async (req, res) => {
  const text = req.body.text;
  if (!text) return res.status(400).json({ error: 'Missing text' });

  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=vi&client=tw-ob`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch TTS');
    }

    res.set('Content-Type', 'audio/mpeg');
    response.body.pipe(res);
  } catch (err) {
    console.error('TTS Error:', err);
    res.status(500).json({ error: 'TTS fetch failed' });
  }
});

app.listen(port, () => {
  console.log(`🌐 TTS server running at http://localhost:${port}`);
});
