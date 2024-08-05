const axios = require('axios');

const URL = 'http://localhost:5002/api/posts';

const newPost = {
  img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSytnmG8L-rBCdEs4dCvfkypltccr1HoY9UxA&s',
  title: 'Full house battery backup coming7',
  date: '2023-01-06 16:45',
  desc: 'Improve your reading skills with our reading tests. Find reading tests for every level. Different types of texts & questions in each test!',
};

axios.post(URL, newPost)
  .then(response => console.log('Post added:', response.data))
  .catch(error => console.error('Error adding post:', error));
