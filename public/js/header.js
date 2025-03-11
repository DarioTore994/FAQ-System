
// Funzione per mostrare o nascondere elementi del menu in base allo stato di autenticazione
async function initializeHeader() {
  try {
    const response = await fetch('/api/auth/check');
    const data = await response.json();

    // Elementi UI comuni in tutte le pagine
    const authUserMenu = document.getElementById('authUserMenu');
    const adminMenu = document.getElementById('adminMenu');
    const loginNavBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Nascondi tutti i menu per default
    if (authUserMenu) authUserMenu.classList.add('hidden');
    if (adminMenu) adminMenu.classList.add('hidden');
    if (loginNavBtn) loginNavBtn.classList.add('hidden');
    if (logoutBtn) logoutBtn.classList.add('hidden');

    if (data.authenticated) {
      // Utente autenticato
      if (logoutBtn) logoutBtn.classList.remove('hidden');
      if (authUserMenu) authUserMenu.classList.remove('hidden');
      if (loginNavBtn) loginNavBtn.classList.add('hidden');

      // Se è admin, mostra il menu admin
      if (data.user && data.user.role === 'admin') {
        if (adminMenu) adminMenu.classList.remove('hidden');
      }
    } else {
      // Utente non autenticato
      if (loginNavBtn) loginNavBtn.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Errore controllo autenticazione:', error);
  }
}

// Inizializza l'header quando il DOM è pronto
document.addEventListener('DOMContentLoaded', initializeHeader);

// Assicuriamoci che il logoutBtn usi sempre la funzione di logout corretta
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include'
        });
        
        if (response.ok) {
          // Cancella i dati da localStorage
          localStorage.removeItem('userRole');
          // Reindirizza alla homepage
          window.location.href = '/';
        } else {
          console.error('Errore durante il logout');
        }
      } catch (error) {
        console.error('Errore durante il logout:', error);
      }
    });
  }
});
