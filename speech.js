const express = require('express');
const http = require('http');
const multer = require('multer');
const {Server} = require('socket.io');
require("dotenv").config();
const fs = require("fs");
const readline = require("readline");
const {GoogleGenerativeAI} = require("@google/generative-ai");
const textToSpeech = require('@google-cloud/text-to-speech');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {origin: '*'}
});

const SESSION_FILE = "./etc/secrets/gemini_history.json";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Load history từ file (định dạng chuẩn: [{ role, parts }])
let history = [];
if (fs.existsSync(SESSION_FILE)) {
    try {
        const raw = fs.readFileSync(SESSION_FILE, "utf-8");
        history = JSON.parse(raw);
        console.log("📁 Đã tải session.\n");
    } catch (err) {
        console.warn("⚠️ Không đọc được session.json. Bắt đầu mới.\n");
    }
}

// Tạo chat session với history
const model = genAI.getGenerativeModel({model: process.env.GEMINI_MODEL});
const chat = model.startChat({
    history,
    generationConfig: {
        temperature: 0.7,
    },
});

// Tạo client
const client = new textToSpeech.TextToSpeechClient({
    keyFilename: './etc/secrets/key.json'
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const storage = multer.memoryStorage();
const upload = multer({storage});

const transcribeResults = {};

app.post('/transcribe', upload.single('audio'), (req, res) => {
    const audioBuffer = req.file.buffer;
    const requestId = Date.now().toString();

    console.log(`[Server] Gửi buffer đến Python qua socket. ID: ${requestId}`);
    io.emit('transcribe', {
        id: requestId,
        buffer: audioBuffer.toString('base64'),
        name: req.file.originalname
    });

    // Đợi kết quả từ Python
    const timeout = setTimeout(() => {
        res.status(504).json({error: 'Timeout chờ kết quả từ Python'});
        delete transcribeResults[requestId];
    }, 10000);

    let reply = "";
    transcribeResults[requestId] = async (input) => {
        try {
            const result = await chat.sendMessage(input);
            reply = result.response.text();
            console.log("🤖 Gemini:", reply + "\n");
            reply = extractQuotedText(reply);
            await synthesizeSpeech(reply);
            await saveCurrentSession(chat);
        } catch (err) {
            console.error("❌ Lỗi:", err.message || err);
        }
        clearTimeout(timeout);
        res.json({text: reply});
        delete transcribeResults[requestId];
    };
});

io.on('connection', (socket) => {
    console.log(`[Socket] Python connected: ${socket.id}`);

    socket.on('result', ({id, text}) => {
        if (transcribeResults[id]) {
            transcribeResults[id](text);
        }
    });
});

function cleanMarkdown(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1') // **bold**
        .replace(/\*(.*?)\*/g, '$1')     // *italic*
        .replace(/^- /gm, '')            // - bullet
        .replace(/^> /gm, '')            // > quote
        .replace(/`(.+?)`/g, '$1')       // `code`
        .replace(/#+ /g, '')             // # Heading
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // [text](url)
        .replace(/\n{2,}/g, '\n')        // nhiều dòng trắng
        .replace('*', '')        // nhiều dòng trắng
        .trim();
}

// Hàm xử lý văn bản thành SSML nâng cao
function toSSML(text) {
    // Escape XML ký tự đặc biệt
    const safeText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Thay thế mẫu đơn giản (có thể mở rộng)
    return `<speak>
        <p><s>${safeText}
        <break time="500ms"/></s></p>
    </speak>`;
}

// Hàm tạo giọng nói từ văn bản (dùng SSML)
async function synthesizeSpeech(text, outputFilename = 'audio/output.mp3') {
    const ssml = toSSML(cleanMarkdown(text));
    const request = {
        input: {ssml},
        voice: {
            languageCode: 'vi-VN',
            name: 'vi-VN-Standard-A'
        },
        audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.3,
            pitch: -10
        },
    };

    try {
        const [response] = await client.synthesizeSpeech(request);
        fs.writeFileSync(outputFilename, response.audioContent, 'binary');
        console.log(`✅ File MP3 đã tạo: ${outputFilename}`);
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
    }
}

async function saveCurrentSession(chat) {
    const fullHistory = await chat.getHistory();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(fullHistory, null, 2));
}

function extractQuotedText(input) {
    return input.replace(/\([^)]*\)/g, '').trim();
}

function ask() {
    rl.question("👤 Bạn: ", async (input) => {
        if (input.trim().toLowerCase() === "exit") {
            await saveCurrentSession(chat);
            console.log("📁 Đã lưu session. Tạm biệt!");
            rl.close();
            return;
        }

        try {
            const result = await chat.sendMessage(input);
            const reply = result.response.text();
            console.log("🤖 Gemini:", reply + "\n");
            await synthesizeSpeech(extractQuotedText(reply));
            await saveCurrentSession(chat);
        } catch (err) {
            console.error("❌ Lỗi:", err.message || err);
        }

        ask();
    });
}

server.listen(3000, () => {
    console.log('✅ API server chạy tại http://localhost:3000');
});