
// API endpoints per l'integrazione con app mobile Flutter
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

// Configura Supabase (utilizza le stesse credenziali)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

// Endpoint per autenticazione
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email, 
      password
    });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(200).json(data);
  } catch (err) {
    console.error('Errore API:', err);
    return res.status(500).json({ error: 'Errore del server' });
  }
});

// Endpoint per ottenere le FAQ
router.get('/faqs', async (req, res) => {
  try {
    const { category } = req.query;
    let query = supabase.from('faqs').select('*');
    
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    
    const { data, error } = await query;
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    return res.status(200).json(data);
  } catch (err) {
    console.error('Errore API FAQ:', err);
    return res.status(500).json({ error: 'Errore durante il recupero delle FAQ' });
  }
});

// Endpoint per salvare una nuova FAQ
router.post('/faqs', async (req, res) => {
  try {
    const { category, title, description, resolution } = req.body;
    
    if (!category || !title || !description || !resolution) {
      return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
    }
    
    // Verifica prima se la tabella esiste
    try {
      const tableCheck = await supabase.from('faqs').select('id').limit(1);
      
      if (tableCheck.error && tableCheck.error.code === '42P01') {
        // La tabella non esiste, proviamo a crearla
        try {
          await supabase.rpc('exec_sql', {
            query_text: `
              CREATE TABLE IF NOT EXISTS faqs (
                id SERIAL PRIMARY KEY,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                resolution TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
              );
            `
          });
          console.log('Tabella creata con successo nell\'API mobile');
        } catch (createErr) {
          console.error('Errore creazione tabella:', createErr);
          return res.status(500).json({ 
            error: 'Errore nella creazione della tabella',
            details: createErr.message
          });
        }
      }
    } catch (checkErr) {
      console.error('Errore verifica tabella:', checkErr);
    }
    
    // Ora proviamo a inserire i dati
    const { data, error } = await supabase.from('faqs').insert([{
      category,
      title,
      description,
      resolution
    }]);
    
    if (error) {
      console.error('Errore inserimento dati:', error);
      return res.status(500).json({ 
        error: error.message,
        details: error 
      });
    }
    
    return res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('Errore salvataggio FAQ:', err);
    return res.status(500).json({ 
      error: 'Errore durante il salvataggio della FAQ',
      details: err.message
    });
  }
});

module.exports = router;
