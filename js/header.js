document.addEventListener('DOMContentLoaded', async function() {
    try {
        const logoutBtn = document.getElementById('logoutBtn');
        const loginBtn = document.getElementById('loginBtn');

        // Aggiungi event listener per il logout
        if (logoutBtn) {
            logoutBtn.addEventListener('click', performLogout);
        }

        const response = await fetch('/api/auth/check');

        if (!response.ok) {
            // Non autenticato - mostra solo login
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (logoutBtn) logoutBtn.classList.add('hidden');
            
            const authUserContainer = document.getElementById('authUserContainer');
            if (authUserContainer) authUserContainer.classList.add('hidden');
            
            const adminMenu = document.getElementById('adminMenu');
            if (adminMenu) adminMenu.classList.add('hidden');
            return;
        }

        const data = await response.json();

        if (data.authenticated) {
            // Utente autenticato
            if (loginBtn) loginBtn.classList.add('hidden');
            
            const authUserContainer = document.getElementById('authUserContainer');
            if (authUserContainer) authUserContainer.classList.remove('hidden');

            // Mostra pulsante logout
            if (logoutBtn) logoutBtn.classList.remove('hidden');

            // Menu admin visibile solo per amministratori
            if (data.user && data.user.role === 'admin') {
                const adminMenu = document.getElementById('adminMenu');
                if (adminMenu) adminMenu.classList.remove('hidden');
            }
        } else {
            // Non autenticato - mostra solo login
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (logoutBtn) logoutBtn.classList.add('hidden');
            
            const authUserContainer = document.getElementById('authUserContainer');
            if (authUserContainer) authUserContainer.classList.add('hidden');
            
            const adminMenu = document.getElementById('adminMenu');
            if (adminMenu) adminMenu.classList.add('hidden');
        }
    } catch (error) {
        console.error('Errore header.js:', error);
        // In caso di errore, mostra solo login
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) loginBtn.classList.remove('hidden');
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.classList.add('hidden');
    }
});

async function performLogout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST'
        });

        if (response.ok) {
            window.location.href = '/';
        } else {
            const errorData = await response.json();
            alert(errorData.error || 'Errore durante il logout');
        }
    } catch (error) {
        console.error('Errore durante il logout:', error);
        alert('Errore durante il logout');
    }
}