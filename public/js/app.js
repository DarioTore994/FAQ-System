// Client-side JavaScript
document.addEventListener("DOMContentLoaded", async () => {
  // Verifica ruolo utente
  let userRole = 'guest';
  let userId = null;

  try {
    const authResponse = await fetch('/api/auth/check');
    const authData = await authResponse.json();

    if (authData.authenticated) {
      userRole = authData.user.role;
      userId = authData.user.id;

      // Se è un admin, mostra pulsante admin nella navbar
      const headerNav = document.getElementById('headerNav');
      if (headerNav && userRole === 'admin') {
        const createBtn = document.createElement('a');
        createBtn.href = '/admin';
        createBtn.className = 'bg-accent-yellow text-primary-black px-4 py-2 rounded-lg font-medium hover:bg-yellow-300 transition-colors mr-2';
        createBtn.textContent = 'Admin';
        headerNav.prepend(createBtn);
      }
    }
  } catch (error) {
    console.error('Errore verifica autenticazione:', error);
  }

  // Initialize with appropriate API endpoints
  const loadFAQs = async (selectedCategory = "all") => {
    try {
      let url = "/api/faqs";
      if (selectedCategory !== "all") {
        url += `?category=${selectedCategory}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Network response was not ok");
      }

      const data = await response.json();
      renderFAQs(data || [], selectedCategory);
      initAccordions();
    } catch (error) {
      console.error("Error loading FAQs:", error);
      showErrorAlert("Errore nel caricamento delle FAQ. La tabella 'faqs' potrebbe non esistere.");

      // If the error is related to missing table, render empty state
      renderFAQs([], selectedCategory);
    }
  };

  // Render FAQs
  const renderFAQs = (faqs, selectedCategory) => {
    const container = document.getElementById("faqContainer");
    if (!container) return;

    container.innerHTML = "";

    if (faqs.length === 0) {
      container.innerHTML = `
          <div class="text-center py-12 text-gray-400">
            <div class="w-12 h-12 mx-auto mb-4"></div>
            Nessuna FAQ disponibile per questa categoria
          </div>
        `;
      return;
    }

    // Group by category if selected "all"
    if (selectedCategory === "all") {
      const categories = [...new Set(faqs.map((faq) => faq.category))];

      categories.forEach((category) => {
        const categoryFAQs = faqs.filter((faq) => faq.category === category);
        const categorySection = createCategorySection(category, categoryFAQs);
        container.appendChild(categorySection);
      });
    } else {
      const categorySection = createCategorySection(selectedCategory, faqs);
      container.appendChild(categorySection);
    }
  };

  // Create category section with table
  const createCategorySection = (category, faqs) => {
    const section = document.createElement("div");
    section.className = "category-accordion";
    section.innerHTML = `
        <div class="category-header">
          <h3 class="text-lg font-semibold">${category}</h3>
          <div class="w-5 h-5 transform transition-transform"></div>
        </div>
        <div class="faq-content hidden p-4 space-y-4">
          <table class="faq-table">
            <thead>
              <tr>
                <th class="w-1/4">Titolo</th>
                <th class="w-1/2">Descrizione</th>
                <th class="w-1/4">Data</th>
              </tr>
            </thead>
            <tbody>
            </tbody>
          </table>
        </div>
      `;
    const tableBody = section.querySelector('tbody');
    tableBody.innerHTML = renderFAQsTable(faqs);
    return section;
  };

  // Initialize accordions
  const initAccordions = () => {
    // Category accordions
    document.querySelectorAll(".category-header").forEach((header) => {
      header.addEventListener("click", () => {
        const content = header.nextElementSibling;
        const icon = header.querySelector("div");
        content.classList.toggle("hidden");
        icon.classList.toggle("rotate-180");
      });
    });

    // FAQ row accordions
    document.querySelectorAll(".faq-row").forEach((row) => {
      row.addEventListener("click", () => {
        const faqId = row.getAttribute('data-faq-id');
        const detailRows = document.querySelectorAll(`.faq-detail-row[data-faq-id="${faqId}"]`);

        detailRows.forEach(detailRow => {
          const detail = detailRow.querySelector('.faq-detail');
          detail.classList.toggle("hidden");

          // Highlight active row
          row.classList.toggle("bg-accent-yellow/10");
        });
      });
    });
  };

  // Initialize filter
  const categoryFilter = document.getElementById("categoryFilter");
  if (categoryFilter) {
    categoryFilter.addEventListener("change", (e) => {
      loadFAQs(e.target.value);
    });
  }

  // Load FAQs
  loadFAQs();

  // Form handling for FAQ creation
  const faqForm = document.getElementById('faqForm');
  if (faqForm) {
    faqForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Visualizza messaggio di caricamento
      showErrorAlert('Salvataggio in corso...');

      const formData = new FormData(faqForm);
      const faqData = {
        category: formData.get('category'),
        title: formData.get('title'),
        description: formData.get('description'),
        resolution: formData.get('resolution'),
      };

      try {
        console.log('Sending FAQ data:', faqData);

        // Validazione lato client
        const missingFields = [];
        Object.entries(faqData).forEach(([key, value]) => {
          if (!value) missingFields.push(key);
        });

        if (missingFields.length > 0) {
          throw new Error(`Campi mancanti: ${missingFields.join(', ')}`);
        }

        // Verifica autenticazione prima di inviare
        const authCheck = await fetch('/api/auth/check');
        if (!authCheck.ok) {
          console.error('Errore verifica autenticazione:', await authCheck.text());
          throw new Error('Errore verifica autenticazione');
        }

        const authData = await authCheck.json();

        if (!authData.authenticated) {
          showErrorAlert('Sessione scaduta. Effettua nuovamente il login.');
          setTimeout(() => {
            window.location.href = '/auth';
          }, 1500);
          return;
        }

        // Prima verifica se la tabella esiste
        showErrorAlert('Verifica tabella in corso...');

        const tableCheck = await fetch('/api/init-db', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!tableCheck.ok) {
          console.warn('Errore verifica tabella:', await tableCheck.text());
        } else {
          console.log('Tabella verificata');
        }

        showErrorAlert('Salvataggio FAQ in corso...');

        const response = await fetch('/api/faqs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(faqData),
          credentials: 'include'
        });

        let responseText;
        try {
          responseText = await response.text();
          console.log('Risposta grezza del server:', responseText);
        } catch (textErr) {
          console.error('Errore lettura risposta:', textErr);
          responseText = 'Errore lettura risposta';
        }

        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (parseErr) {
          console.error('Errore parsing JSON:', parseErr, 'Testo:', responseText);
          throw new Error('Risposta del server non valida');
        }

        if (!response.ok) {
          console.error('Dettagli errore server:', responseData);

          // Messaggi di errore più specifici
          if (responseData.error?.details && responseData.error.details.includes("user_id")) {
            throw new Error("Errore di autenticazione: sessione scaduta o utente non valido. Rieffettua il login.");
          } else if (responseData.error?.code === "23502") {
            throw new Error("Errore nel database: campo obbligatorio mancante.");
          } else {
            throw new Error(responseData.error?.message || 
              (responseData.error?.details ? `Errore: ${responseData.error.details}` : 
              'Errore durante il salvataggio nel database'));
          }
        }

        showErrorAlert('FAQ salvata con successo!');

        // Redirect to home after successful creation
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      } catch (error) {
        console.error('Error saving FAQ:', error);
        showErrorAlert('Errore nel salvataggio della FAQ: ' + error.message);
      }
    });
  }

  // Verifica e inizializza il database all'avvio
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      showErrorAlert('Verifica del database in corso...');

      // Creazione diretta della tabella
      const response = await fetch('/api/init-db', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      let result;
      try {
        result = await response.json();
      } catch (parseErr) {
        console.error('Errore parsing JSON:', parseErr);
        result = { 
          error: 'Errore di parsing', 
          message: 'Errore nel parsing della risposta del server' 
        };
      }

      if (!response.ok) {
        console.warn('Verifica database fallita:', result);
        showErrorAlert('Errore database: ' + (result.message || 'Verifica fallita'));

        // Mostra dettagli tecnici nella console
        if (result.error) {
          console.error('Dettagli errore:', result.error);
        }

        // Se c'è un problema con il database, aggiungiamo un avviso visibile
        const header = document.querySelector('header');
        if (header) {
          const alert = document.createElement('div');
          alert.className = 'bg-red-500 text-white p-2 text-center';
          alert.innerHTML = 'Attenzione: Problemi con il database. Alcune funzionalità potrebbero non essere disponibili.';
          header.after(alert);
        }
      } else {
        console.log('Database verificato correttamente:', result);
        showErrorAlert('Database verificato con successo!');
      }
    } catch (error) {
      console.error('Errore critico verifica database:', error);
      showErrorAlert('Errore critico nella verifica del database: ' + error.message);
    }
  });

  const renderFAQsTable = (faqs) => {
    const faqContainer = document.getElementById('faqTableBody');
    if (!faqContainer) return;

    // Verifica se su dispositivo mobile
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      // Visualizzazione a card per mobile
      faqContainer.innerHTML = faqs.length === 0
        ? `<tr><td colspan="3" class="text-center py-8 text-gray-400">Nessuna FAQ trovata</td></tr>`
        : faqs
            .map(
              (faq) => `
              <tr class="block mb-4 bg-gray-800/30 rounded-lg border border-gray-700">
                <td class="block p-4 border-b border-gray-700">
                  <div class="flex justify-between items-start">
                    <h4 class="font-medium text-accent-yellow">${faq.title}</h4>
                    <span class="px-3 py-1 bg-accent-yellow/10 text-accent-yellow rounded-full text-xs font-medium ml-2">
                      ${faq.category}
                    </span>
                  </div>
                  <div class="text-xs text-gray-500 mt-1">${new Date(faq.created_at).toLocaleDateString()}</div>
                </td>
                <td class="block p-4">
                  <p class="text-sm text-gray-300 mb-3">${faq.description}</p>
                  <div class="p-3 bg-gray-800/50 rounded-md">
                    <h5 class="text-xs text-accent-yellow mb-1 font-medium">Soluzione:</h5>
                    <p class="text-sm">${faq.resolution}</p>
                  </div>
                </td>
              </tr>
            `,
            )
            .join('');
    } else {
      // Visualizzazione a tabella per desktop
      faqContainer.innerHTML = faqs.length === 0
        ? `<tr><td colspan="3" class="text-center py-8 text-gray-400">Nessuna FAQ trovata</td></tr>`
        : faqs
            .map(
              (faq) => `
              <tr class="border-b border-gray-700 hover:bg-gray-800/30">
                <td class="p-4">
                  <h4 class="font-medium text-accent-yellow">${faq.title}</h4>
                </td>
                <td class="p-4">
                  <p class="text-sm text-gray-300">${faq.description}</p>
                  <div class="mt-2 p-3 bg-gray-800/50 rounded-md">
                    <p class="text-sm">${faq.resolution}</p>
                  </div>
                </td>
                <td class="p-4">
                  <span class="px-3 py-1 bg-accent-yellow/10 text-accent-yellow rounded-full text-xs font-medium">
                    ${faq.category}
                  </span>
                  <div class="text-xs text-gray-500 mt-2">${new Date(faq.created_at).toLocaleDateString()}</div>
                </td>
              </tr>
            `,
            )
            .join('');
    }
  };

  // Aggiungi listener per il ridimensionamento della finestra
  window.addEventListener('resize', () => {
    if (document.getElementById('faqTableBody')) {
      const filteredFAQs = window.currentFAQs || [];
      renderFAQsTable(filteredFAQs);
    }
  });

  // Inizializza filtro categoria
  const initCategoryFilter = () => {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;

    categoryFilter.addEventListener('change', async () => {
      const category = categoryFilter.value;

      try {
        const faqs = await fetchFAQs(category);
        // Salva i FAQs filtrati per poterli utilizzare in caso di ridimensionamento della finestra
        window.currentFAQs = faqs;
        renderFAQsTable(faqs);
      } catch (error) {
        console.error('Errore filtro categorie:', error);
        showErrorAlert('Errore durante il filtraggio delle FAQ');
      }
    });
  };


  // Placeholder function -  needs to be defined elsewhere to work correctly
  const fetchFAQs = async (category) => {
    // Replace with your actual fetch call
      let url = "/api/faqs";
      if (category !== "all") {
        url += `?category=${category}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
          throw new Error("Failed to fetch FAQs");
      }
      return await response.json();
  };

  const showErrorAlert = (message) => {
    // Replace with your actual alert implementation
    console.log(message);
  }

  initCategoryFilter();
});
// Client-side JavaScript
document.addEventListener("DOMContentLoaded", async () => {
  // Verifica ruolo utente
  let userRole = 'guest';
  let userId = null;

  try {
    const authResponse = await fetch('/api/auth/check');
    
    // Verifica se la risposta è valida
    if (!authResponse.ok) {
      console.error('Errore API auth/check:', authResponse.status, authResponse.statusText);
      return;
    }
    
    // Gestione sicura del parsing JSON
    let authData;
    try {
      authData = await authResponse.json();
    } catch (parseError) {
      console.error('Errore parsing risposta auth/check:', parseError);
      return;
    }

    if (authData.authenticated) {
      userRole = authData.user.role;
      userId = authData.user.id;

      // Se è un admin, mostra pulsante admin nella navbar
      const headerNav = document.getElementById('headerNav');
      const createFaqBtn = document.getElementById('createFaqBtn');

      // Nascondi sempre il pulsante "Crea FAQ" come impostazione predefinita
      if (createFaqBtn) {
        createFaqBtn.classList.add('hidden');
      }

      if (headerNav && userRole === 'admin') {
        // Mostra il pulsante "Crea FAQ" solo per gli admin
        if (createFaqBtn) {
          createFaqBtn.classList.remove('hidden');
        }

        // Mostra pulsante admin (solo se non esiste già)
        if (!document.getElementById('adminLink')) {
          const createBtn = document.createElement('a');
          createBtn.href = '/admin';
          createBtn.id = 'adminLink';
          createBtn.className = 'bg-accent-yellow text-primary-black px-4 py-2 rounded-lg font-medium hover:bg-yellow-300 transition-colors mr-2';
          createBtn.textContent = 'Admin';
          headerNav.prepend(createBtn);
        }
      }
    }
  } catch (error) {
    console.error('Errore verifica autenticazione:', error);;
  }

  // Variabili globali per le FAQ
  let allFaqs = [];
  let filteredFaqs = [];

  // Recupera FAQ dal server
  const fetchFAQs = async () => {
    try {
      const response = await fetch('/api/faqs');
      if (!response.ok) {
        throw new Error('Errore nel recupero delle FAQ');
      }
      const data = await response.json();

      // Ordina per data decrescente
      return data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (error) {
      console.error('Errore nel caricamento delle FAQ:', error);
      showErrorAlert('Errore nel caricamento delle FAQ');
      return [];
    }
  };

  // Funzione per visualizzare le FAQ nella tabella
  const renderFAQTable = (faqs) => {
    const tableBody = document.getElementById('faqTableBody');
    if (!tableBody) return;

    // Prendere solo le prime 10 FAQ
    const faqsToShow = faqs.slice(0, 10);

    if (faqsToShow.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" class="py-8 text-center text-gray-400">Nessuna FAQ trovata</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = faqsToShow.map(faq => `
      <tr class="hover:bg-gray-800/50 transition-colors">
        <td class="py-4 px-6">
          <h4 class="font-medium text-accent-yellow">${faq.title}</h4>
        </td>
        <td class="py-4 px-6">
          <div class="mb-2 text-sm text-gray-300">${faq.description}</div>
          <div class="p-3 bg-gray-800/50 rounded-md border-l-2 border-accent-yellow">
            <p class="text-sm">${faq.resolution}</p>
          </div>
        </td>
        <td class="py-4 px-6">
          <span class="inline-block px-3 py-1 bg-accent-yellow/10 text-accent-yellow rounded-full text-xs font-medium">
            ${faq.category}
          </span>
        </td>
        <td class="py-4 px-6 text-gray-400 text-sm">
          ${new Date(faq.created_at).toLocaleDateString()} 
          <span class="block text-xs opacity-70">${new Date(faq.created_at).toLocaleTimeString()}</span>
        </td>
      </tr>
    `).join('');
  };

  // Gestione della ricerca
  const setupSearch = () => {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', () => {
      const searchTerm = searchInput.value.toLowerCase().trim();

      if (searchTerm === '') {
        // Se il campo di ricerca è vuoto, mostra tutte le FAQ
        filteredFaqs = allFaqs;
      } else {
        // Filtra le FAQ in base al termine di ricerca
        filteredFaqs = allFaqs.filter(faq => 
          faq.title.toLowerCase().includes(searchTerm) || 
          faq.description.toLowerCase().includes(searchTerm) || 
          faq.resolution.toLowerCase().includes(searchTerm) || 
          faq.category.toLowerCase().includes(searchTerm)
        );
      }

      renderFAQTable(filteredFaqs);
    });
  };

  // Inizializza la pagina
  const initPage = async () => {
    // Carica le FAQ
    allFaqs = await fetchFAQs();
    filteredFaqs = allFaqs;

    // Visualizza le FAQ
    renderFAQTable(filteredFaqs);

    // Imposta la funzionalità di ricerca
    setupSearch();
  };

  // Gestione logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST'
        });

        if (response.ok) {
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Errore durante il logout:', error);
        showErrorAlert('Errore durante il logout');
      }
    });
  }

  // Inizializzazione della pagina
  initPage();
});

// Carica le FAQ
async function loadFAQs() {
    try {
        const limit = 10; // Mostra solo le ultime 10 FAQ
        const response = await fetch(`/api/faqs?limit=${limit}`);
        if (!response.ok) throw new Error('Errore nel recupero delle FAQ');

        const faqs = await response.json();

        // Visualizza le FAQ nella tabella
        const tableBody = document.getElementById('faqTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        if (faqs.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="py-4 text-center text-gray-400">Nessuna FAQ disponibile</td>
                </tr>
            `;
            return;
        }

        faqs.forEach(faq => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-800/50';

            const date = new Date(faq.created_at);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

            row.innerHTML = `
                <td class="py-4 px-6 border-b border-gray-700">${faq.title}</td>
                <td class="py-4 px-6 border-b border-gray-700">${faq.resolution}</td>
                <td class="py-4 px-6 border-b border-gray-700">
                    <span class="category-badge">${faq.category}</span>
                </td>
                <td class="py-4 px-6 border-b border-gray-700">${formattedDate}</td>
            `;

            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Errore durante il caricamento delle FAQ:', error);
        showErrorAlert('Errore durante il caricamento delle FAQ');
    }
}

// Implementazione ricerca semplificata
if (document.getElementById('searchInput')) {
    document.getElementById('searchInput').addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#faqTableBody tr');

        rows.forEach(row => {
            // Ottieni il testo di tutte le celle
            const rowText = Array.from(row.children)
                .map(cell => cell.textContent.toLowerCase())
                .join(' ');

            // Mostra la riga se contiene il termine di ricerca in qualsiasi campo
            if (rowText.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}