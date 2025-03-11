function showErrorAlert(message, duration = 5000) {
  // Nascondi i pulsanti in caso di errore di autorizzazione
  hideButtonsOnAuthError(message);

  const alertContainer = document.getElementById('alertContainer');
  if (!alertContainer) {
    // Crea il container degli alert se non esiste
    const container = document.createElement('div');
    container.id = 'alertContainer';
    container.className = 'fixed top-4 right-4 z-50 flex flex-col items-end space-y-2';
    document.body.appendChild(container);
  }

  const alert = document.createElement('div');
  alert.className = 'bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 transform transition-all duration-300 ease-in-out opacity-0 translate-y-2';
  alert.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
    </svg>
    <span>${message}</span>
    <button class="ml-2 focus:outline-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>
  `;

  document.getElementById('alertContainer').appendChild(alert);

  // Animazione di entrata
  setTimeout(() => {
    alert.classList.remove('opacity-0', 'translate-y-2');
  }, 10);

  // Aggiungi listener per chiudere l'alert
  alert.querySelector('button').addEventListener('click', () => {
    alert.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => {
      alert.remove();
    }, 300);
  });

  // Rimuovi automaticamente dopo il tempo specificato
  if (duration) {
    setTimeout(() => {
      if (alert.parentNode) {
        alert.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => {
          if (alert.parentNode) {
            alert.remove();
          }
        }, 300);
      }
    }, duration);
  }
}

function hideButtonsOnAuthError(errorMessage) {
  if (errorMessage && errorMessage.includes('Accesso non autorizzato')) {
    console.log('Rilevato errore di accesso non autorizzato, nascondo i pulsanti');

    // Lista degli elementi da nascondere in caso di errore di autorizzazione
    const elementsToHide = [
      // Menu e pulsanti di navigazione
      'authUserMenu',
      'adminMenu',
      'createFaqBtn',
      'logoutBtn',
      'adminLink',
      'usersLink',
      'categoriesLink',

      // Contenitori di amministrazione
      'adminCategorySection',
      'categoryManagement',
      'userManagement',

      // Altri pulsanti di azione
      'addCategoryBtn',
      'createUserBtn',
      'addRoleBtn'
    ];

    // Nascondi tutti gli elementi specificati
    elementsToHide.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        console.log(`Nascondo elemento: ${id}`);
        element.classList.add('hidden');
      }
    });

    // Cerca anche elementi con la classe 'admin-only' e nascondili
    document.querySelectorAll('.admin-only').forEach(element => {
      element.classList.add('hidden');
    });

    // Se siamo nella dashboard o in altre pagine protette, gestisci i contenitori principali
    const contentContainers = [
      'faqContainer',
      'userContainer',
      'categoryContainer',
      'adminContainer'
    ];

    // Mostra un messaggio di errore di autorizzazione
    contentContainers.forEach(id => {
      const container = document.getElementById(id);
      if (container) {
        // Solo se il container esiste, nascondi il contenuto e mostra il messaggio di errore
        const errorContainer = document.createElement('div');
        errorContainer.className = 'p-6 bg-red-500/10 border border-red-500/20 rounded-xl my-8 text-center';
        errorContainer.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-red-500/70 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 class="text-xl font-bold text-red-500/90 mb-2">Accesso non autorizzato</h3>
          <p class="text-gray-400">Non hai i permessi necessari per visualizzare questa pagina.</p>
          <a href="/" class="inline-block mt-4 px-4 py-2 bg-accent-yellow/80 text-primary-black rounded-lg font-medium text-sm hover:bg-accent-yellow transition-colors">
            Torna alla Home
          </a>
        `;

        // Nascondi il contenuto originale
        Array.from(container.children).forEach(child => {
          child.classList.add('hidden');
        });

        // Aggiungi il messaggio di errore
        container.appendChild(errorContainer);
      }
    });
  }
}

function closeAlert(alert) {
  alert.classList.add('opacity-0', 'translate-y-2');
  setTimeout(() => {
    alert.remove();
  }, 300);
}