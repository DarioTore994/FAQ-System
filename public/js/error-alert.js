// Variabile globale per tenere traccia dell'alert attivo
let activeAlert = null;
let alertTimeout = null;

function showErrorAlert(message, type = 'error') {
  // Se c'è già un alert attivo, rimuovilo prima di mostrarne uno nuovo
  if (activeAlert) {
    document.body.removeChild(activeAlert);
    clearTimeout(alertTimeout);
    activeAlert = null;
  }

  const alertBox = document.createElement('div');
  const alertClass = type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500';

  alertBox.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${alertClass} text-white transition-opacity duration-500`;
  alertBox.innerHTML = message;

  document.body.appendChild(alertBox);

  // Imposta l'alert come attivo
  activeAlert = alertBox;

  // Fade out after 5 seconds and remove (aumentato da 3 a 5 secondi)
  alertTimeout = setTimeout(() => {
    alertBox.style.opacity = '0';
    setTimeout(() => {
      if (document.body.contains(alertBox)) {
        document.body.removeChild(alertBox);
      }
      if (activeAlert === alertBox) {
        activeAlert = null;
      }
    }, 500); // Wait for transition to complete before removing
  }, 5000);

  // Aggiungi la possibilità di chiudere l'alert cliccandoci sopra
  alertBox.style.cursor = 'pointer';
  alertBox.addEventListener('click', () => {
    alertBox.style.opacity = '0';
    setTimeout(() => {
      if (document.body.contains(alertBox)) {
        document.body.removeChild(alertBox);
      }
      if (activeAlert === alertBox) {
        activeAlert = null;
      }
    }, 500);
    clearTimeout(alertTimeout);
  });
}
// Sistema di gestione errori centralizzato
let errorAlertTimeout;

function showErrorAlert(message, isSuccess = false) {
  // Rimuovi eventuali alert esistenti
  const existingAlerts = document.querySelectorAll('.error-alert');
  existingAlerts.forEach(alert => alert.remove());
  
  clearTimeout(errorAlertTimeout);
  
  // Crea il nuovo alert
  const alertDiv = document.createElement('div');
  alertDiv.className = `error-alert fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transition-opacity duration-300 flex items-center ${
    isSuccess ? 'bg-green-800 text-white' : 'bg-red-800 text-white'
  }`;
  
  // Aggiungi icona in base al tipo
  alertDiv.innerHTML = `
    <div class="mr-3">
      ${isSuccess 
        ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>'
      }
    </div>
    <div>
      <p class="font-medium">${isSuccess ? 'Operazione completata' : 'Errore'}</p>
      <p class="text-sm">${message}</p>
    </div>
    <button class="ml-auto hover:text-gray-300" onclick="this.parentElement.remove()">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  `;
  
  document.body.appendChild(alertDiv);
  
  // Imposta un timeout per nascondere l'alert dopo 5 secondi
  errorAlertTimeout = setTimeout(() => {
    alertDiv.classList.add('opacity-0');
    setTimeout(() => {
      if (alertDiv.parentElement) {
        alertDiv.remove();
      }
    }, 300);
  }, 5000);
  
  // Aggiungi stile CSS per l'animazione
  const style = document.createElement('style');
  if (!document.querySelector('#error-alert-style')) {
    style.id = 'error-alert-style';
    style.textContent = `
      .error-alert {
        opacity: 1;
        transition: opacity 0.3s ease;
      }
      .error-alert.opacity-0 {
        opacity: 0;
      }
    `;
    document.head.appendChild(style);
  }
  
  return alertDiv;
}

// Funzione per mostrare messaggi di successo
function showSuccessAlert(message) {
  return showErrorAlert(message, true);
}

// Funzione di utilità per gestire errori di fetch
async function handleFetchError(response, defaultMessage = 'Si è verificato un errore') {
  if (!response.ok) {
    let errorMessage = defaultMessage;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (e) {
      console.error('Errore parsing risposta:', e);
    }
    throw new Error(errorMessage);
  }
  return await response.json();
}

// Intercetta errori globali non gestiti
window.addEventListener('error', function(event) {
  console.error('Errore JavaScript non gestito:', event.error);
  showErrorAlert('Errore JavaScript: ' + (event.error?.message || 'Errore sconosciuto'));
});

// Intercetta promise non gestite
window.addEventListener('unhandledrejection', function(event) {
  console.error('Promise non gestita:', event.reason);
  showErrorAlert('Errore asincrono: ' + (event.reason?.message || 'Errore sconosciuto'));
});
// Funzione per mostrare errori in formato alert
function showErrorAlert(message, isError = true) {
  const alertContainer = document.getElementById('alertContainer');
  
  // Se non esiste, creiamo il container
  if (!alertContainer) {
    const newAlertContainer = document.createElement('div');
    newAlertContainer.id = 'alertContainer';
    newAlertContainer.className = 'fixed top-4 right-4 z-50 max-w-md';
    document.body.appendChild(newAlertContainer);
  }

  const alertElement = document.createElement('div');
  alertElement.className = `mb-4 p-4 rounded-lg shadow-lg flex items-center ${
    isError ? 'bg-red-100 text-red-800 border-l-4 border-red-500' : 'bg-green-100 text-green-800 border-l-4 border-green-500'
  }`;

  alertElement.innerHTML = `
    <div class="flex-grow">
      <p class="text-sm font-medium">${message}</p>
    </div>
    <button class="ml-4 text-gray-500 hover:text-gray-700" onclick="this.parentElement.remove()">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>
  `;

  const container = document.getElementById('alertContainer') || newAlertContainer;
  container.appendChild(alertElement);

  // Rimuovi automaticamente l'alert dopo 5 secondi
  setTimeout(() => {
    if (alertElement.parentElement) {
      alertElement.remove();
    }
  }, 5000);
}

// Funzione per gestire gli errori delle richieste fetch
async function handleFetchError(response) {
  if (!response.ok) {
    let errorMessage = 'Si è verificato un errore';
    
    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || errorData.error || errorMessage;
    } catch (e) {
      console.error('Errore nella lettura della risposta di errore:', e);
    }
    
    showErrorAlert(errorMessage, true);
    throw new Error(errorMessage);
  }
  return response;
}
