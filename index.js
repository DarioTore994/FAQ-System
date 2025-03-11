// Load environment variables
require("dotenv").config();
const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const cookieParser = require('cookie-parser');
const { execSync } = require('child_process');
const flash = require('express-flash');

// Build Tailwind CSS
try {
  console.log('Building Tailwind CSS...');
  execSync('npm run build:css');
  console.log('Tailwind CSS built successfully');
} catch (error) {
  console.error('Error building Tailwind CSS:', error.message);
}

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

    // Crea la tabella delle categorie se non esiste
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Tabella categories verificata/creata con successo');

    // Controlla se la tabella faqs esiste
    const faqsTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'faqs'
      );
    `);

    // Crea la tabella faqs solo se non esiste
    if (!faqsTableCheck.rows[0].exists) {
      await client.query(`
        CREATE TABLE faqs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          resolution TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      console.log('Tabella faqs creata con successo');
    } else {
      console.log('Tabella faqs esistente mantenuta');
    }

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

      // Verifica se ci sono già categorie
      const existingCategories = await client.query('SELECT COUNT(*) FROM categories');

      // Se non ci sono categorie, inserisci le categorie predefinite
      if (parseInt(existingCategories.rows[0].count) === 0) {
        const defaultCategories = ['Hardware', 'Software', 'Network', 'Security'];

        for (const category of defaultCategories) {
          await client.query(
            'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
            [category]
          );
        }
        console.log('Categorie predefinite create con successo!');
      }

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
app.use(flash());

// Middleware per controllo autenticazione
const requireAuth = (req, res, next) => {
  const authToken = req.cookies.authToken;
  if (!authToken) {
    // Se è una richiesta API, restituisci un errore JSON
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ 
        error: 'Accesso non autorizzato. Effettua il login per continuare.'
      });
    }
    return res.redirect('/auth');
  }
  next();
};

// Middleware per controllo ruolo admin
const requireAdmin = async (req, res, next) => {
  const authToken = req.cookies.authToken;
  if (!authToken) {
    // Se è una richiesta API, restituisci un errore JSON
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ 
        error: 'Accesso non autorizzato. Effettua il login per continuare.'
      });
    }
    return res.redirect('/auth');
  }

  // Verifica se il token corrisponde a un utente con ruolo admin
  try {
    const userId = parseInt(authToken, 10);
    if (isNaN(userId)) {
      // Se è una richiesta API, restituisci un errore JSON
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ 
          error: 'Accesso non autorizzato. Token di autenticazione non valido.'
        });
      }
      return res.redirect('/auth');
    }

    const client = await pool.connect();
    try {
      const result = await client.query('SELECT role FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
        // Se è una richiesta API, restituisci un errore JSON
        if (req.path.startsWith('/api/')) {
          return res.status(403).json({ 
            error: 'Accesso non autorizzato. Solo gli admin possono accedere a questa pagina.'
          });
        }
        // Altrimenti renderizza la pagina ma con messaggio di errore
        req.flash('error', 'Accesso non autorizzato. Solo gli admin possono accedere a questa pagina.');
        return res.redirect('/');
      }
      next();
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Errore verifica ruolo admin:', error);
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ 
        error: 'Errore del server durante la verifica delle autorizzazioni.'
      });
    }
    res.redirect('/auth');
  }
};

