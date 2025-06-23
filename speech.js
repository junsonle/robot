const express = require('express');
const http = require('http');
const multer = require('multer');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const storage = multer.memoryStorage(); // <-- Không lưu file
const upload = multer({ storage });

const transcribeResults = {};

app.post('/transcribe', upload.single('audio'), (req, res) => {
  const audioBuffer = req.file.buffer;
  const requestId = Date.now().toString();

  console.log(`[Server] Gửi buffer đến Python qua socket. ID: ${requestId}`);
  io.emit('transcribe', {
    id: requestId,
    buffer: audioBuffer.toString('base64'), // Gửi base64 string
    name: req.file.originalname
  });

  // Đợi kết quả từ Python
  const timeout = setTimeout(() => {
    res.status(504).json({ error: 'Timeout chờ kết quả từ Python' });
    delete transcribeResults[requestId];
  }, 20000);

  transcribeResults[requestId] = (result) => {
    clearTimeout(timeout);
    res.json({ text: result });
    delete transcribeResults[requestId];
  };
});

io.on('connection', (socket) => {
  console.log(`[Socket] Python connected: ${socket.id}`);

  socket.on('result', ({ id, text }) => {
    if (transcribeResults[id]) {
      transcribeResults[id](text);
    }
  });
});

server.listen(3000, () => {
  console.log('✅ API server chạy tại http://localhost:3000');
});