const express = require('express');
const pool = require('./db');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// Endpoint per verificare se un'email è già registrata
app.get('/api/auth/check-email', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email non fornita' });
  }

  try {
    const query = 'SELECT COUNT(*) FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);

    const exists = parseInt(result.rows[0].count) > 0;
    return res.json({ exists });
  } catch (error) {
    console.error('Errore nella verifica email:', error);
    return res.status(500).json({ error: 'Errore nel controllo email' });
  }
});

// Endpoint per effettuare il recupero della password
app.post('/api/auth/recover-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email non fornita' });
  }

  // Validazione formato email
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: 'Formato email non valido' });
  }

  try {
    // Verifica se l'email esiste nel database
    const userQuery = 'SELECT * FROM users WHERE email = $1';
    const userResult = await pool.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'email_not_found' });
    }

    const user = userResult.rows[0];
    
    // Genera un token univoco per il reset della password
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 1); // Token valido per 1 ora
    
    // Salva il token nel database
    const updateQuery = 'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3';
    await pool.query(updateQuery, [resetToken, tokenExpiry, user.id]);
    
    // Configurazione dell'invio email
    const nodemailer = require('nodemailer');
    
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
    const resetUrl = `${process.env.APP_URL || 'http://localhost:3001'}/reset-password?token=${resetToken}`;
    
    // Contenuto dell'email
    const mailOptions = {
      from: process.env.SMTP_FROM || '"FAQ Portal" <noreply@faqportal.com>',
      to: email,
      subject: 'Recupero Password - FAQ Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #FFD700; text-align: center;">FAQ Portal - Recupero Password</h2>
          <p>Gentile utente,</p>
          <p>Hai richiesto il recupero della tua password. Clicca sul pulsante qui sotto per impostare una nuova password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #FFD700; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reimposta Password</a>
          </div>
          <p>Il link sarà valido per un'ora. Se non hai richiesto tu il recupero password, puoi ignorare questa email.</p>
          <p>Cordiali saluti,<br>Il team di FAQ Portal</p>
        </div>
      `
    };
    
    // Invio dell'email
    await transporter.sendMail(mailOptions);
    
    return res.status(200).json({ success: true, message: 'Email di recupero inviata con successo' });

  } catch (error) {
    console.error('Errore nel recupero password:', error);
    return res.status(500).json({ error: 'Errore nel recupero password' });
  }
});

// Endpoint per la registrazione dell'utente
app.post('/api/auth/register', async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password sono obbligatori' });
  }

  // Validazione formato email
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: 'Formato email non valido' });
  }

  try {
    // Verifica se l'email esiste già
    const checkQuery = 'SELECT COUNT(*) FROM users WHERE email = $1';
    const checkResult = await pool.query(checkQuery, [email]);

    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(409).json({ error: 'Un utente con questa email è già registrato' });
    }

    // Hash della password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Inserimento utente nel database
    const insertQuery = 'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)';
    await pool.query(insertQuery, [email, hashedPassword, role]);

    return res.status(201).json({ message: 'Utente registrato correttamente' });

  } catch (error) {
    console.error('Errore nella registrazione:', error);
    return res.status(500).json({ error: 'Errore nella registrazione' });
  }
});


// ... (rest of the app.js file) ...

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Server started on port ${port}`));