// Rotte
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "views/index.html")),
);
app.get("/auth", (req, res) =>
  res.sendFile(path.join(__dirname, "views/auth.html")),
);
app.get("/login", (req, res) =>
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
app.get("/categories", requireAdmin, (req, res) =>
  res.sendFile(path.join(__dirname, "views/categories.html")),
);

// API autenticazione
app.get("/api/auth/check", async (req, res) => {
  const authToken = req.cookies.authToken;
  if (!authToken) {
    console.log('Nessun token trovato nei cookie');
    return res.json({ authenticated: false });
  }

  try {
    // Decodifica il token per ottenere l'id utente
    const userId = parseInt(authToken, 10);
    if (isNaN(userId)) {
      console.log('Token non valido (non è un numero)');
      return res.json({ authenticated: false });
    }

    const client = await pool.connect();
    try {
      const result = await client.query('SELECT id, email, role FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0) {
        console.log('Utente non trovato nel database');
        // Puliamo il cookie se l'utente non esiste
        res.clearCookie('authToken', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/'
        });
        return res.json({ authenticated: false });
      }

      const user = result.rows[0];
      console.log('Utente autenticato:', user.email);
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
  // Imposta le stesse opzioni usate durante la creazione del cookie
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });

  // Scrivo sul console per debug
  console.log('Utente disconnesso');

  // Risposta standard
  res.json({ success: true, message: 'Utente disconnesso con successo' });
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

// API per modificare completamente un utente (solo per admin)
app.put("/api/users/:id", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { email, password, role } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID utente non valido' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email obbligatoria' });
    }

    if (role && !['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Ruolo non valido. Deve essere "admin" o "user"' });
    }

    const client = await pool.connect();
    try {
      // Controllo se l'utente esiste
      const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      // Verifico se l'email è già usata da un altro utente
      const emailCheck = await client.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Questa email è già utilizzata da un altro utente' });
      }

      // Preparo la query di aggiornamento in base ai campi forniti
      let query = 'UPDATE users SET email = $1';
      const queryParams = [email];
      let paramIndex = 2;

      if (password) {
        query += `, password = $${paramIndex}`;
        queryParams.push(password);
        paramIndex++;
      }

      if (role) {
        query += `, role = $${paramIndex}`;
        queryParams.push(role);
        paramIndex++;
      }

      query += ` WHERE id = $${paramIndex}`;
      queryParams.push(userId);

      // Esegui l'aggiornamento
      await client.query(query, queryParams);

      return res.json({ 
        success: true, 
        message: 'Utente aggiornato con successo',
        user: {
          id: userId,
          email: email,
          role: role
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Errore aggiornamento utente:', error);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
});

// API per modificare il ruolo di un utente (solo per admin)
app.put("/api/users/:id/role", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { role } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID utente non valido' });
    }

    if (!role || !['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Ruolo non valido. Deve essere "admin" o "user"' });
    }

    const client = await pool.connect();
    try {
      // Controllo se l'utente esiste
      const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      // Aggiorna il ruolo dell'utente
      await client.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);

      return res.json({ success: true, message: 'Ruolo aggiornato con successo' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Errore aggiornamento ruolo:', error);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
});

// API per eliminare un utente (solo per admin)
app.delete("/api/users/:id", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID utente non valido' });
    }

    // Controllo se l'utente sta cercando di eliminare se stesso
    const authToken = req.cookies.authToken;
    const currentUserId = parseInt(authToken, 10);
    
    if (userId === currentUserId) {
      return res.status(400).json({ error: 'Non puoi eliminare il tuo account mentre sei loggato' });
    }

    const client = await pool.connect();
    try {
      // Controllo se l'utente esiste
      const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      // Prima di eliminare l'utente, verifichiamo se ha delle FAQ associate
      const faqsCheck = await client.query('SELECT COUNT(*) FROM faqs WHERE user_id = $1', [userId]);
      
      if (parseInt(faqsCheck.rows[0].count) > 0) {
        // Opzione 1: impedire l'eliminazione
        // return res.status(400).json({ error: 'Non è possibile eliminare questo utente perché ha delle FAQ associate' });
        
        // Opzione 2: eliminare anche le FAQ associate (più pulito)
        await client.query('DELETE FROM faqs WHERE user_id = $1', [userId]);
      }

      // Elimina l'utente
      await client.query('DELETE FROM users WHERE id = $1', [userId]);

      return res.json({ success: true, message: 'Utente eliminato con successo' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Errore eliminazione utente:', error);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
});

// API per ottenere tutte le categorie
app.get("/api/categories", async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM categories ORDER BY name');
    return res.json(result.rows);
  } catch (error) {
    console.error("Errore nel recupero delle categorie:", error);
    return res.status(500).json({ error: 'Errore interno del server' });
  } finally {
    client.release();
  }
});

// API per aggiungere una nuova categoria (solo admin)
app.post("/api/categories", requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Il nome della categoria è obbligatorio' });
    }

    // Verifica se la categoria esiste già
    const existingCategory = await client.query('SELECT id FROM categories WHERE name = $1', [name]);
    if (existingCategory.rows.length > 0) {
      return res.status(400).json({ error: 'Questa categoria esiste già' });
    }

    const result = await client.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [name]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Errore durante l'aggiunta della categoria:", error);
    return res.status(500).json({ error: 'Errore interno del server' });
  } finally {
    client.release();
  }
});

