// 📁 server.js - Node.js server nhận âm thanh từ ESP32 và chuyển .raw thành .wav
const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

const audioDir = path.join(__dirname, "audio");
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir);

app.use(express.json({ limit: "10mb" }));
app.use("/audio", express.static(audioDir));
app.use(express.static("public")); // nếu có giao diện HTML

// ✅ Nhận âm thanh base64 từ ESP32
app.post("/upload", (req, res) => {
    const base64Data = req.body.audio;
    if (!base64Data) return res.status(400).send("Thiếu dữ liệu 'audio'");

    const buffer = Buffer.from(base64Data, "base64");
    const fileName = `audio_${Date.now()}`;
    const rawPath = path.join(audioDir, fileName + ".raw");
    const wavPath = path.join(audioDir, fileName + ".wav");

    fs.writeFile(rawPath, buffer, err => {
        if (err) return res.status(500).send("Lỗi ghi file .raw");
        convertRawToWav(rawPath, wavPath);
        console.log(`\u2705 Ghi xong: ${fileName}`);
        res.send("OK");
    });
});

// ✅ Trả danh sách file WAV
app.get("/files", (req, res) => {
    fs.readdir(audioDir, (err, files) => {
        if (err) return res.status(500).json([]);
        res.json(files.filter(f => f.endsWith(".wav")));
    });
});

// ✅ Tạo WAV header rồi gắn vào buffer
function convertRawToWav(inputPath, outputPath) {
    const rawData = fs.readFileSync(inputPath);
    const header = createWavHeader(rawData.length, {
        numChannels: 1,
        sampleRate: 16000,
        bitsPerSample: 16,
    });
    const wavData = Buffer.concat([header, rawData]);
    fs.writeFileSync(outputPath, wavData);
}

function createWavHeader(dataSize, options) {
    const { numChannels, sampleRate, bitsPerSample } = options;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const buffer = Buffer.alloc(44);

    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);

    return buffer;
}

app.listen(PORT, () => {
    console.log(`\u{1F680} Server chay tai: http://localhost:${PORT}`);
});