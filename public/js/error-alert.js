
// public/js/error-alert.js
function showErrorAlert(message) {
  const alert = document.createElement("div");
  alert.className =
    "fixed bottom-4 right-4 bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-lg";
  alert.innerHTML = `
    <div class="flex items-center gap-2">
      <span>${message}</span>
    </div>
  `;

  document.body.appendChild(alert);
  setTimeout(() => alert.remove(), 5000);
}
