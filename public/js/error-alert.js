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