// API per eliminare una categoria (solo admin)
app.delete("/api/categories/:id", requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const categoryId = parseInt(req.params.id, 10);

    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'ID categoria non valido' });
    }

    // Verifica se ci sono FAQ associate a questa categoria
    const faqCheck = await client.query('SELECT COUNT(*) FROM faqs WHERE category = (SELECT name FROM categories WHERE id = $1)', [categoryId]);

    if (parseInt(faqCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Non è possibile eliminare questa categoria perché esistono FAQ associate ad essa' });
    }

    // Elimina la categoria
    const result = await client.query('DELETE FROM categories WHERE id = $1 RETURNING id', [categoryId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoria non trovata' });
    }

    return res.json({ success: true, message: 'Categoria eliminata con successo' });
  } catch (error) {
    console.error("Errore durante l'eliminazione della categoria:", error);
    return res.status(500).json({ error: 'Errore interno del server' });
  } finally {
    client.release();
  }
});

// API per modificare una categoria (solo admin)
app.put("/api/categories/:id", requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const categoryId = parseInt(req.params.id, 10);
    const { name } = req.body;

    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'ID categoria non valido' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Il nome della categoria è obbligatorio' });
    }

    // Verifica se la categoria esiste
    const categoryCheck = await client.query('SELECT id FROM categories WHERE id = $1', [categoryId]);
    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Categoria non trovata' });
    }

    // Verifica se il nuovo nome esiste già
    const existingCategory = await client.query('SELECT id FROM categories WHERE name = $1 AND id != $2', [name, categoryId]);
    if (existingCategory.rows.length > 0) {
      return res.status(400).json({ error: 'Esiste già una categoria con questo nome' });
    }

    // Aggiorna la categoria
    await client.query('UPDATE categories SET name = $1 WHERE id = $2', [name, categoryId]);

    // Aggiorna anche le FAQ associate alla categoria
    const oldCategoryName = await client.query('SELECT name FROM categories WHERE id = $1', [categoryId]);
    if (oldCategoryName.rows.length > 0) {
      await client.query('UPDATE faqs SET category = $1 WHERE category = $2', [name, oldCategoryName.rows[0].name]);
    }

    return res.json({ success: true, message: 'Categoria aggiornata con successo' });
  } catch (error) {
    console.error("Errore durante l'aggiornamento della categoria:", error);
    return res.status(500).json({ error: 'Errore interno del server' });
  } finally {
    client.release();
  }
});

// Importa e usa le API per l'app mobile
const apiEndpoints = require('./api-endpoints');
app.use('/api/mobile', apiEndpoints);

