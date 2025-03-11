const express = require('express');
const pool = require('./db');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// Endpoint per verificare se un'email è già registrata
app.get('/api/auth/check-email', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email non fornita' });
  }

  try {
    const query = 'SELECT COUNT(*) FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);

    const exists = parseInt(result.rows[0].count) > 0;
    return res.json({ exists });
  } catch (error) {
    console.error('Errore nella verifica email:', error);
    return res.status(500).json({ error: 'Errore nel controllo email' });
  }
});

// Endpoint per effettuare il recupero della password
app.post('/api/auth/recover-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email non fornita' });
  }

  try {
    // Verifica se l'email esiste nel database
    const userQuery = 'SELECT * FROM users WHERE email = $1';
    const userResult = await pool.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'email_not_found' });
    }

    // ... (rest of password recovery logic) ...

  } catch (error) {
    console.error('Errore nel recupero password:', error);
    return res.status(500).json({ error: 'Errore nel recupero password' });
  }
});

// Endpoint per la registrazione dell'utente
app.post('/api/auth/register', async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password sono obbligatori' });
  }

  // Validazione formato email
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: 'Formato email non valido' });
  }

  try {
    // Verifica se l'email esiste già
    const checkQuery = 'SELECT COUNT(*) FROM users WHERE email = $1';
    const checkResult = await pool.query(checkQuery, [email]);

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(409).json({ error: 'Un utente con questa email è già registrato' });
    }

    // Hash della password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Inserimento utente nel database
    const insertQuery = 'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)';
    await pool.query(insertQuery, [email, hashedPassword, role]);

    return res.status(201).json({ message: 'Utente registrato correttamente' });

  } catch (error) {
    console.error('Errore nella registrazione:', error);
    return res.status(500).json({ error: 'Errore nella registrazione' });
  }
});


// ... (rest of the app.js file) ...

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Server started on port ${port}`));