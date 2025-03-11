// Load environment variables
require("dotenv").config();
const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const cookieParser = require('cookie-parser');

const app = express();
const port = 3000;

// Configurazione PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Inizializza le tabelle del database se non esistono
async function initDatabase() {
  const client = await pool.connect();
  try {
    // Creare la tabella utenti se non esiste
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user', -- 'admin' o 'user'
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Tabella users verificata/creata con successo');

    // Verifica se la tabella esiste e se necessario la crea
    await client.query(`
      CREATE TABLE IF NOT EXISTS faqs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        resolution TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Tabella faqs verificata/creata con successo');

    // Verifica se ci sono già utenti
    const existingUsers = await client.query('SELECT COUNT(*) FROM users');
    
    // Se non ci sono utenti, inserisci un admin di default
    if (parseInt(existingUsers.rows[0].count) === 0) {
      // Nella produzione dovresti usare bcrypt per hashare le password
      await client.query(
        'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id',
        ['admin@example.com', 'admin123', 'admin']
      );
      console.log('Utente admin creato con successo!');
      
      const userResult = await client.query('SELECT id FROM users WHERE email = $1', ['admin@example.com']);
      const adminId = userResult.rows[0].id;
      
      // Verifica se ci sono già dati nella tabella
      const existingData = await client.query('SELECT COUNT(*) FROM faqs');

      // Se non ci sono dati, inserisci dati demo
      if (parseInt(existingData.rows[0].count) === 0) {
        const demoFaqs = [
          {
            category: 'Network',
            title: 'Problema di connessione alla rete',
            description: 'Il computer non riesce a connettersi alla rete Wi-Fi',
            resolution: 'Verifica che il Wi-Fi sia attivo. Riavvia il router. Controlla le impostazioni di rete.'
          },
          {
            category: 'Software',
            title: 'Applicazione non risponde',
            description: 'Un\'applicazione si blocca e non risponde ai comandi',
            resolution: 'Prova a forzare la chiusura dell\'applicazione. Riavvia il computer se necessario.'
          }
        ];

        // Inserimento dati demo
        for (const faq of demoFaqs) {
          await client.query(
            'INSERT INTO faqs (user_id, category, title, description, resolution) VALUES ($1, $2, $3, $4, $5)',
            [adminId, faq.category, faq.title, faq.description, faq.resolution]
          );
        }
        console.log('Dati demo inseriti con successo!');
      }
    }
  } catch (error) {
    console.error('Errore durante l\'inizializzazione del database:', error);
  } finally {
    client.release();
  }
}

// Esegui l'inizializzazione
initDatabase();

// Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware per controllo autenticazione
const requireAuth = (req, res, next) => {
  if (!req.cookies.authToken) {
    return res.redirect('/auth');
  }
  next();
};

// Middleware per controllo ruolo admin
const requireAdmin = async (req, res, next) => {
  if (!req.cookies.authToken) {
    return res.redirect('/auth');
  }
  
  try {
    const userId = parseInt(req.cookies.authToken, 10);
    if (isNaN(userId)) {
      return res.redirect('/auth');
    }
    
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT role FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
        return res.status(403).send('Accesso non autorizzato. Solo gli admin possono accedere a questa pagina.');
      }
      next();
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Errore verifica ruolo admin:', error);
    return res.status(500).send('Errore interno del server');
  }
};

// Rotte
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "views/index.html")),
);
app.get("/auth", (req, res) =>
  res.sendFile(path.join(__dirname, "views/auth.html")),
);
app.get("/create", requireAdmin, (req, res) =>
  res.sendFile(path.join(__dirname, "views/faq-create.html")),
);
app.get("/dashboard", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "views/dashboard.html")),
);
app.get("/admin", requireAdmin, (req, res) =>
  res.sendFile(path.join(__dirname, "views/admin.html")),
);
app.get("/users", requireAdmin, (req, res) =>
  res.sendFile(path.join(__dirname, "views/users.html")),
);

// API autenticazione
app.get("/api/auth/check", async (req, res) => {
  const authToken = req.cookies.authToken;
  if (!authToken) {
    return res.json({ authenticated: false });
  }
  
  try {
    // Decodifica il token per ottenere l'id utente
    const userId = parseInt(authToken, 10);
    if (isNaN(userId)) {
      return res.json({ authenticated: false });
    }
    
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT id, email, role FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0) {
        return res.json({ authenticated: false });
      }
      
      const user = result.rows[0];
      return res.json({ 
        authenticated: true, 
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Errore verifica autenticazione:', error);
    return res.json({ authenticated: false });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password sono obbligatori' });
    }

    const client = await pool.connect();
    try {
      // In produzione dovrai usare bcrypt per verificare le password
      const result = await client.query('SELECT id, email, role FROM users WHERE email = $1 AND password = $2', [email, password]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Credenziali non valide' });
      }
      
      const user = result.rows[0];
      
      // Usa l'ID utente come token (semplificato, in produzione usa JWT)
      const token = user.id.toString();
      
      // Impostazione del cookie di autenticazione
      res.cookie('authToken', token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 giorni
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      res.json({ 
        success: true, 
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Errore login:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, role = 'user' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password sono obbligatori' });
    }
    
    // Solo gli admin possono creare altri admin
    const authToken = req.cookies.authToken;
    if (role === 'admin') {
      if (!authToken) {
        return res.status(403).json({ error: 'Non autorizzato a creare admin' });
      }
      
      const adminCheck = await pool.query(
        'SELECT role FROM users WHERE id = $1', 
        [parseInt(authToken, 10)]
      );
      
      if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
        return res.status(403).json({ error: 'Solo gli admin possono creare altri admin' });
      }
    }

    const client = await pool.connect();
    try {
      // Verifica se l'utente esiste già
      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Email già registrata' });
      }
      
      // In produzione, usa bcrypt per hashare le password
      const result = await client.query(
        'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role',
        [email, password, role]
      );
      
      const user = result.rows[0];
      
      // Se non c'è già una sessione attiva, accedi automaticamente
      if (!authToken) {
        const token = user.id.toString();
        res.cookie('authToken', token, {
          httpOnly: true,
          maxAge: 7 * 24 * 60 * 60 * 1000,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax'
        });
      }

      res.status(201).json({ 
        success: true, 
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Errore registrazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie('authToken');
  res.json({ success: true });
});

// API per ottenere tutti gli utenti (solo per admin)
app.get("/api/users", async (req, res) => {
  const authToken = req.cookies.authToken;
  if (!authToken) {
    return res.status(401).json({ error: 'Non autenticato' });
  }
  
  try {
    const client = await pool.connect();
    
    try {
      // Verifica se l'utente è admin
      const adminCheck = await client.query(
        'SELECT role FROM users WHERE id = $1', 
        [parseInt(authToken, 10)]
      );
      
      if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
        return res.status(403).json({ error: 'Solo gli admin possono vedere la lista utenti' });
      }
      
      // Ottieni tutti gli utenti
      const result = await client.query('SELECT id, email, role, created_at FROM users ORDER BY created_at DESC');
      return res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Errore recupero utenti:', error);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Importa e usa le API per l'app mobile
const apiEndpoints = require('./api-endpoints');
app.use('/api/mobile', apiEndpoints);

// Endpoint per inserire una nuova FAQ (solo admin)
app.post("/api/faqs", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    // Validate that all required fields are present
    const { category, title, description, resolution } = req.body;
    const userId = parseInt(req.cookies.authToken, 10);

    console.log('Ricevuta richiesta di salvataggio FAQ:', {
      userId,
      category, 
      title, 
      description: description?.substring(0, 20) + '...',
      resolution: resolution?.substring(0, 20) + '...'
    });

    if (!category || !title || !description || !resolution) {
      console.error('Campi mancanti:', { category, title, description, resolution });
      return res.status(400).json({ 
        error: { message: 'Tutti i campi sono obbligatori' } 
      });
    }

    // Verifica ruolo utente
    const userResult = await client.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: { message: 'Utente non trovato' }
      });
    }
    
    const userRole = userResult.rows[0].role;
    
    // Solo gli admin possono creare FAQ
    if (userRole !== 'admin') {
      return res.status(403).json({
        error: { message: 'Solo gli admin possono creare nuove FAQ' }
      });
    }

    console.log('Tentativo di inserimento FAQ...');

    // Inserimento della FAQ
    const result = await client.query(
      'INSERT INTO faqs (user_id, category, title, description, resolution) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, category, title, description, resolution]
    );

    console.log('FAQ inserita con successo:', result.rows[0]);
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Errore imprevisto durante inserimento FAQ:', err);
    return res.status(500).json({ 
      error: { 
        message: 'Errore interno del server', 
        details: err.toString(),
        stack: err.stack 
      } 
    });
  } finally {
    client.release();
  }
});

// API per ottenere le FAQ
app.get("/api/faqs", async (req, res) => {
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

    return res.json(result.rows);
  } catch (error) {
    console.error("Errore nel recupero delle FAQ:", error);
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Endpoint per verificare/creare la tabella faqs
app.post("/api/init-db", async (req, res) => {
  const client = await pool.connect();
  try {
    // Verifica se la tabella esiste
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'faqs'
      );
    `);

    if (!tableExists.rows[0].exists) {
      // Crea la tabella se non esiste
      await client.query(`
        CREATE TABLE faqs (
          id SERIAL PRIMARY KEY,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          resolution TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      console.log('Tabella faqs creata con successo!');

      // Inserimento dati demo
      const demoFaqs = [
        {
          category: 'Network',
          title: 'Problema di connessione alla rete',
          description: 'Il computer non riesce a connettersi alla rete Wi-Fi',
          resolution: 'Verifica che il Wi-Fi sia attivo. Riavvia il router. Controlla le impostazioni di rete.'
        }
      ];

      for (const faq of demoFaqs) {
        await client.query(
          'INSERT INTO faqs (category, title, description, resolution) VALUES ($1, $2, $3, $4)',
          [faq.category, faq.title, faq.description, faq.resolution]
        );
      }

      return res.json({ success: true, message: 'Tabella creata con successo' });
    } else {
      return res.json({ success: true, message: 'Tabella verificata con successo' });
    }
  } catch (error) {
    console.error('Errore durante la verifica/creazione del database:', error);
    return res.status(500).json({ 
      error: error.message, 
      message: 'Errore durante la verifica/creazione del database'
    });
  } finally {
    client.release();
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));