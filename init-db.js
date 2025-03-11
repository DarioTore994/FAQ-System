const pool = require('./db');

async function initDatabase() {
  try {
    // Drop existing tables to reset everything with CASCADE
    await pool.query(`
      DROP TABLE IF EXISTS faqs CASCADE;
      DROP TABLE IF EXISTS categories CASCADE;
      DROP TABLE IF EXISTS password_reset_tokens CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        reset_token VARCHAR(255),
        reset_token_expiry TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS faqs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        resolution TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'Nuovo',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP
      );
    `);

    // Inserisci categorie di base
    await pool.query(`
      INSERT INTO categories (name, description)
      VALUES 
        ('Hardware', 'Problemi relativi a dispositivi fisici'),
        ('Software', 'Problemi relativi a programmi e applicazioni'),
        ('Network', 'Problemi di rete e connettività'),
        ('Security', 'Problemi di sicurezza informatica')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Inserisci utenti di default con password note
    const bcrypt = require('bcrypt');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const testPassword = await bcrypt.hash('test123', 10);
    
    await pool.query(`
      INSERT INTO users (email, password, role)
      VALUES 
        ('admin@example.com', $1, 'admin'),
        ('test@example.com', $2, 'user')
      ON CONFLICT (email) DO UPDATE 
      SET password = EXCLUDED.password;
    `, [adminPassword, testPassword]);
    
    console.log('Utenti di default creati/aggiornati con successo');

    console.log('Database inizializzato con successo!');
  } catch (error) {
    console.error('Errore inizializzazione database:', error);
    throw error;
  }
}

// Esegui l'inizializzazione del database
initDatabase().catch(console.error);

module.exports = { initDatabase };