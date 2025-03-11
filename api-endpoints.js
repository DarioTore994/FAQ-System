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

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password sono obbligatori' });
    }

    // Verifica credenziali nel database
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT id, email, role FROM users WHERE email = $1 AND password = $2', 
        [email, password]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Credenziali non valide' });
      }
      
      const user = result.rows[0];
      
      // Usa l'ID utente come token (semplificato, in produzione usa JWT)
      const token = user.id.toString();
      
      return res.status(200).json({ 
        session: {
          access_token: token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role
          }
        }
      });
    } finally {
      client.release();
    }
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
    const { category, title, description, resolution, userId } = req.body;

    console.log('API Mobile - Richiesta inserimento FAQ:', {
      category, 
      title,
      userId,
      descriptionLength: description?.length || 0,
      resolutionLength: resolution?.length || 0
    });

    if (!category || !title || !description || !resolution) {
      console.error('API Mobile - Campi mancanti:', { category, title, description, resolution });
      return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
    }

    // Se non è fornito un ID utente, utilizziamo l'utente admin predefinito
    let user_id = userId;
    if (!user_id) {
      // Ottieni l'ID del primo utente admin
      const adminResult = await client.query(
        'SELECT id FROM users WHERE role = $1 LIMIT 1',
        ['admin']
      );
      
      if (adminResult.rows.length === 0) {
        console.error('API Mobile - Nessun utente admin trovato');
        return res.status(500).json({ 
          error: 'Non è possibile salvare la FAQ: nessun utente admin trovato nel sistema' 
        });
      }
      
      user_id = adminResult.rows[0].id;
      console.log('API Mobile - Utilizzando utente admin predefinito:', user_id);
    }

    // Inserimento della FAQ
    const result = await client.query(
      'INSERT INTO faqs (user_id, category, title, description, resolution) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user_id, category, title, description, resolution]
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