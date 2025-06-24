const express = require("express");
const fs = require("fs");
const path = require("path");

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

// 📥 Nhận body dạng text/plain (chuỗi base64)
app.use(express.text({ limit: '20mb' }));

// 📁 Giao diện web & file âm thanh
app.use(express.static("public"));
app.use("/audio", express.static("audio"));

// 🔴 Nhận base64 âm thanh từ ESP32
app.post("/upload", (req, res) => {
    const audioBase64 = req.body;
    if (!audioBase64 || audioBase64.length < 100) {
        return res.status(400).send("Thiếu hoặc dữ liệu không hợp lệ");
    }

    const buffer = Buffer.from(audioBase64, "base64");
    const fileName = `audio_${Date.now()}.raw`;
    const filePath = path.join(audioDir, fileName);

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

// 🔄 Xóa tất cả file âm thanh
app.delete("/files", (req, res) => {
    fs.readdir(audioDir, (err, files) => {
        if (err) return res.status(500).send("Không đọc được thư mục");

        files.forEach(file => {
            fs.unlinkSync(path.join(audioDir, file));
        });

        console.log("🗑️ Đã xóa toàn bộ file audio.");
        res.send("Đã xóa tất cả file.");
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server chạy tại: http://localhost:${PORT}`);
});
