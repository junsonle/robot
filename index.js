const express = require('express');
const fs = require('fs');
const path = require('path');
const gTTS = require('gtts');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.post('/speak', (req, res) => {
  const text = req.body.text;
  if (!text) return res.status(400).json({ error: 'Missing text' });

  const filepath = path.join(__dirname, 'public/output.mp3');
  const gtts = new gTTS(text, 'vi');

  gtts.save(filepath, (err) => {
    if (err) {
      console.error('TTS error:', err);
      return res.status(500).json({ error: 'Failed to generate speech' });
    }
    res.json({ url: '/output.mp3' });
  });
});

app.listen(port, () => {
  console.log(`✅ TTS server is running at http://localhost:${port}`);
});
