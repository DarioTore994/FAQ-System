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

// Endpoint per ottenere una singola FAQ per ID
router.get('/faqs/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    console.log(`Recupero FAQ con ID: ${id}`);
    const query = 'SELECT * FROM faqs WHERE id = $1';
    const result = await client.query(query, [id]);

    if (result.rows.length === 0) {
      console.log(`FAQ con ID ${id} non trovata`);
      return res.status(404).json({ error: { message: 'FAQ non trovata' } });
    }

    console.log(`FAQ con ID ${id} recuperata con successo`);
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(`Errore recupero FAQ con ID ${id}:`, err);
    return res.status(500).json({ 
      error: { 
        message: 'Errore durante il recupero della FAQ',
        details: err.message
      } 
    });
  } finally {
    client.release();
  }
});

// Endpoint per ottenere tutte le categorie
router.get('/categories', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const query = 'SELECT * FROM categories ORDER BY name';
    const result = await client.query(query);

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Errore API categorie:', err);
    // Gestione dettagliata dell'errore
    if (err.code === '42P01') { // Tabella non esistente
      return res.status(500).json({ 
        error: 'Tabella categorie non trovata. Il database potrebbe non essere inizializzato',
        errorCode: 'TABLE_NOT_FOUND'
      });
    } else if (err.code === '08003' || err.code === '08006' || err.code === '57P01') { // Connessione al DB fallita
      return res.status(503).json({ 
        error: 'Impossibile connettersi al database', 
        errorCode: 'DB_CONNECTION_ERROR'
      });
    } else {
      return res.status(500).json({
        error: 'Errore durante il recupero delle categorie',
        details: err.message,
        errorCode: 'INTERNAL_ERROR'
      });
    }
  } finally {
    if (client) client.release();
  }
});

// Endpoint per aggiungere una nuova categoria
router.post('/categories', verificaAutenticazione, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Il nome della categoria è obbligatorio' });
    }

    const client = await pool.connect();
    try {
      const query = 'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *';
      const result = await client.query(query, [name, description || null]);

      return res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Errore aggiunta categoria:', err);
    // Gestione dell'errore di categoria duplicata
    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Esiste già una categoria con questo nome' });
    }
    return res.status(500).json({ error: 'Errore durante l\'aggiunta della categoria' });
  }
});

// Endpoint per aggiornare una categoria
router.put('/categories/:id', verificaAutenticazione, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Il nome della categoria è obbligatorio' });
    }

    const client = await pool.connect();
    try {
      const query = 'UPDATE categories SET name = $1, description = $2 WHERE id = $3 RETURNING *';
      const result = await client.query(query, [name, description || null, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Categoria non trovata' });
      }

      return res.status(200).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Errore aggiornamento categoria:', err);
    // Gestione dell'errore di categoria duplicata
    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Esiste già una categoria con questo nome' });
    }
    return res.status(500).json({ error: 'Errore durante l\'aggiornamento della categoria' });
  }
});