// Endpoint per inserire una nuova FAQ (solo admin)
app.post("/api/faqs", requireAuth, async (req, res) => {
  let client;
  try {
    // Validate that all required fields are present
    const { category, title, description, resolution } = req.body;
    const authToken = req.cookies.authToken;
    let userId;

    if (!authToken) {
      return res.status(401).json({ error: { message: 'Non autenticato' } });
    }

    try {
      userId = parseInt(authToken, 10);
      if (isNaN(userId)) {
          return res.status(401).json({ error: { message: 'Token non valido' } });
      }
    } catch (error) {
      return res.status(401).json({ error: { message: 'Token non valido' } });
    }

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

    client = await pool.connect();

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

    // Verifica che la tabella faqs esista già
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'faqs'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      // Crea la tabella con la struttura corretta
      await client.query(`
        CREATE TABLE faqs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          resolution TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      console.log('Tabella faqs creata con successo!');
    } else {
      console.log('Tabella faqs esistente verificata');
    }

    // Inserimento della FAQ
    const result = await client.query(
      'INSERT INTO faqs (user_id, category, title, description, resolution) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, category, title, description, resolution]
    );

    console.log('FAQ inserita con successo:', result.rows[0]);
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Errore imprevisto durante inserimento FAQ:', err);

    // Controlla se è un errore di colonna mancante
    if (err.message && err.message.includes("column \"user_id\" of relation \"faqs\" does not exist")) {
      return res.status(500).json({ 
        error: { 
          message: 'Errore durante il salvataggio nel database', 
          details: 'La struttura della tabella FAQ non è corretta. Usa /api/init-db per inizializzarla.',
          code: 'TABLE_STRUCTURE' 
        } 
      });
    }

    return res.status(500).json({ 
      error: { 
        message: 'Errore interno del server', 
        details: err.toString(),
        stack: err.stack 
      } 
    });
  } finally {
    if (client) client.release();
  }
});

// API per ottenere le FAQ
app.get("/api/faqs", async (req, res) => {
  const client = await pool.connect();
  try {
    // Verifica la struttura della tabella faqs prima di eseguire la query
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'faqs'
        );
      `);
      
      if (!tableCheck.rows[0].exists) {
        // Crea la tabella se non esiste
        await client.query(`
          CREATE TABLE faqs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            resolution TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        console.log('Tabella faqs creata automaticamente');
        
        // Inserisci almeno una FAQ di esempio
        const adminResult = await client.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['admin']);
        if (adminResult.rows.length > 0) {
          const adminId = adminResult.rows[0].id;
          await client.query(
            'INSERT INTO faqs (user_id, category, title, description, resolution) VALUES ($1, $2, $3, $4, $5)',
            [adminId, 'Generale', 'Benvenuto nel FAQ Portal', 'Questa è una FAQ di esempio', 'Puoi creare nuove FAQ dal pannello di amministrazione.']
          );
        }
      }
    } catch (tableError) {
      console.error('Errore verifica tabella:', tableError);
    }

    const { category, limit = 50 } = req.query;
    const limitNum = parseInt(limit, 10) || 50;

    let query, result;
    if (category && category !== 'all') {
      query = 'SELECT * FROM faqs WHERE category = $1 ORDER BY created_at DESC LIMIT $2';
      result = await client.query(query, [category, limitNum]);
    } else {
      query = 'SELECT * FROM faqs ORDER BY created_at DESC LIMIT $1';
      result = await client.query(query, [limitNum]);
    }

    console.log(`FAQ recuperate: ${result.rows.length}`);
    return res.json(result.rows);
  } catch (error) {
    console.error("Errore nel recupero delle FAQ:", error);
    return res.status(500).json({ error: error.message, stack: error.stack });
  } finally {
    client.release();
  }
});

// Endpoint per verificare/creare la tabella faqs
app.post("/api/init-db", async (req, res) => {
  const client = await pool.connect();
  try {
    // Verifica se la tabella faqs esiste
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'faqs'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      // Crea la tabella solo se non esiste
      await client.query(`
        CREATE TABLE faqs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          resolution TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      console.log('Tabella faqs creata con successo!');
    } else {
      // Verifica la struttura della tabella esistente
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'faqs' AND column_name = 'user_id'
      `);

      if (columnCheck.rows.length === 0) {
        console.log('Tabella faqs esiste ma manca la colonna user_id, riparazione necessaria');
        // ALTER TABLE per aggiungere la colonna mancante se necessario
        await client.query(`
          ALTER TABLE faqs 
          ADD COLUMN IF NOT EXISTS user_id INTEGER;
        `);

        // Ottieni l'ID dell'admin per riparare i record esistenti
        const adminUser = await client.query(`
          SELECT id FROM users WHERE role = 'admin' LIMIT 1
        `);

        if (adminUser.rows.length > 0) {
          const adminId = adminUser.rows[0].id;
          // Aggiorna i record esistenti con l'ID admin
          await client.query(`
            UPDATE faqs SET user_id = $1 WHERE user_id IS NULL
          `, [adminId]);

          // Aggiungi il vincolo NOT NULL e la referenza
          await client.query(`
            ALTER TABLE faqs 
            ALTER COLUMN user_id SET NOT NULL,
            ADD CONSTRAINT faqs_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES users(id)
          `);
        }
      }
      console.log('Tabella faqs verificata e mantenuta');
    }

    // Ottieni l'utente admin per l'inserimento dei dati demo
    const adminResult = await client.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['admin']);

    if (adminResult.rows.length > 0) {
      const adminId = adminResult.rows[0].id;

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
          'INSERT INTO faqs (user_id, category, title, description, resolution) VALUES ($1, $2, $3, $4, $5)',
          [adminId, faq.category, faq.title, faq.description, faq.resolution]
        );
      }
    }

    return res.json({ success: true, message: 'Tabella creata con successo' });
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

app.listen(port, () => console.log(`Server running on port ${port}`))
  .on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`La porta ${port} è già in uso. Prova a terminare l'altro processo o utilizza un'altra porta.`);
      // Tenta di utilizzare una porta alternativa
      const alternativePort = 3001;
      console.log(`Tentativo di utilizzare la porta alternativa ${alternativePort}...`);
      app.listen(alternativePort, () => console.log(`Server running on alternative port ${alternativePort}`));
    } else {
      console.error('Errore avvio server:', error);
    }
  });