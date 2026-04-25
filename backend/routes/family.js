const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { connectDB } = require('../db');

const familySchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  members: { type: Array, required: true },
  updatedAt: { type: Date, default: Date.now },
});

const Family = mongoose.models.Family || mongoose.model('Family', familySchema);

router.get('/', async (req, res) => {
  try {
    await connectDB();
    const sessionId = req.headers['x-session-id'] || 'default';
    const family = await Family.findOne({ sessionId });
    res.json(family ? { members: family.members } : { members: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '가족 프로필을 불러오는 데 실패했습니다.' });
  }
});

router.post('/', async (req, res) => {
  try {
    await connectDB();
    const sessionId = req.headers['x-session-id'] || 'default';
    const { members } = req.body;
    if (!Array.isArray(members)) {
      return res.status(400).json({ error: '가족 구성원 정보가 필요합니다.' });
    }
    const family = await Family.findOneAndUpdate(
      { sessionId },
      { members, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true, family: { members: family.members } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '가족 프로필 저장에 실패했습니다.' });
  }
});

module.exports = router;
