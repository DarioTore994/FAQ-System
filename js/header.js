document.addEventListener('DOMContentLoaded', async function() {
    try {
        const logoutBtn = document.getElementById('logoutBtn');

        // Aggiungi event listener per il logout
        if (logoutBtn) {
            logoutBtn.addEventListener('click', performLogout);
        }

        const response = await fetch('/api/auth/check');

        if (!response.ok) {
            // Non autenticato
            return;
        }

        const data = await response.json();

        if (data.authenticated) {
            // Utente autenticato
            const authUserContainer = document.getElementById('authUserContainer');
            if (authUserContainer) authUserContainer.classList.remove('hidden');

            // Mostra pulsante logout
            if (logoutBtn) logoutBtn.classList.remove('hidden');

            // Menu admin visibile solo per amministratori
            if (data.user.role === 'admin') {
                const adminMenu = document.getElementById('adminMenu');
                if (adminMenu) adminMenu.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Errore header.js:', error);
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