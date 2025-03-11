
const pool = require('./db');

async function initDatabase() {
  try {
    // Drop existing tables to reset everything
    await pool.query(`
      DROP TABLE IF EXISTS faqs;
      DROP TABLE IF EXISTS categories;
      DROP TABLE IF EXISTS users;
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
        user_id INTEGER,
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

    // Inserisci un utente admin di default
    await pool.query(`
      INSERT INTO users (email, password, role)
      VALUES ('admin@example.com', '$2b$10$mLTY0eIwGQeudBA4jKkVk.S0T7JFttKVw0jECkqW5yBhY.LdH0tSi', 'admin')
      ON CONFLICT (email) DO NOTHING;
    `);

    console.log('Database inizializzato con successo!');
  } catch (error) {
    console.error('Errore inizializzazione database:', error);
    throw error;
  }
}

// Esegui l'inizializzazione del database
initDatabase().catch(console.error);

module.exports = { initDatabase };
