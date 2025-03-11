
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
    
    const { data, error } = await supabase.from('faqs').insert([{
      category,
      title,
      description,
      resolution
    }]);
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    return res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('Errore salvataggio FAQ:', err);
    return res.status(500).json({ error: 'Errore durante il salvataggio della FAQ' });
  }
});

module.exports = router;
