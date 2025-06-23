const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Nhận file path
  socket.on('transcribe', (data) => {
    console.log('Nhận yêu cầu:', data);
    // Bạn có thể log, lưu lịch sử hoặc chuyển tiếp qua REST nếu cần
  });

  socket.on('result', (data) => {
    console.log('Kết quả:', data);
  });
});

server.listen(3000, () => {
  console.log('✅ Socket server chạy tại http://localhost:3000');
});
