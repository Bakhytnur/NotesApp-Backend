const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const mime = require('mime-types');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Create Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const extension = mime.extension(file.mimetype) || '';
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${extension}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Create PostgreSQL client
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Get all posts
app.get('/api/posts', async (req, res) => {
  try {
    const query = `
      SELECT p.id, p.img, p.title, p.date, p.description, 
             CASE 
               WHEN EXISTS (
                 SELECT 1 
                 FROM post_tags pt 
                 WHERE pt.post_id = p.id
               ) THEN json_agg(json_build_object('id', t.id, 'name', t.name))
               ELSE NULL
             END AS tags
      FROM posts p
      LEFT JOIN post_tags pt ON p.id = pt.post_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      GROUP BY p.id;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new post
app.post('/api/posts', upload.single('img'), async (req, res) => {
  try {
    const { id, title, date, description, tagNames } = req.body;
    const img = req.file ? req.file.filename : '';
    const result = await pool.query(
      'INSERT INTO posts (img, title, date, description, id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [img, title, date, description, id]
    );
    //const postId = result.rows[0].id;
    const postId = id;
    console.log('result', result);

    if (tagNames && Array.isArray(tagNames)) {
      const tagQueries = tagNames.map(async (tagName) => {
        //const tagResult = await pool.query(
        const existingTag = await pool.query('SELECT id FROM tags WHERE name = $1', [tagName]);

        if(existingTag.rows.length > 0) {
          const tagId = existingTag.rows[0].id;

          await pool.query(
            'INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [postId, tagId]
          );
        } else {
          let tagId = uuidv4();

          await pool.query(
            'INSERT INTO tags (id, name) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING RETURNING id',
            [tagId, tagName]
          );
          console.log('tagId', tagId);
          //if (tagResult.rows.length > 0) {
          //const tagId = tagResult.rows[0].id;
          await pool.query(
            'INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [postId, tagId]
          );
          console.log('postId', postId);
        }
        //}
      });
      await Promise.all(tagQueries);
    }

    if (tagNames) {
      //const post = await pool.query('SELECT * FROM posts WHERE id = $1', [postId]);
      const post = await pool.query(
        'SELECT p.id, p.img, p.title, p.date, p.description, ' +
        'json_agg(json_build_object(\'id\', t.id, \'name\', t.name)) AS tags ' +
        'FROM posts p ' +
        'LEFT JOIN post_tags pt ON p.id = pt.post_id ' +
        'LEFT JOIN tags t ON pt.tag_id = t.id ' +
        'WHERE p.id = $1 ' +
        'GROUP BY p.id;',
        [postId]
      );
      res.status(201).json(post.rows[0]);
    } else {
      //const post = await pool.query('SELECT * FROM posts WHERE id = $1', [postId]);
      const post = await pool.query(
        'SELECT p.id, p.img, p.title, p.date, p.description ' +
        'FROM posts p ' +
        'LEFT JOIN post_tags pt ON p.id = pt.post_id ' +
        'LEFT JOIN tags t ON pt.tag_id = t.id ' +
        'WHERE p.id = $1 ' +
        'GROUP BY p.id;',
        [postId]
      );
      res.status(201).json(post.rows[0]);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete a post
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM post_tags WHERE post_id = $1', [id]);
    await pool.query('DELETE FROM posts WHERE id = $1', [id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update a post
app.put('/api/posts/:id', async (req, res) => {
  try {
    const postId = req.params.id;
    const { title, date, description, tagNames } = req.body;

    await pool.query(
      'UPDATE posts SET title = $1, date = $2, description = $3 WHERE id = $4',
      [title, date, description, postId]
    );

    await pool.query('DELETE FROM post_tags WHERE post_id = $1', [postId]);

    if (tagNames && Array.isArray(tagNames)) {
      const tagQueries = tagNames.map(async (tagName) => {
      //tagNames.map(async (tagName) => {  
        const existingTag = await pool.query('SELECT id FROM tags WHERE name = $1', [tagName.name]);

        console.log('postId', postId);
        console.log('tagname', tagName.name);
        console.log('tagId', tagName.id);

        if(existingTag.rows.length > 0) {
          const tagId = existingTag.rows[0].id;
          console.log('existingTag', existingTag.rows[0].id);

          await pool.query(
            'INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [postId, tagId]
          );
        } else {
          const tagId = tagName.id;
          console.log('noexistingTag');
          //const tagId = uuidv4();
          await pool.query(
          //'INSERT INTO tags (id, name) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING RETURNING id',
            'INSERT INTO tags (id, name) VALUES ($1, $2) RETURNING id',
            [tagId, tagName.name]
          );
          console.log('added tag', tagId);
        
          await pool.query(
            //'INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            'INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2)',
            [postId, tagId]
          );
          console.log('added post_tag');
        }
      });
      await Promise.all(tagQueries);
    }

    if(tagNames) {
      const updatedPost = await pool.query(
        'SELECT p.id, p.img, p.title, p.date, p.description, ' +
        'json_agg(json_build_object(\'id\', t.id, \'name\', t.name)) AS tags ' +
        'FROM posts p ' +
        'LEFT JOIN post_tags pt ON p.id = pt.post_id ' +
        'LEFT JOIN tags t ON pt.tag_id = t.id ' +
        'WHERE p.id = $1 ' +
        'GROUP BY p.id;',
        [postId]
      );
  
      //console.log(updatedPost.rows[0]);
      res.json(updatedPost.rows[0]);
    } else {
      const updatedPost = await pool.query(
        'SELECT p.id, p.img, p.title, p.date, p.description ' +
        'FROM posts p ' +
        'LEFT JOIN post_tags pt ON p.id = pt.post_id ' +
        'LEFT JOIN tags t ON pt.tag_id = t.id ' +
        'WHERE p.id = $1 ' +
        'GROUP BY p.id;',
        [postId]
      );
  
      //console.log(updatedPost.rows[0]);
      res.json(updatedPost.rows[0]);
    }
    
  } catch (error) {
    res.status(500).json({ message: 'Error updating post' });
  }
});

// Get all tags
app.get('/api/tags', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tags');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new tag
app.post('/api/tags', async (req, res) => {
  try {
    const { name } = req.body;
    const result = await pool.query(
      'INSERT INTO tags (name) VALUES ($1) RETURNING *',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
