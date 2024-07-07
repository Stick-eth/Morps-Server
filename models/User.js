const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  pseudo: {
    type: String,
    required: true,
    unique: true,
  },
  elo: {
    type: Number,
    default: 1000,
  },
});

module.exports = mongoose.model('User', UserSchema);
