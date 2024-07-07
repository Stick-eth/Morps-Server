const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Middleware d'authentification
const auth = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (error) {
    console.error("Token validation error:", error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Trouver ou créer un match
router.post('/find', auth, async (req, res) => {
  const rangeStep = 50;
  let range = rangeStep;
  let user;
  try {
    user = await User.findById(req.user.id);
  } catch (error) {
    console.error("User fetch error:", error);
    return res.status(500).json({ message: 'Server error' });
  }

  const searchMatch = async () => {
    try {
      const matches = await Match.find({
        status: 'waiting',
        'players.elo': { $gte: user.elo - range, $lte: user.elo + range }
      });

      if (matches.length > 0) {
        const match = matches[0];
        match.players.push({ id: user._id, elo: user.elo });
        match.status = 'ongoing';
        await match.save();
        return res.json({ match });
      } else {
        const newMatch = new Match({
          players: [{ id: user._id, elo: user.elo }],
          status: 'waiting'
        });
        await newMatch.save();
        return res.json({ match: newMatch });
      }
    } catch (error) {
      console.error("Matchmaking error:", error);
      return res.status(500).json({ message: 'Server error' });
    }
  };

  const expandSearch = () => {
    range += rangeStep;
    console.log(`Expanding search range to +/- ${range} Elo`);
    setTimeout(() => searchMatch().then(result => {
      if (!res.headersSent) {
        expandSearch();
      }
    }), 10000);
  };

  searchMatch().then(result => {
    if (!res.headersSent) {
      expandSearch();
    }
  });
});

// Quitter le matchmaking
router.post('/leave', auth, async (req, res) => {
  try {
    const match = await Match.findOneAndUpdate(
      { 'players.id': req.user.id, status: 'waiting' },
      { $pull: { players: { id: req.user.id } } },
      { new: true }
    );

    if (match && match.players.length === 0) {
      await Match.deleteOne({ _id: match._id });
    }

    res.json({ message: 'User removed from matchmaking' });
  } catch (error) {
    console.error("Leave matchmaking error:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
