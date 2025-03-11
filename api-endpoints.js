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
  try {
    const { category, title, description, resolution, status, user_id } = req.body;

    if (!category || !title || !description || !resolution) {
      return res.status(400).json({ error: { message: 'Tutti i campi sono obbligatori' } });
    }

    console.log('Verifica tabella in corso...');
    try {
      await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'faqs' AND column_name = 'user_id'
      `);
      console.log('Tabella verificata');
    } catch (error) {
      console.log('Errore verifica tabella:', error.message);
    }

    console.log('Salvataggio FAQ in corso...');
    // Inserisci la nuova FAQ nel database con user_id se disponibile
    let query, params;
    
    if (user_id) {
      query = 'INSERT INTO faqs (user_id, category, title, description, resolution, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';
      params = [user_id, category, title, description, resolution, status || 'Nuovo'];
    } else {
      query = 'INSERT INTO faqs (category, title, description, resolution, status) VALUES ($1, $2, $3, $4, $5) RETURNING *';
      params = [category, title, description, resolution, status || 'Nuovo'];
    }
    
    const result = await pool.query(query, params);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Errore salvataggio FAQ:', error);
    res.status(500).json({ 
      error: { 
        message: 'Errore interno del server',
        details: error.message
      } 
    });
  }
});

// Inizializzazione database (crea tabelle se non esistono)
router.post('/init-db', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        reset_token VARCHAR(255),
        reset_token_expiry TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS faqs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  -- Added user_id column
        category VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        resolution TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'Nuovo',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP
      );
    `);

    // Inserisci categorie di base se non esistono già
    await pool.query(`
      INSERT INTO categories (name, description)
      VALUES 
        ('Hardware', 'Problemi relativi a dispositivi fisici'),
        ('Software', 'Problemi relativi a programmi e applicazioni'),
        ('Network', 'Problemi di rete e connettività'),
        ('Security', 'Problemi di sicurezza informatica')
      ON CONFLICT (name) DO NOTHING;
    `);

    res.json({ success: true, message: 'Database inizializzato correttamente' });
  } catch (error) {
    console.error('Errore inizializzazione database:', error);
    res.status(500).json({ 
      error: { 
        message: 'Errore inizializzazione database',
        details: error.message
      } 
    });
  }
});

module.exports = router;