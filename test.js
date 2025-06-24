const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = 3000;

// 📁 Tạo thư mục audio nếu chưa có
const audioDir = path.join(__dirname, "audio");
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir);
}

// 📥 Log mỗi request
app.use((req, res, next) => {
    console.log(`📥 Yêu cầu: ${req.method} ${req.url}`);
    next();
});

app.use(bodyParser.json({
    limit: '10mb',
    strict: true,
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            throw new Error('Invalid JSON');
        }
    }
}));

app.use(express.static("public"));
app.use("/audio", express.static("audio"));

// 🔴 Nhận audio base64
app.post("/upload", (req, res) => {
    const audioBase64 = req.body.audio;
    if (!audioBase64) return res.status(400).send("Thiếu 'audio'");

    const buffer = Buffer.from(audioBase64, "base64");
    const fileName = `audio_${Date.now()}.raw`;
    const filePath = path.join(__dirname, "audio", fileName);

    fs.writeFile(filePath, buffer, (err) => {
        if (err) return res.status(500).send("Lỗi ghi file");
        console.log(`✅ Đã lưu: ${fileName}`);
        res.send("OK");
    });
});

// 📁 API danh sách file
app.get("/files", (req, res) => {
    fs.readdir(audioDir, (err, files) => {
        if (err) return res.status(500).json([]);
        res.json(files.filter(f => f.endsWith(".raw") || f.endsWith(".wav")));
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server chạy tại: http://localhost:${PORT}`);
});