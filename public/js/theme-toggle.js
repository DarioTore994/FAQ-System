
document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.querySelector('.theme-toggle-btn');
  const toggleIcon = document.querySelector('.theme-toggle-icon');
  
  // Controlla se esiste una preferenza salvata
  const savedTheme = localStorage.getItem('theme');
  
  // Imposta tema iniziale in base alla preferenza salvata
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    updateIcon(true);
  } else {
    // Default è dark theme
    document.body.classList.remove('light-theme');
    updateIcon(false);
  }
  
  toggleBtn?.addEventListener('click', function() {
    // Toggle del tema
    if (document.body.classList.contains('light-theme')) {
      document.body.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
      updateIcon(false);
    } else {
      document.body.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
      updateIcon(true);
    }
  });
  
  // Aggiorna l'icona in base al tema attuale
  function updateIcon(isLight) {
    if (isLight) {
      // Mostra icona sole per tema chiaro
      toggleIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd" />
        </svg>
      `;
    } else {
      // Mostra icona luna per tema scuro
      toggleIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      `;
    }
  }
});


// Theme toggling functionality
document.addEventListener('DOMContentLoaded', () => {
  // Funzione per impostare il tema
  const setTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Aggiorna l'icona in base al tema
    const icons = document.querySelectorAll('.theme-toggle-icon');
    icons.forEach(icon => {
      if (theme === 'light') {
        // Icona sole per tema chiaro
        icon.innerHTML = '<path fill-rule="evenodd" clip-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />';
      } else {
        // Icona luna per tema scuro
        icon.innerHTML = '<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />';
      }
    });
  };

  // Controlla se esiste un tema salvato in localStorage
  const savedTheme = localStorage.getItem('theme');
  
  // Applica il tema salvato o quello di default
  if (savedTheme) {
    setTheme(savedTheme);
  } else {
    // Controlla preferenza sistema
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  }

  // Aggiunge event listener a tutti i pulsanti toggle
  const toggleButtons = document.querySelectorAll('.theme-toggle-btn');
  toggleButtons.forEach(button => {
    button.addEventListener('click', () => {
      const currentTheme = localStorage.getItem('theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
    });
  });

  // Aggiungi animazione di feedback al click
  toggleButtons.forEach(button => {
    button.addEventListener('click', function() {
      this.classList.add('clicked');
      setTimeout(() => {
        this.classList.remove('clicked');
      }, 300);
    });
  });
});
