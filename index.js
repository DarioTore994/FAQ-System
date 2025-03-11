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
    
    // Verifica se la tabella esiste prima del salvataggio
    try {
      await supabase.from('faqs').select('count').limit(1);
    } catch (tableError) {
      console.log('Verifica tabella fallita, creazione tabella...');
      try {
        await supabase.sql(`
          CREATE TABLE IF NOT EXISTS faqs (
            id SERIAL PRIMARY KEY,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            resolution TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        console.log('Tabella faqs creata con successo');
      } catch (createErr) {
        console.error('Errore durante la creazione della tabella:', createErr);
        return res.status(500).json({ 
          error: { message: 'Impossibile creare la tabella FAQ', details: createErr } 
        });
      }
    }
    
    const { data, error } = await supabase.from("faqs").insert([req.body]);
    
    if (error) {
      console.error('Errore Supabase durante inserimento FAQ:', error);
      return res.status(500).json({ 
        error: { message: 'Errore durante il salvataggio nel database', details: error } 
      });
    }
    
    console.log('FAQ inserita con successo:', data);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('Errore imprevisto durante inserimento FAQ:', err);
    return res.status(500).json({ 
      error: { message: 'Errore interno del server', details: err.toString() } 
    });
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
app.post("/api/init-db", async (req, res) => {
  try {
    // Inizialmente verifichiamo la connessione al database
    const { data: connectionTest, error: connectionError } = await supabase.from('_schema').select('*').limit(1).catch(err => {
      return { data: null, error: err };
    });
    
    if (connectionError) {
      console.error('Errore di connessione al database:', connectionError);
    }
    
    // Verifichiamo se la tabella esiste già
    const { data: tableTest, error: tableError } = await supabase.from('faqs').select('count').limit(1).catch(err => {
      return { data: null, error: err };
    });
    
    // Se la tabella non esiste, proviamo a crearla
    if (tableError && tableError.code === '42P01') {
      console.log('La tabella non esiste, tentiamo di crearla...');
      
      try {
        // Creiamo la tabella utilizzando SQL
        const { data: createResult, error: sqlError } = await supabase.sql(`
          CREATE TABLE IF NOT EXISTS faqs (
            id SERIAL PRIMARY KEY,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            resolution TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `).catch(err => {
          return { data: null, error: err };
        });
        
        if (sqlError) {
          console.error('Errore durante la creazione della tabella:', sqlError);
          return res.status(500).json({ error: sqlError, message: 'Impossibile creare la tabella' });
        } else {
          console.log('Tabella faqs creata con successo!');
          
          // Proviamo ad inserire dati demo
          const demoFaqs = [
            {
              category: 'Network',
              title: 'Problema di connessione alla rete',
              description: 'Il computer non riesce a connettersi alla rete Wi-Fi',
              resolution: 'Verifica che il Wi-Fi sia attivo. Riavvia il router. Controlla le impostazioni di rete.'
            }
          ];
          
          const { error: insertError } = await supabase.from('faqs').insert(demoFaqs);
          
          if (insertError) {
            console.log('Creazione tabella riuscita ma errore inserimento dati demo:', insertError);
          }
          
          return res.json({ success: true, message: 'Tabella creata con successo' });
        }
      } catch (createError) {
        console.error('Errore critico durante la creazione della tabella:', createError);
        return res.status(500).json({ 
          error: createError, 
          message: 'Errore critico durante la creazione della tabella',
          details: 'Potrebbe essere necessario controllare le credenziali del database o i permessi'
        });
      }
    } else if (tableError) {
      // C'è un errore ma non è relativo alla tabella mancante
      console.error('Errore nella verifica della tabella:', tableError);
      return res.status(500).json({ 
        error: tableError, 
        message: 'Errore nella verifica della tabella',
        connectionTest: connectionTest ? 'OK' : 'Fallito'
      });
    } else {
      // La tabella esiste già
      console.log('Tabella faqs verificata con successo!');
      return res.json({ success: true, message: 'Tabella verificata con successo' });
    }
  } catch (error) {
    console.error('Errore imprevisto durante la verifica/creazione del database:', error);
    return res.status(500).json({ 
      error: error, 
      message: 'Errore imprevisto durante la verifica/creazione del database',
      details: error.toString()
    });
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
