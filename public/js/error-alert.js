function showErrorAlert(message, duration = 5000) {
  const alertContainer = document.getElementById('alertContainer');
  if (!alertContainer) {
    // Crea il container degli alert se non esiste
    const container = document.createElement('div');
    container.id = 'alertContainer';
    container.className = 'fixed top-4 right-4 z-50 flex flex-col items-end space-y-2';
    document.body.appendChild(container);
  }

  // Crea l'elemento dell'alert
  const alert = document.createElement('div');
  alert.className = 'bg-red-500 text-white px-4 py-3 rounded shadow-lg flex items-center transform transition-transform duration-300 ease-in-out';
  alert.style.opacity = '0';
  alert.style.transform = 'translateX(100%)';

  // Aggiungi l'icona di errore
  alert.innerHTML = `
    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
    <span>${message}</span>
  `;

  // Aggiungi l'alert al container
  document.getElementById('alertContainer').appendChild(alert);

  // Anima l'entrata dell'alert
  setTimeout(() => {
    alert.style.opacity = '1';
    alert.style.transform = 'translateX(0)';
  }, 10);

  // Rimuovi l'alert dopo il tempo specificato
  setTimeout(() => {
    alert.style.opacity = '0';
    alert.style.transform = 'translateX(100%)';
    setTimeout(() => {
      alert.remove();
    }, 300);
  }, duration);
}