// Endpoint per eliminare una categoria
router.delete('/categories/:id', verificaAutenticazione, async (req, res) => {
  try {
    const { id } = req.params;

    const client = await pool.connect();
    try {
      const query = 'DELETE FROM categories WHERE id = $1 RETURNING *';
      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Categoria non trovata' });
      }

      return res.status(200).json({ success: true, message: 'Categoria eliminata con successo' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Errore eliminazione categoria:', err);
    return res.status(500).json({ error: 'Errore durante l\'eliminazione della categoria' });
  }
});

// Endpoint per salvare una nuova FAQ
router.post('/faqs', verificaAutenticazione, async (req, res) => {
  try {
    const { category, title, description, resolution, status, notes, image_url } = req.body; // Added notes and image_url
    const userId = req.user ? req.user.id : null;

    if (!category || !title || !description || !resolution) {
      return res.status(400).json({ error: { message: 'Tutti i campi sono obbligatori' } });
    }

    // Verifica che la categoria esista
    let categoryExists = false;
    try {
      const categoryCheck = await pool.query('SELECT id FROM categories WHERE name = $1', [category]);
      categoryExists = categoryCheck.rows.length > 0;
    } catch (categoryError) {
      console.warn('Errore verifica categoria:', categoryError);
      // Continua comunque, potrebbe essere un problema temporaneo
    }

    // Se la categoria non esiste, la crea automaticamente
    if (!categoryExists) {
      try {
        await pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT DO NOTHING', [category]);
        console.log('Categoria creata automaticamente:', category);
      } catch (createCategoryError) {
        console.warn('Errore creazione categoria:', createCategoryError);
        // Continua comunque, potrebbe essere un problema temporaneo
      }
    }

    // Inserisci la nuova FAQ nel database con user_id se disponibile
    const query = 'INSERT INTO faqs (user_id, category, title, description, resolution, status, notes, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *'; // Added notes and image_url
    const params = [userId || null, category, title, description, resolution, status, notes || null, image_url || null]; // Added notes and image_url

    const result = await pool.query(query, params);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Errore salvataggio FAQ:', error);
    // Gestione dettagliata degli errori
    if (error.code === '23503') {
      return res.status(400).json({ 
        error: { 
          message: 'La categoria specificata non esiste',
          details: error.message
        } 
      });
    } else if (error.code === '42P01') {
      return res.status(500).json({ 
        error: { 
          message: 'La tabella delle FAQ non è stata inizializzata. Eseguire /api/init-db',
          details: error.message
        } 
      });
    } else {
      return res.status(500).json({ 
        error: { 
          message: 'Errore interno del server',
          details: error.message
        } 
      });
    }
  }
});

// Endpoint per aggiornare una FAQ esistente
router.put('/faqs/:id', verificaAutenticazione, async (req, res) => {
  try {
    const { id } = req.params;
    const { category, title, description, resolution, status, notes, image_url } = req.body; // Added notes and image_url
    const userId = req.user ? req.user.id : null;

    if (!category || !title || !description || !resolution) {
      return res.status(400).json({ error: { message: 'Tutti i campi sono obbligatori' } });
    }

    // Verifica che la FAQ esista
    const faqCheck = await pool.query('SELECT * FROM faqs WHERE id = $1', [id]);
    if (faqCheck.rows.length === 0) {
      return res.status(404).json({ error: { message: 'FAQ non trovata' } });
    }

    // Verifica che la categoria esista
    let categoryExists = false;
    try {
      const categoryCheck = await pool.query('SELECT id FROM categories WHERE name = $1', [category]);
      categoryExists = categoryCheck.rows.length > 0;
    } catch (categoryError) {
      console.warn('Errore verifica categoria:', categoryError);
    }

    // Se la categoria non esiste, la crea automaticamente
    if (!categoryExists) {
      try {
        await pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT DO NOTHING', [category]);
        console.log('Categoria creata automaticamente:', category);
      } catch (createCategoryError) {
        console.warn('Errore creazione categoria:', createCategoryError);
      }
    }

    // Aggiorna la FAQ nel database
    const query = `
      UPDATE faqs 
      SET category = $1, 
          title = $2, 
          description = $3, 
          resolution = $4, 
          status = $5,
          notes = $6, // Added notes
          image_url = $7, // Added image_url
          updated_at = NOW()
      WHERE id = $8 
      RETURNING *
    `;
    const params = [category, title, description, resolution, status || 'Nuovo', notes || null, image_url || null, id]; // Added notes and image_url

    const result = await pool.query(query, params);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Errore aggiornamento FAQ:', error);
    return res.status(500).json({ 
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
        updated_at TIMESTAMP,
        notes TEXT,  // Added notes column
        image_url VARCHAR(255)  // Added image_url column
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

// Endpoint per recuperare tutti gli utenti (solo per admin)
router.get('/users', verificaAutenticazione, async (req, res) => {
  try {
    // Verifica se l'utente è un amministratore
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: {
          message: 'Accesso non autorizzato: è richiesto il ruolo di amministratore'
        }
      });
    }

    const client = await pool.connect();
    try {
      const query = 'SELECT id, email, role, created_at FROM users ORDER BY created_at DESC';
      const result = await client.query(query);

      return res.status(200).json(result.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Errore recupero utenti:', err);
    return res.status(500).json({ 
      error: {
        message: 'Errore durante il recupero degli utenti',
        details: err.message
      }
    });
  }
});

// Endpoint per modificare il ruolo di un utente (solo per admin)
router.put('/users/:id/role', verificaAutenticazione, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Verifica se l'utente è un amministratore
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: {
          message: 'Accesso non autorizzato: è richiesto il ruolo di amministratore'
        }
      });
    }

    if (!role || !['admin', 'user'].includes(role)) {
      return res.status(400).json({ 
        error: {
          message: 'Ruolo non valido. I ruoli consentiti sono: admin, user'
        }
      });
    }

    const client = await pool.connect();
    try {
      const query = 'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role';
      const result = await client.query(query, [role, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          error: {
            message: 'Utente non trovato'
          }
        });
      }

      return res.status(200).json({ 
        success: true, 
        user: result.rows[0],
        message: `Ruolo utente aggiornato a ${role}`
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Errore aggiornamento ruolo:', err);
    return res.status(500).json({ 
      error: {
        message: 'Errore durante l\'aggiornamento del ruolo',
        details: err.message
      }
    });
  }
});

// Endpoint per eliminare un utente (solo per admin)
router.delete('/users/:id', verificaAutenticazione, async (req, res) => {
  try {
    const { id } = req.params;

    // Verifica se l'utente è un amministratore
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: {
          message: 'Accesso non autorizzato: è richiesto il ruolo di amministratore'
        }
      });
    }

    // Non permettere di eliminare il proprio account
    if (req.user.id.toString() === id) {
      return res.status(400).json({ 
        error: {
          message: 'Non è possibile eliminare il proprio account'
        }
      });
    }

    const client = await pool.connect();
    try {
      const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          error: {
            message: 'Utente non trovato'
          }
        });
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Utente eliminato con successo'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Errore eliminazione utente:', err);
    return res.status(500).json({ 
      error: {
        message: 'Errore durante l\'eliminazione dell\'utente',
        details: err.message
      }
    });
  }
});

