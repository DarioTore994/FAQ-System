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
      console.log('Inizializzazione della tabella faqs...');
      // In realtà non possiamo creare tabelle direttamente con la client API di Supabase
      // Questo va fatto nell'interfaccia di Supabase o tramite la RDBMS API
      console.log('Favor visitare l\'interfaccia di Supabase per creare la tabella faqs con i seguenti campi:');
      console.log('- id (integer, primary key)');
      console.log('- category (string)');
      console.log('- title (string)');
      console.log('- description (string)');
      console.log('- resolution (string)');
      console.log('- created_at (timestamp with timezone, default: now())');
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
  const { data, error } = await supabase.from("faqs").insert([req.body]);
  error ? res.status(500).json({ error }) : res.json(data);
});

// API per FAQ
app.get("/api/faqs", async (req, res) => {
  const { category } = req.query;
  let query = supabase.from("faqs").select("*");

  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  error ? res.status(500).json({ error }) : res.json(data);
});

app.listen(port, () => console.log(`Server running on port ${port}`));
