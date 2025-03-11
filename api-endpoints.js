// API endpoints per l'integrazione con app mobile Flutter
const express = require('express');
const { Pool } = require('pg');
const router = express.Router();

// Configurazione PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Endpoint per autenticazione
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Questa è una versione semplificata dell'autenticazione.
    // In un'applicazione reale, dovresti verificare le credenziali nel database
    // e utilizzare metodi sicuri come bcrypt per le password.
    if (email && password) {
      // Simula una sessione con un token semplice
      const token = Buffer.from(email).toString('base64');
      return res.status(200).json({ 
        session: {
          access_token: token
        }
      });
    }

    return res.status(400).json({ error: 'Credenziali non valide' });
  } catch (err) {
    console.error('Errore API:', err);
    return res.status(500).json({ error: 'Errore del server' });
  }
});

// Endpoint per ottenere le FAQ
router.get('/faqs', async (req, res) => {
  const client = await pool.connect();
  try {
    const { category } = req.query;

    let query, result;
    if (category && category !== 'all') {
      query = 'SELECT * FROM faqs WHERE category = $1 ORDER BY created_at DESC';
      result = await client.query(query, [category]);
    } else {
      query = 'SELECT * FROM faqs ORDER BY created_at DESC';
      result = await client.query(query);
    }

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Errore API FAQ:', err);
    return res.status(500).json({ error: 'Errore durante il recupero delle FAQ' });
  } finally {
    client.release();
  }
});

// Endpoint per salvare una nuova FAQ
router.post('/faqs', async (req, res) => {
  const client = await pool.connect();
  try {
    const { category, title, description, resolution } = req.body;

    console.log('API Mobile - Richiesta inserimento FAQ:', {
      category, 
      title,
      descriptionLength: description?.length || 0,
      resolutionLength: resolution?.length || 0
    });

    if (!category || !title || !description || !resolution) {
      console.error('API Mobile - Campi mancanti:', { category, title, description, resolution });
      return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
    }

    // Inserimento della FAQ
    const result = await client.query(
      'INSERT INTO faqs (category, title, description, resolution) VALUES ($1, $2, $3, $4) RETURNING *',
      [category, title, description, resolution]
    );

    console.log('API Mobile - FAQ inserita con successo:', result.rows[0]);
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('API Mobile - Errore salvataggio FAQ:', err);
    return res.status(500).json({ 
      error: 'Errore durante il salvataggio della FAQ',
      details: err.message,
      stack: err.stack
    });
  } finally {
    client.release();
  }
});

module.exports = router;