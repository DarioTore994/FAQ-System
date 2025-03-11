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

// Inizializza la tabella faqs se non esiste
async function initDatabase() {
  const client = await pool.connect();
  try {
    // Verifica se la tabella esiste e se necessario la crea
    await client.query(`
      CREATE TABLE IF NOT EXISTS faqs (
        id SERIAL PRIMARY KEY,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        resolution TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Tabella faqs verificata/creata con successo');

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
          'INSERT INTO faqs (category, title, description, resolution) VALUES ($1, $2, $3, $4)',
          [faq.category, faq.title, faq.description, faq.resolution]
        );
      }
      console.log('Dati demo inseriti con successo!');
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

// Rotte
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "views/index.html")),
);
app.get("/auth", (req, res) =>
  res.sendFile(path.join(__dirname, "views/auth.html")),
);
app.get("/create", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "views/faq-create.html")),
);
app.get("/dashboard", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "views/dashboard.html")),
);

// API autenticazione
app.get("/api/auth/check", (req, res) => {
  const authToken = req.cookies.authToken;
  res.json({ authenticated: !!authToken });
});

app.post("/api/auth/login", (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token mancante' });
  }

  // Impostazione del cookie di autenticazione
  res.cookie('authToken', token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 giorni
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  res.json({ success: true });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie('authToken');
  res.json({ success: true });
});

// Importa e usa le API per l'app mobile
const apiEndpoints = require('./api-endpoints');
app.use('/api/mobile', apiEndpoints);

// Endpoint per inserire una nuova FAQ
app.post("/api/faqs", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    // Validate that all required fields are present
    const { category, title, description, resolution } = req.body;

    console.log('Ricevuta richiesta di salvataggio FAQ:', {
      category, title, 
      description: description?.substring(0, 20) + '...',
      resolution: resolution?.substring(0, 20) + '...'
    });

    if (!category || !title || !description || !resolution) {
      console.error('Campi mancanti:', { category, title, description, resolution });
      return res.status(400).json({ 
        error: { message: 'Tutti i campi sono obbligatori' } 
      });
    }

    console.log('Tentativo di inserimento FAQ...');

    // Inserimento della FAQ
    const result = await client.query(
      'INSERT INTO faqs (category, title, description, resolution) VALUES ($1, $2, $3, $4) RETURNING *',
      [category, title, description, resolution]
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