const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  elo: {
    type: Number,
    required: true
  }
});

const MatchSchema = new mongoose.Schema({
  players: [PlayerSchema],
  status: {
    type: String,
    enum: ['waiting', 'ongoing', 'completed'],
    default: 'waiting'
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

module.exports = mongoose.model('Match', MatchSchema);
