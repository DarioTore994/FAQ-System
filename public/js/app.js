// Importa correttamente createClient
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabase = createClient(
  "https://ejlyrwotgkrjeunosrzo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqbHlyd290Z2tyamV1bm9zcnpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2ODQxOTYsImV4cCI6MjA1NzI2MDE5Nn0.xmfOVAMsH5QqzjKmkLriEshZalP0Xj8xf_N_wpWE_40", // Sostituire con la chiave corretta
);

// Funzione per caricare le FAQ
const loadFAQs = async (selectedCategory = "all") => {
  try {
    let query = supabase
      .from("faqs")
      .select("*")
      .order("created_at", { ascending: false });

    if (selectedCategory !== "all") {
      query = query.eq("category", selectedCategory);
    }

    const { data, error } = await query;

    if (error) throw error;

    renderFAQs(data, selectedCategory);
    initAccordions();
  } catch (error) {
    console.error("Error loading FAQs:", error);
    showErrorAlert("Errore nel caricamento delle FAQ");
  }
};

// Funzione per il rendering delle FAQ
const renderFAQs = (faqs, selectedCategory) => {
  const container = document.getElementById("faqContainer");
  container.innerHTML = "";

  if (faqs.length === 0) {
    container.innerHTML = `
        <div class="text-center py-12 text-gray-400">
          <icon name="inbox" class="w-12 h-12 mx-auto mb-4"></icon>
          Nessuna FAQ disponibile per questa categoria
        </div>
      `;
    return;
  }

  // Raggruppa per categoria se selezionato "all"
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

// Crea sezione categoria
const createCategorySection = (category, faqs) => {
  const section = document.createElement("div");
  section.className = "category-accordion";
  section.innerHTML = `
      <div class="category-header">
        <h3 class="text-lg font-semibold">${category}</h3>
        <icon name="chevron-down" class="w-5 h-5 transform transition-transform"></icon>
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

// Gestione accordion
const initAccordions = () => {
  document.querySelectorAll(".category-header").forEach((header) => {
    header.addEventListener("click", () => {
      const content = header.nextElementSibling;
      const icon = header.querySelector("icon");
      content.classList.toggle("hidden");
      icon.classList.toggle("rotate-180");
    });
  });
};

// Filtro categoria
document.getElementById("categoryFilter").addEventListener("change", (e) => {
  loadFAQs(e.target.value);
});

// Inizializzazione
document.addEventListener("DOMContentLoaded", () => {
  loadFAQs();
  supabase.auth.onAuthStateChange(() => loadFAQs());
});
