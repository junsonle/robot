const express = require('express');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

const audioDir = path.join(__dirname, 'audio');
const chunkDir = path.join(__dirname, 'chunks');
[ audioDir, chunkDir ].forEach(dir => !fs.existsSync(dir) && fs.mkdirSync(dir));

app.use(express.static('public'));
app.use('/audio', express.static(audioDir));

/* 🔌 WebSocket nhận chunk */
wss.on('connection', (ws) => {
    console.log('🔌 ESP32 connected');

    ws.on('message', (msg) => {
        try {
            const { uploadId, index, isLast, data } = JSON.parse(msg);
            const buffer = Buffer.from(data, 'base64');
            const chunkPath = path.join(chunkDir, `audio_${uploadId}_chunk_${index}.bin`);
            fs.writeFileSync(chunkPath, buffer);
            console.log(`📥 Chunk ${index} saved (${buffer.length} bytes)`);

            if (isLast) {
                console.log(`🧩 Final chunk of ${uploadId}, merging...`);
                const chunks = [];
                let i = 0;
                while (true) {
                    const f = path.join(chunkDir, `audio_${uploadId}_chunk_${i}.bin`);
                    if (!fs.existsSync(f)) break;
                    chunks.push(fs.readFileSync(f));
                    i++;
                }

                const merged = Buffer.concat(chunks);
                const output = path.join(audioDir, `audio_${uploadId}.wav`);
                writeWavFile(merged, output);

                for (let j = 0; j < i; j++) {
                    fs.unlinkSync(path.join(chunkDir, `audio_${uploadId}_chunk_${j}.bin`));
                }

                ws.send(JSON.stringify({ status: 'done', file: `audio_${uploadId}.wav` }));
                console.log(`✅ Saved final file: ${output}`);
            }
        } catch (e) {
            console.error('❌ Error parsing WebSocket message:', e.message);
        }
    });
});

/* 📂 API: Danh sách file */
app.get('/list', (req, res) => {
    const files = fs.readdirSync(audioDir).filter(f => f.endsWith('.wav'));
    res.json(files);
});

/* 🗑️ API: Xoá tất cả */
app.delete('/delete-all', (req, res) => {
    const files = fs.readdirSync(audioDir);
    files.forEach(f => fs.unlinkSync(path.join(audioDir, f)));
    res.send('Deleted');
});

/* 📦 Ghi WAV */
function writeWavFile(rawBuffer, filename, sampleRate = 16000, bitsPerSample = 16, numChannels = 1) {
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = rawBuffer.length;

    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    const wavBuffer = Buffer.concat([header, rawBuffer]);
    fs.writeFileSync(filename, wavBuffer);
}

server.listen(3000, () => {
    console.log('🚀 Server running at http://localhost:3000');
});