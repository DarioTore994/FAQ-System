// API endpoints per l'integrazione con app mobile Flutter
const express = require('express');
const { Pool } = require('pg');
const router = express.Router();

// Configurazione PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware per verificare autenticazione
const verificaAutenticazione = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;

    if (!token) {
      console.log('Autenticazione fallita: Token mancante');
      return res.status(401).json({ 
        error: {
          message: 'Accesso non autorizzato: token mancante'
        }
      });
    }

    const userQuery = 'SELECT * FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [token]);

    if (userResult.rows.length === 0) {
      console.log('Autenticazione fallita: Utente non trovato per token', token);
      return res.status(401).json({ 
        error: {
          message: 'Accesso non autorizzato: utente non trovato'
        }
      });
    }

    // L'utente è valido, imposta nella richiesta e procedi
    req.user = userResult.rows[0];
    console.log('Utente autenticato:', req.user.email);
    next();
  } catch (error) {
    console.error('Errore middleware autenticazione:', error);
    res.status(500).json({ 
      error: {
        message: 'Errore interno del server',
        details: error.message
      }
    });
  }
};

// Endpoint per autenticazione
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Tentativo di login per:', email);

    if (!email || !password) {
      console.log('Login fallito: Email o password mancanti');
      return res.status(400).json({ error: 'Email e password sono obbligatori' });
    }

    // Verifica credenziali nel database
    const client = await pool.connect();
    try {
      // Prima cerchiamo l'utente solo con l'email
      const result = await client.query('SELECT id, email, role, password FROM users WHERE email = $1', [email]);

      if (result.rows.length === 0) {
        console.log('Login fallito: Utente non trovato per email', email);
        return res.status(401).json({ error: 'Credenziali non valide' });
      }

      // Verifica la password con bcrypt
      const user = result.rows[0];
      const bcrypt = require('bcrypt');
      
      // Stampa info di debug (rimuovi queste righe in produzione)
      console.log('Password fornita:', password);
      console.log('Password nel DB (hashed):', user.password);

      try {
        // Verifica la password
        const passwordMatch = await bcrypt.compare(password, user.password);
        console.log('Risultato bcrypt.compare:', passwordMatch);

        if (!passwordMatch) {
          console.log('Password non corrispondente per', email);
          return res.status(401).json({ error: 'Credenziali non valide' });
        }

        // Se arriviamo qui, le credenziali sono valide
        console.log('Login riuscito per', email);

        // Usa l'ID utente come token (semplificato, in produzione usa JWT)
        const token = user.id.toString();

        // Imposta il cookie per l'autenticazione
        res.cookie('token', token, {
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000 // 24 ore
        });

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
      } catch (bcryptError) {
        console.error('Errore nella verifica della password:', bcryptError);
        console.error('Dettagli errore:', bcryptError.message);
        return res.status(500).json({ error: 'Errore di autenticazione' });
      }
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
router.post('/faqs', verificaAutenticazione, async (req, res) => {
  try {
    const { category, title, description, resolution, status } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!category || !title || !description || !resolution) {
      return res.status(400).json({ error: { message: 'Tutti i campi sono obbligatori' } });
    }


    // Inserisci la nuova FAQ nel database con user_id se disponibile
    const query = 'INSERT INTO faqs (user_id, category, title, description, resolution, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';
    const params = [userId || null, category, title, description, resolution, status || 'Nuovo'];

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