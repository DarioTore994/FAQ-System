// Load environment variables
require("dotenv").config();
const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const cookieParser = require('cookie-parser');

const app = express();
const port = 3000;

// Configura Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

// Inizializza la tabella faqs se non esiste
async function initDatabase() {
  try {
    // Verifica se la tabella esiste
    const { error } = await supabase
      .from('faqs')
      .select('*')
      .limit(1);

    // Se c'è un errore specifico sulla non esistenza della tabella
    if (error && error.code === '42P01') {
      console.log('Tabella faqs non esiste. Tentativo di creare la tabella...');
      
      try {
        // Creiamo la tabella utilizzando SQL
        const { error: createTableError } = await supabase.rpc('create_faqs_table', {});
        
        if (createTableError) {
          console.error('Errore durante la creazione della tabella:', createTableError);
          
          // Eseguiamo direttamente lo SQL per creare la tabella
          const { error: sqlError } = await supabase.sql(`
            CREATE TABLE IF NOT EXISTS faqs (
              id SERIAL PRIMARY KEY,
              category TEXT NOT NULL,
              title TEXT NOT NULL,
              description TEXT NOT NULL,
              resolution TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
          `);
          
          if (sqlError) {
            console.error('Errore durante la creazione della tabella tramite SQL:', sqlError);
          } else {
            console.log('Tabella faqs creata con successo tramite SQL!');
            
            // Inserimento dati demo
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
            
            const { error: insertError } = await supabase.from('faqs').insert(demoFaqs);
            if (!insertError) {
              console.log('Dati demo inseriti con successo!');
            } else {
              console.log('Non è stato possibile inserire dati demo:', insertError);
            }
          }
        } else {
          console.log('Tabella faqs creata con successo!');
          
          // Inserimento dati demo
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
          
          const { error: insertError } = await supabase.from('faqs').insert(demoFaqs);
          if (!insertError) {
            console.log('Dati demo inseriti con successo!');
          } else {
            console.log('Non è stato possibile inserire dati demo:', insertError);
          }
        }
      } catch (createErr) {
        console.error('Errore durante la creazione della tabella:', createErr);
        console.log('È necessario creare manualmente la tabella faqs con i seguenti campi:');
        console.log('- id (integer, primary key)');
        console.log('- category (string)');
        console.log('- title (string)');
        console.log('- description (string)');
        console.log('- resolution (string)');
        console.log('- created_at (timestamp with timezone, default: now())');
        console.log('Accedi all\'interfaccia Supabase e crea questa tabella per far funzionare correttamente l\'applicazione.');
      }
    }
  } catch (err) {
    console.error('Errore inizializzazione database:', err);
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

// Aggiungi questa route
app.post("/api/faqs", requireAuth, async (req, res) => {
  try {
    // Validate that all required fields are present
    const { category, title, description, resolution } = req.body;
    
    if (!category || !title || !description || !resolution) {
      return res.status(400).json({ 
        error: { message: 'Tutti i campi sono obbligatori' } 
      });
    }
    
    const { data, error } = await supabase.from("faqs").insert([req.body]);
    
    if (error) {
      console.error('Errore Supabase durante inserimento FAQ:', error);
      return res.status(500).json({ error });
    }
    
    console.log('FAQ inserita con successo:', data);
    return res.status(201).json(data);
  } catch (err) {
    console.error('Errore imprevisto durante inserimento FAQ:', err);
    return res.status(500).json({ error: { message: 'Errore interno del server' } });
  }
});

// API per FAQ
app.get("/api/faqs", async (req, res) => {
  const { category } = req.query;
  let query = supabase.from("faqs").select("*");

  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  
  if (error) {
    console.error("Errore nel recupero delle FAQ:", error);
    
    // Se la tabella non esiste, prova a crearla
    if (error.code === '42P01') {
      try {
        // Creiamo la tabella utilizzando SQL
        const { error: sqlError } = await supabase.sql(`
          CREATE TABLE IF NOT EXISTS faqs (
            id SERIAL PRIMARY KEY,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            resolution TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        
        if (sqlError) {
          console.error('Errore durante la creazione della tabella:', sqlError);
          return res.status(500).json({ error });
        } else {
          console.log('Tabella faqs creata con successo!');
          return res.json([]);
        }
      } catch (createErr) {
        console.error('Errore durante la creazione della tabella:', createErr);
        return res.status(500).json({ error });
      }
    } else {
      return res.status(500).json({ error });
    }
  } else {
    return res.json(data);
  }
});

// Endpoint per verificare/creare la tabella faqs
app.post("/api/init-db", requireAuth, async (req, res) => {
  try {
    // Creiamo la tabella utilizzando SQL
    const { error: sqlError } = await supabase.sql(`
      CREATE TABLE IF NOT EXISTS faqs (
        id SERIAL PRIMARY KEY,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        resolution TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    
    if (sqlError) {
      console.error('Errore durante la creazione della tabella:', sqlError);
      return res.status(500).json({ error: sqlError });
    } else {
      console.log('Tabella faqs verificata/creata con successo!');
      return res.json({ success: true });
    }
  } catch (error) {
    console.error('Errore imprevisto durante la creazione della tabella:', error);
    return res.status(500).json({ error });
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
