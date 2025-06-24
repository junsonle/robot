const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const audioDir = path.join(__dirname, 'audio');
const chunkDir = path.join(__dirname, 'chunks');
[ audioDir, chunkDir ].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));
app.use('/audio', express.static(audioDir));

app.post('/upload-chunk', async (req, res) => {
    const { data, uploadId, index, isLast } = req.body;
    if (!data || uploadId === undefined || index === undefined) {
        return res.status(400).send('Missing required fields');
    }

    const raw = Buffer.from(data, 'base64');
    const chunkPath = path.join(chunkDir, `audio_${uploadId}_chunk_${index}.bin`);
    fs.writeFileSync(chunkPath, raw);
    console.log(`📥 Received chunk ${index} for ${uploadId}`);

    if (isLast) {
        console.log(`🧩 Final chunk for ${uploadId}, merging...`);
        const outRaw = [];

        let i = 0;
        while (true) {
            const part = path.join(chunkDir, `audio_${uploadId}_chunk_${i}.bin`);
            if (!fs.existsSync(part)) break;
            outRaw.push(fs.readFileSync(part));
            i++;
        }

        const merged = Buffer.concat(outRaw);
        const outFile = path.join(audioDir, `audio_${uploadId}.wav`);
        writeWavFile(merged, outFile);

        for (let j = 0; j < i; j++) {
            fs.unlinkSync(path.join(chunkDir, `audio_${uploadId}_chunk_${j}.bin`));
        }

        return res.send('Merged');
    }

    res.send('Chunk saved');
});

app.get('/list', (req, res) => {
    const files = fs.readdirSync(audioDir).filter(f => f.endsWith('.wav'));
    res.json(files);
});

app.delete('/delete-all', (req, res) => {
    const files = fs.readdirSync(audioDir);
    files.forEach(f => fs.unlinkSync(path.join(audioDir, f)));
    res.send('Deleted');
});

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

app.listen(3000, () => console.log('🚀 Server running at http://localhost:3000'));