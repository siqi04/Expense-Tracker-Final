// backend/server.js
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 5000;

app.use(express.json());
app.use(cors());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error('Could not connect to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');
});

app.post('/api/expenses', (req, res) => {
  const { title, amount, date } = req.body;
  const query = 'INSERT INTO expenses (title, amount, date) VALUES (?, ?, ?)';
  db.query(query, [title, amount, date], (err, result) => {
    if (err) {
      console.error('Error adding expense:', err);
      return res.status(500).json({ error: 'Failed to add expense' });
    }
    res.status(201).json({ id: result.insertId, title, amount, date });
  });
});

app.get('/api/expenses', (req, res) => {
  const query = 'SELECT * FROM expenses';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching expenses:', err);
      return res.status(500).json({ error: 'Failed to fetch expenses' });
    }
    res.status(200).json(results);
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
