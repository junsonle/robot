const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = 3000;

app.use(bodyParser.json({ limit: "10mb" }));

// 🟢 Dùng thư mục 'public' làm static (chứa index.html)
app.use(express.static("public"));

// 🟢 Dùng thư mục 'audio' để phục vụ file âm thanh
app.use("/audio", express.static("audio"));

// 🔵 API: nhận dữ liệu ghi âm từ ESP32
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

// 🔵 API: trả danh sách file trong thư mục 'audio'
app.get("/files", (req, res) => {
    fs.readdir(path.join(__dirname, "audio"), (err, files) => {
        if (err) return res.status(500).json([]);
        res.json(files.filter(f => f.endsWith(".raw") || f.endsWith(".wav")));
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server chạy tại: http://localhost:${PORT}`);
});