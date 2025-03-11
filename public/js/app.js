
// Client-side JavaScript
document.addEventListener("DOMContentLoaded", async () => {
  // Initialize Supabase client
  const supabaseUrl = 'https://ejlyrwotgkrjeunosrzo.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqbHlyd290Z2tyamV1bm9zcnpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2ODQxOTYsImV4cCI6MjA1NzI2MDE5Nn0.xmfOVAMsH5QqzjKmkLriEshZalP0Xj8xf_N_wpWE_40';
  // Accediamo alla variabile globale resa disponibile dalla libreria Supabase
  const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

  // Initialize with appropriate API endpoints
  const loadFAQs = async (selectedCategory = "all") => {
    try {
      let url = "/api/faqs";
      if (selectedCategory !== "all") {
        url += `?category=${selectedCategory}`;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      
      const data = await response.json();
      renderFAQs(data, selectedCategory);
      initAccordions();
    } catch (error) {
      console.error("Error loading FAQs:", error);
      showErrorAlert("Errore nel caricamento delle FAQ");
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
      
      const formData = new FormData(faqForm);
      const faqData = {
        category: formData.get('category'),
        title: formData.get('title'),
        description: formData.get('description'),
        resolution: formData.get('resolution'),
      };
      
      try {
        const response = await fetch('/api/faqs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(faqData),
        });
        
        if (!response.ok) throw new Error('Errore durante il salvataggio');
        
        // Redirect to home after successful creation
        window.location.href = '/';
      } catch (error) {
        console.error('Error saving FAQ:', error);
        showErrorAlert('Errore nel salvataggio della FAQ');
      }
    });
  }
});
