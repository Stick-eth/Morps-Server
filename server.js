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
    origin: "http://localhost:3000", // Votre adresse frontend
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

app.use('/api/users', require('./routes/users'));

// Fonction utilitaire pour générer un ID de room à 5 caractères
function generateRoomId() {
  return Math.random().toString(36).substr(2, 5);
}

const matchmakingQueue = [];
const rooms = {};

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  socket.on('joinQueue', (user) => {
    console.log(`${user.pseudo} joined the queue`);
    matchmakingQueue.push({ socket, user });

    if (matchmakingQueue.length >= 2) {
      const player1 = matchmakingQueue.shift();
      const player2 = matchmakingQueue.shift();

      const roomId = generateRoomId();
      const randomIndex = Math.floor(Math.random() * 2);
      rooms[roomId] = {
        players: [player1, player2],
        status: 'closed', // Room visibility status
        board: Array(9).fill(null),
        currentPlayerIndex: randomIndex
      };

      player1.socket.join(roomId);
      player2.socket.join(roomId);

      const currentPlayer = rooms[roomId].players[randomIndex].user.pseudo;

      player1.socket.emit('matchFound', {
        roomId,
        players: [player1.user, player2.user],
        currentPlayer,
        opponent: player2.user.pseudo
      });

      player2.socket.emit('matchFound', {
        roomId,
        players: [player1.user, player2.user],
        currentPlayer,
        opponent: player1.user.pseudo
      });

      console.log(`Match found: ${player1.user.pseudo} vs ${player2.user.pseudo} in room ${roomId}`);
    }
  });

  socket.on('makeMove', ({ roomId, index }) => {
    const room = rooms[roomId];
    if (room) {
      const currentPlayer = room.players[room.currentPlayerIndex].user.pseudo;
      if (room.board[index] === null) {
        room.board[index] = currentPlayer;
        room.currentPlayerIndex = 1 - room.currentPlayerIndex;
        const nextPlayer = room.players[room.currentPlayerIndex].user.pseudo;

        io.to(roomId).emit('moveMade', { board: room.board, currentPlayer: nextPlayer });
        console.log(`Move made by ${currentPlayer} at index ${index}`);
      } else {
        socket.emit('invalidMove', { message: 'Invalid move, position already taken.' });
      }

      // Check for winner
      const winner = checkWinner(room.board);
      if (winner) {
        io.to(roomId).emit('gameOver', { winner });
        delete rooms[roomId];
      }
    }
  });

  socket.on('leaveQueue', (user) => {
    const index = matchmakingQueue.findIndex((player) => player.user._id === user._id);
    if (index !== -1) {
      matchmakingQueue.splice(index, 1);
      console.log(`${user.pseudo} left the queue`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    for (const roomId in rooms) {
      rooms[roomId].players = rooms[roomId].players.filter(player => player.socket.id !== socket.id);
      if (rooms[roomId].players.length === 0) {
        delete rooms[roomId];
      }
    }
  });
});

function checkWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  for (let line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
