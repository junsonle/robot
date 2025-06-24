const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Tạo thư mục audio nếu chưa có
const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/audio', express.static(audioDir)); // Cho phép truy cập file wav

// API upload file
app.post('/upload', (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).send('No data received');

    try {
        const buffer = Buffer.from(data, 'base64');
        const filename = `audio_${Date.now()}.wav`;
        const filePath = path.join(audioDir, filename);

        fs.writeFileSync(filePath, buffer);
        console.log(`✅ Saved: ${filename}`);
        res.send('Received');
    } catch (err) {
        res.status(500).send('Error saving file');
    }
});

// API lấy danh sách file
app.get('/list', (req, res) => {
    fs.readdir(audioDir, (err, files) => {
        if (err) return res.status(500).send('Error reading directory');
        const wavFiles = files.filter(f => f.endsWith('.wav'));
        res.json(wavFiles);
    });
});

// API xoá toàn bộ file
app.delete('/delete-all', (req, res) => {
    fs.readdir(audioDir, (err, files) => {
        if (err) return res.status(500).send('Error reading directory');
        for (const file of files) {
            fs.unlinkSync(path.join(audioDir, file));
        }
        res.send('All files deleted');
    });
});

app.listen(3000, () => console.log('🚀 Server running at http://localhost:3000'));