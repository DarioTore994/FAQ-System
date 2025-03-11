// Client-side JavaScript
document.addEventListener("DOMContentLoaded", async () => {
  // Initialize Supabase client
  const supabaseUrl = 'https://ejlyrwotgkrjeunosrzo.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqbHlyd290Z2tyamV1bm9zcnpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2ODQxOTYsImV4cCI6MjA1NzI2MDE5Nn0.xmfOVAMsH5QqzjKmkLriEshZalP0Xj8xf_N_wpWE_40';

  // Check if supabase is available in the window object
  let supabase;
  if (window.supabase) {
    supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
  } else {
    console.error("Supabase library not loaded properly");
    showErrorAlert("Errore di connessione al database");
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

  // Create category section
  const createCategorySection = (category, faqs) => {
    const section = document.createElement("div");
    section.className = "category-accordion";
    section.innerHTML = `
        <div class="category-header">
          <h3 class="text-lg font-semibold">${category}</h3>
          <div class="w-5 h-5 transform transition-transform"></div>
        </div>
        <div class="faq-content hidden p-4 bg-gray-800/20 space-y-4">
          ${faqs
            .map(
              (faq) => `
            <div class="faq-item">
              <div class="flex justify-between items-start mb-2">
                <h4 class="font-medium">${faq.title}</h4>
                <span class="text-xs text-yellow-500/80">${new Date(faq.created_at).toLocaleDateString()}</span>
              </div>
              <p class="text-gray-400 text-sm mb-3">${faq.description}</p>
              <div class="resolution-box bg-gray-900/50 p-3 rounded-md">
                <h5 class="text-yellow-500/80 text-sm font-medium mb-2">Procedura risolutiva:</h5>
                <p class="text-gray-300 text-sm">${faq.resolution}</p>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      `;
    return section;
  };

  // Initialize accordions
  const initAccordions = () => {
    document.querySelectorAll(".category-header").forEach((header) => {
      header.addEventListener("click", () => {
        const content = header.nextElementSibling;
        const icon = header.querySelector("div");
        content.classList.toggle("hidden");
        icon.classList.toggle("rotate-180");
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

        // Verifica autenticazione prima di inviare
        const authCheck = await fetch('/api/auth/check');
        const authData = await authCheck.json();

        if (!authData.authenticated) {
          showErrorAlert('Sessione scaduta. Effettua nuovamente il login.');
          setTimeout(() => {
            window.location.href = '/auth';
          }, 1500);
          return;
        }

        const response = await fetch('/api/faqs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(faqData),
          credentials: 'include'
        });

        // Prima verifica se la tabella esiste
        const tableCheck = await fetch('/api/init-db', {
          method: 'POST',
          credentials: 'include'
        });

        // Riprova a salvare dopo aver verificato la tabella
        const retryResponse = !response.ok ? await fetch('/api/faqs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(faqData),
          credentials: 'include'
        }) : response;

        const responseData = await retryResponse.json().catch((err) => {
          console.error("Errore parsing JSON:", err);
          return { error: { message: "Errore nella risposta del server" } };
        });

        if (!retryResponse.ok) {
          throw new Error(responseData.error?.message || 'Errore durante il salvataggio: ' + JSON.stringify(responseData));
        }

        showErrorAlert('FAQ salvata con successo!');

        // Redirect to home after successful creation (with a small delay to show success message)
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
});