// Endpoint per richiedere il recupero password di un utente (per admin)
router.post('/users/recover', verificaAutenticazione, async (req, res) => {
  try {
    const { email } = req.body;

    // Verifica se l'utente è un amministratore
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Accesso non autorizzato: è richiesto il ruolo di amministratore'
      });
    }

    // Verifica se l'email esiste nel database
    const userQuery = 'SELECT * FROM users WHERE email = $1';
    const userResult = await pool.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    const user = userResult.rows[0];

    // Genera un token univoco per il reset della password
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 1); // Token valido per 1 ora

    // Salva il token nel database
    const updateQuery = 'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3';
    await pool.query(updateQuery, [resetToken, tokenExpiry, user.id]);

    // Invio email configurato in server
    const nodemailer = require('nodemailer');

    try {
      // Configura il trasporto email con le credenziali dal file .env
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });

      // Costruisci l'URL di reset con il token
      const appUrl = process.env.APP_URL || `http://${req.headers.host}`;
      const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

      // Contenuto dell'email
      const mailOptions = {
        from: process.env.SMTP_FROM || '"FAQ Portal" <noreply@faqportal.com>',
        to: email,
        subject: 'Recupero Password - FAQ Portal',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FFD700; text-align: center;">FAQ Portal - Recupero Password</h2>
            <p>Gentile utente,</p>
            <p>È stato richiesto il recupero della tua password. Clicca sul pulsante qui sotto per impostare una nuova password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #FFD700; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reimposta Password</a>
            </div>
            <p>Il link sarà valido per un'ora.</p>
            <p>Cordiali saluti,<br>Il team di FAQ Portal</p>
          </div>
        `
      };

      // Invio dell'email
      await transporter.sendMail(mailOptions);

      return res.status(200).json({ 
        success: true, 
        message: 'Email di recupero inviata con successo' 
      });
    } catch (emailError) {
      console.error('Errore invio email:', emailError);
      return res.status(500).json({ 
        error: 'Errore durante l\'invio dell\'email di recupero',
        details: emailError.message
      });
    }
  } catch (err) {
    console.error('Errore recupero password:', err);
    return res.status(500).json({ 
      error: 'Errore durante il recupero della password',
      details: err.message 
    });
  }
});

module.exports = router;