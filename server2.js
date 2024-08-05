const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

require('dotenv').config();

// Создание Express приложения
const app = express();
app.use(cors());
app.use(bodyParser.json());

const mongoURI = process.env.MONGO;
if (!mongoURI) {
  throw new Error('MONGO environment variable is not defined');
}

mongoose.connect(mongoURI);

// Определение схемы и модели для постов
const postSchema = new mongoose.Schema({
  img: String,
  title: String,
  author: String,
  time: String,
  summary: String,
});

const Post = mongoose.model('Post', postSchema);

// Маршрут для получения постов
app.get('/api/posts', async (req, res) => {
  try {
    const posts = await Post.find();
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Запуск сервера
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
