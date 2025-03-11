
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
    
    console.log('API Mobile - Richiesta inserimento FAQ:', {
      category, 
      title,
      descriptionLength: description?.length || 0,
      resolutionLength: resolution?.length || 0
    });
    
    if (!category || !title || !description || !resolution) {
      console.error('API Mobile - Campi mancanti:', { category, title, description, resolution });
      return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
    }
    
    // Verifica prima se la tabella esiste
    console.log('API Mobile - Verifica tabella...');
    try {
      const { data: tableCheck, error: tableError } = await supabase
        .from('faqs')
        .select('id')
        .limit(1);
      
      if (tableError) {
        console.error('API Mobile - Errore verifica tabella:', tableError);
        
        if (tableError.code === '42P01') {
          // La tabella non esiste, proviamo a crearla
          console.log('API Mobile - Creazione tabella...');
          try {
            const { error: rpcError } = await supabase.rpc('exec_sql', {
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
            
            if (rpcError) {
              console.error('API Mobile - Errore RPC creazione tabella:', rpcError);
              // Fallback diretto a Supabase
              console.log('API Mobile - Tentativo diretto creazione tabella...');
              await supabase.auth.getSession();
            } else {
              console.log('API Mobile - Tabella creata con successo tramite RPC');
            }
          } catch (createErr) {
            console.error('API Mobile - Errore creazione tabella:', createErr);
            return res.status(500).json({ 
              error: 'Errore nella creazione della tabella',
              details: createErr.message,
              stack: createErr.stack
            });
          }
        }
      } else {
        console.log('API Mobile - Tabella esistente, record trovati:', tableCheck?.length || 0);
      }
    } catch (checkErr) {
      console.error('API Mobile - Eccezione verifica tabella:', checkErr);
    }
    
    // Ora proviamo a inserire i dati
    console.log('API Mobile - Inserimento dati...');
    const { data, error } = await supabase
      .from('faqs')
      .insert([{
        category,
        title,
        description,
        resolution
      }])
      .select();
    
    if (error) {
      console.error('API Mobile - Errore inserimento dati:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      return res.status(500).json({ 
        error: 'Errore inserimento dati',
        message: error.message,
        code: error.code,
        hint: error.hint || 'Verifica le credenziali di accesso al database o i permessi'
      });
    }
    
    console.log('API Mobile - FAQ inserita con successo:', data);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('API Mobile - Errore salvataggio FAQ:', err);
    return res.status(500).json({ 
      error: 'Errore durante il salvataggio della FAQ',
      details: err.message,
      stack: err.stack
    });
  }
});

module.exports = router;
