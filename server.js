const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // Your frontend address
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

app.use('/api/users', require('./routes/users'));

const matchmakingQueue = [];
const matches = {};

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  socket.on('joinQueue', (user) => {
    console.log(`${user.pseudo} (Elo: ${user.elo}) joined the queue`);
    matchmakingQueue.push({ socket, user });

    if (matchmakingQueue.length >= 2) {
      const player1 = matchmakingQueue.shift();
      const player2 = matchmakingQueue.shift();

      const matchId = `${player1.user._id}-${player2.user._id}`;
      matches[matchId] = [player1, player2];

      player1.socket.join(matchId);
      player2.socket.join(matchId);

      io.to(matchId).emit('matchFound', { matchId, players: [player1.user, player2.user] });
      console.log(`Match found: ${player1.user.pseudo} vs ${player2.user.pseudo}`);
    }
  });

  socket.on('sendMessage', ({ matchId, message }) => {
    io.to(matchId).emit('receiveMessage', message);
  });

  socket.on('leaveQueue', (user) => {
    const index = matchmakingQueue.findIndex((player) => player.user._id === user._id);
    if (index !== -1) {
      matchmakingQueue.splice(index, 1);
      console.log(`${user.pseudo} (Elo: ${user.elo}) left the queue`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    for (const matchId in matches) {
      matches[matchId] = matches[matchId].filter(player => player.socket.id !== socket.id);
      if (matches[matchId].length === 0) {
        delete matches[matchId];
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
