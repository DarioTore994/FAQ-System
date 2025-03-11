// Funzione per mostrare messaggi di alert con diversi tipi (error, success, info)
function showErrorAlert(message, type = 'error') {
    // Rimuovi eventuali alert esistenti
    const existingAlerts = document.querySelectorAll('.error-alert');
    existingAlerts.forEach(alert => alert.remove());

    // Configura stili in base al tipo di alert
    let bgColor, textColor, icon;

    switch(type) {
        case 'success':
            bgColor = 'bg-green-500';
            textColor = 'text-white';
            icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 inline" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>`;
            break;
        case 'info':
            bgColor = 'bg-blue-500';
            textColor = 'text-white';
            icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 inline" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                    </svg>`;
            break;
        case 'warning':
            bgColor = 'bg-yellow-500';
            textColor = 'text-black';
            icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 inline" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>`;
            break;
        default: // error
            bgColor = 'bg-red-500';
            textColor = 'text-white';
            icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 inline" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>`;
    }

    // Crea il nuovo alert
    const alertElement = document.createElement('div');
    alertElement.className = `error-alert fixed top-4 left-1/2 transform -translate-x-1/2 z-50 p-4 rounded-lg ${bgColor} ${textColor} shadow-lg flex items-center`;
    alertElement.style.maxWidth = '90%';
    alertElement.style.animation = 'fadeIn 0.3s, fadeOut 0.3s 4.7s';
    alertElement.innerHTML = `${icon}${message}`;

    // Aggiungi il bottone di chiusura
    const closeButton = document.createElement('button');
    closeButton.className = 'ml-4 text-sm opacity-70 hover:opacity-100';
    closeButton.innerHTML = '×';
    closeButton.onclick = () => {
        alertElement.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => alertElement.remove(), 300);
    };
    alertElement.appendChild(closeButton);

    // Aggiungi lo stile di animazione se non esiste
    if (!document.getElementById('error-alert-style')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'error-alert-style';
        styleElement.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translate(-50%, -20px); }
                to { opacity: 1; transform: translate(-50%, 0); }
            }
            @keyframes fadeOut {
                from { opacity: 1; transform: translate(-50%, 0); }
                to { opacity: 0; transform: translate(-50%, -20px); }
            }
            .error-alert {
                min-width: 320px;
            }
        `;
        document.head.appendChild(styleElement);
    }

    // Aggiungi l'alert al body
    document.body.appendChild(alertElement);

    // Rimuovi l'alert dopo 5 secondi per success e info, mantieni più a lungo gli errori
    const timeout = type === 'error' ? 8000 : 5000;
    setTimeout(() => {
        if (document.body.contains(alertElement)) {
            alertElement.style.animation = 'fadeOut 0.3s forwards';
            setTimeout(() => {
                if (document.body.contains(alertElement)) {
                    alertElement.remove();
                }
            }, 300);
        }
    }, timeout);
}
// Funzione per nascondere tutti i pulsanti quando si verifica un errore di autorizzazione
function hideButtonsOnAuthError(errorMessage) {
  if (errorMessage && errorMessage.includes('Accesso non autorizzato')) {
    // Nasconde tutti i contenuti sensibili
    const menuElements = [
      'authUserMenu',
      'adminMenu',
      'createFaqBtn',
      'logoutBtn',
      'adminCategorySection'
    ];
    
    menuElements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.classList.add('hidden');
      }
    });
    
    // Se siamo nella dashboard, nascondi anche i contenuti principali
    const faqContainer = document.getElementById('faqContainer');
    if (faqContainer) {
      faqContainer.classList.add('hidden');
    }
  }
}

// Estende la funzione showErrorAlert esistente
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
  
  // Chiusura automatica
  const timeout = setTimeout(() => {
    closeAlert(alert);
  }, duration);
  
  // Chiusura manuale
  alert.querySelector('button').addEventListener('click', () => {
    clearTimeout(timeout);
    closeAlert(alert);
  });
}

function closeAlert(alert) {
  alert.classList.add('opacity-0', 'translate-y-2');
  setTimeout(() => {
    alert.remove();
  }, 300);
}
