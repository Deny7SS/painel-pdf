const authForm = document.getElementById("loginForm");
const bookForm = document.getElementById("bookForm");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const baseUrlInput = document.getElementById("baseUrl");
const manualTokenInput = document.getElementById("manualToken");
const searchInput = document.getElementById("searchInput");
const booksContainer = document.getElementById("booksContainer");
const cardTemplate = document.getElementById("bookCardTemplate");
const loginOverlay = document.getElementById("loginOverlay");
const connectionStatus = document.getElementById("connectionStatus");
const changeTokenBtn = document.getElementById("changeTokenBtn");

// Config / Gêneros
const newGenreInput = document.getElementById("newGenreInput");
const addGenreBtn = document.getElementById("addGenreBtn");
const genresListEl = document.getElementById("genresList");
const formGeneroSelect = document.getElementById("formGenero");

// Edit
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveBookBtn = document.getElementById("saveBookBtn");
const editingIdInput = document.getElementById("editingId");

// Novidade Logic
const formNovidade = document.getElementById("formNovidade");
const novidadeDurationGroup = document.getElementById("novidadeDurationGroup");
const formNovidadeDuracao = document.getElementById("formNovidadeDuracao");

// Destaque Logic
const formDestaque = document.getElementById("formDestaque");
const destaqueDurationGroup = document.getElementById("destaqueDurationGroup");
const formDestaqueDuracao = document.getElementById("formDestaqueDuracao");

// Metadata Search
const btnBuscarMetadata = document.getElementById("btnBuscarMetadata");
const formTitulo = document.getElementById("formTitulo");
const formAutor = document.getElementById("formAutor");
const capaInput = document.getElementById("capaInput");
const formCapaPreview = document.getElementById("formCapaPreview");

// Preview manual upload
capaInput.addEventListener("change", () => {
  const file = capaInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      formCapaPreview.src = e.target.result;
      formCapaPreview.style.display = "block";
    };
    reader.readAsDataURL(file);
  } else {
    formCapaPreview.style.display = "none";
  }
});

// --- Metadata Search Helpers ---

// Calculate similarity between two strings (Levenshtein distance simplified)
function similarity(s1, s2) {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  
  const editDistance = (function(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) costs[j] = j;
        else {
          if (j > 0) {
            let newValue = costs[j - 1];
            if (s1.charAt(i - 1) !== s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  })(longer.toLowerCase(), shorter.toLowerCase());

  return (longerLength - editDistance) / longerLength;
}

// Proxy to bypass CORS for images if needed (using a public proxy or direct if possible)
// Since we don't have a backend proxy, we try direct fetch. If it fails, we warn.
async function fetchImageBlob(url) {
  try {
    const secureLink = url.replace(/^http:\/\//i, 'https://');
    const res = await fetch(secureLink);
    if (!res.ok) throw new Error("Image fetch failed");
    return await res.blob();
  } catch (e) {
    console.warn("Direct image fetch failed (likely CORS). Trying CORS proxy...", e);
    try {
      // Using a public CORS proxy as fallback (only for client-side demo purposes)
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error("Proxy fetch failed");
      return await res.blob();
    } catch (err) {
      console.error("All image fetch attempts failed", err);
      return null;
    }
  }
}

// --- API Clients ---

async function searchGoogleBooks(title, author) {
  const query = `intitle:${encodeURIComponent(title)}+inauthor:${encodeURIComponent(author)}`;
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=3&langRestrict=pt`);
  const data = await res.json();
  
  if (!data.items || data.items.length === 0) return null;

  // Filter best match
  const bestMatch = data.items.find(item => {
    const info = item.volumeInfo;
    const titleSim = similarity(info.title, title);
    // Check if any author matches
    const authorMatch = info.authors?.some(a => similarity(a, author) > 0.4);
    return titleSim > 0.4 && authorMatch;
  });

  if (!bestMatch) return null;
  const info = bestMatch.volumeInfo;

  // Get best image
  let coverUrl = "";
  if (info.imageLinks) {
    // Try to get the largest available image
    coverUrl = info.imageLinks.extraLarge || info.imageLinks.large || info.imageLinks.medium || info.imageLinks.small || info.imageLinks.thumbnail || info.imageLinks.smallThumbnail;
    
    // Google Books API often adds &zoom=1 or &edge=curl, which limits quality.
    // Removing these parameters can sometimes yield a higher resolution raw image.
    if (coverUrl) {
      coverUrl = coverUrl.replace('&edge=curl', '');
      // Try to force zoom=0 (sometimes gives full size) or remove zoom
      // Often replacing zoom=1 with zoom=0 gives a larger image
      if (coverUrl.includes('&zoom=')) {
         // Create a high-res candidate by replacing zoom=1 with zoom=0
         coverUrl = coverUrl.replace(/&zoom=\d/, '&zoom=0');
      }
      // Ensure https
      coverUrl = coverUrl.replace(/^http:\/\//i, 'https://');
      // Add fife parameter for higher res (undocumented Google Books trick)
      // w=1000 forces width 1000px if available
      if (!coverUrl.includes('fife=w')) {
          coverUrl += '&fife=w1000'; 
      }
    }
  }

  return {
    source: "Google Books",
    title: info.title,
    authors: info.authors ? info.authors.join(", ") : "Desconhecido",
    pages: info.pageCount,
    year: info.publishedDate ? info.publishedDate.substring(0, 4) : "",
    description: info.description,
    categories: info.categories,
    coverUrl: coverUrl
  };
}

async function searchOpenLibrary(title, author) {
  // Open Library Search
  const query = `title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`;
  const res = await fetch(`https://openlibrary.org/search.json?${query}&limit=5`);
  const data = await res.json();
  
  if (!data.docs || data.docs.length === 0) return null;

  const bestMatch = data.docs.find(doc => {
    const titleSim = similarity(doc.title, title);
    const authorMatch = doc.author_name?.some(a => similarity(a, author) > 0.4);
    return titleSim > 0.4 && authorMatch;
  });

  if (!bestMatch) return null;

  // Fetch details specifically if needed, but docs usually have enough
  let coverUrl = "";
  if (bestMatch.cover_i) {
    // -L.jpg gives Large size
    coverUrl = `https://covers.openlibrary.org/b/id/${bestMatch.cover_i}-L.jpg`;
  }

  return {
    source: "Open Library",
    title: bestMatch.title,
    authors: bestMatch.author_name ? bestMatch.author_name.join(", ") : "Desconhecido",
    pages: bestMatch.number_of_pages_median || "",
    year: bestMatch.first_publish_year || "",
    description: "", // OL search doesn't return description often, would need extra call
    categories: bestMatch.subject, // Array of strings
    coverUrl: coverUrl
  };
}

// --- Main Handler ---

btnBuscarMetadata.addEventListener("click", async () => {
  const queryTitle = formTitulo.value.trim();
  const queryAuthor = formAutor.value.trim();

  if (!queryTitle || !queryAuthor) {
    return showAlert("Aviso", "Para uma busca mais assertiva, por favor preencha o Título e o Autor.");
  }
  
  btnBuscarMetadata.textContent = "Buscando...";
  btnBuscarMetadata.disabled = true;
  
  try {
    // 1. Try Google Books first
    let result = await searchGoogleBooks(queryTitle, queryAuthor);
    
    // 2. Fallback to Open Library
    if (!result) {
      console.log("Google Books failed, trying Open Library...");
      result = await searchOpenLibrary(queryTitle, queryAuthor);
    }

    if (result) {
      // Try to fetch cover blob
      let coverBlob = null;
      let displayCoverUrl = "";
      
      if (result.coverUrl) {
        coverBlob = await fetchImageBlob(result.coverUrl);
        if (coverBlob) {
          displayCoverUrl = URL.createObjectURL(coverBlob);
        }
      }

      let msg = `<div style="text-align: left;">
        <p><strong>Fonte:</strong> ${result.source}</p>
        <p><strong>Livro:</strong> ${result.title}</p>
        <p><strong>Autor:</strong> ${result.authors}</p>
        <p><strong>Páginas:</strong> ${result.pages || "-"}</p>
        <p><strong>Ano:</strong> ${result.year || "-"}</p>`;
      
      if (displayCoverUrl) {
        msg += `<div style="text-align: center; margin: 15px 0;">
          <img src="${displayCoverUrl}" style="max-height: 150px; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
          <p style="font-size: 0.8rem; color: #8b949e; margin-top: 5px;">Capa encontrada!</p>
        </div>`;
      } else {
        msg += `<p style="color: #f85149; margin-top: 10px;">⚠️ Capa não encontrada.</p>`;
      }
      
      msg += `<p>Deseja preencher o formulário?</p></div>`;
      
      showConfirm(
        "Metadados Encontrados",
        msg,
        () => {
          formTitulo.value = result.title || formTitulo.value;
          document.getElementById("formAutor").value = result.authors;
          document.getElementById("formPaginas").value = result.pages || "";
          document.getElementById("formAno").value = result.year || "";
          if (result.description) document.getElementById("formSinopse").value = result.description;
          
          if (coverBlob) {
            const file = new File([coverBlob], "cover.jpg", { type: "image/jpeg" });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            capaInput.files = dataTransfer.files;
            
            formCapaPreview.src = displayCoverUrl;
            formCapaPreview.style.display = "block";
          }

          // Try to match genre
          if (result.categories && result.categories.length > 0) {
             const apiGenre = result.categories[0]; // Can be string or array
             let matched = false;
             Array.from(formGeneroSelect.options).forEach(opt => {
               if (typeof apiGenre === 'string' && apiGenre.toLowerCase().includes(opt.value.toLowerCase())) {
                 formGeneroSelect.value = opt.value;
                 matched = true;
               }
             });
             if (!matched) {
               showAlert("Gênero", `Gênero sugerido: "${apiGenre}". Adicione-o se necessário.`);
             }
          }
          showAlert("Sucesso", "Campos preenchidos!");
        }
      );
    } else {
      showAlert("Aviso", "Nenhum livro encontrado com esses dados exatos.");
    }
  } catch (e) {
    console.error(e);
    showAlert("Erro", "Erro ao buscar metadados.");
  } finally {
    btnBuscarMetadata.textContent = "🔍 Buscar";
    btnBuscarMetadata.disabled = false;
  }
});

formNovidade.addEventListener("change", () => {
  novidadeDurationGroup.style.display = formNovidade.checked ? "block" : "none";
});

formDestaque.addEventListener("change", () => {
  destaqueDurationGroup.style.display = formDestaque.checked ? "block" : "none";
});

// Modal
const modal = document.getElementById("bookModal");
const closeModal = document.querySelector(".close-modal");

// Confirm Modal
const confirmModal = document.getElementById("confirmModal");
const confirmTitle = document.getElementById("confirmTitle");
const confirmMessage = document.getElementById("confirmMessage");
const confirmOkBtn = document.getElementById("confirmOkBtn");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");

// Alert Modal
const alertModal = document.getElementById("alertModal");
const alertTitle = document.getElementById("alertTitle");
const alertMessage = document.getElementById("alertMessage");
const alertOkBtn = document.getElementById("alertOkBtn");

let confirmCallback = null;

function showConfirm(title, message, callback) {
  confirmTitle.textContent = title;
  // Check if message contains HTML tags
  if (message.includes("<")) {
    confirmMessage.innerHTML = message;
  } else {
    confirmMessage.textContent = message;
    confirmMessage.style.whiteSpace = "pre-wrap";
  }
  confirmCallback = callback;
  confirmModal.style.display = "block";
}

function showAlert(title, message) {
  alertTitle.textContent = title;
  alertMessage.textContent = message;
  alertModal.style.display = "block";
}

confirmOkBtn.onclick = () => {
  if (confirmCallback) confirmCallback();
  confirmModal.style.display = "none";
  confirmCallback = null;
};

confirmCancelBtn.onclick = () => {
  confirmModal.style.display = "none";
  confirmCallback = null;
};

alertOkBtn.onclick = () => {
  alertModal.style.display = "none";
};

// Close modals on outside click
window.onclick = (e) => {
  if (e.target == modal) modal.style.display = "none";
  if (e.target == confirmModal) confirmModal.style.display = "none";
  if (e.target == alertModal) alertModal.style.display = "none";
};

const state = {
  baseUrl: "",
  token: "",
  books: [],
  genres: [],
  editingId: null,
};

// --- Tabs Logic ---
const tabs = document.querySelectorAll(".tab-btn");
const contents = document.querySelectorAll(".tab-content");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    contents.forEach(c => c.classList.remove("active"));
    
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
    
    if (tab.dataset.tab === "library") loadBooks();
    if (tab.dataset.tab === "config") loadGenres();
  });
});

// Auto load library on start
loadBooks();

function normalizeBaseUrl(value) {
  let normalized = String(value || "").trim();
  if (!normalized) return "";
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  return normalized.replace(/\/+$/, "");
}

function setStatus(ok = false) {
  connectionStatus.style.color = ok ? "#3fb950" : "#f85149";
}

function fileUrl(record, fileName) {
  if (!fileName) return "";
  return `${state.baseUrl}/api/files/${record.collectionId}/${record.id}/${encodeURIComponent(fileName)}`;
}

async function pocketbaseRequest(path, options = {}) {
  if (!state.baseUrl || !state.token) throw new Error("Não conectado.");
  
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${state.token}`);

  try {
    const response = await fetch(`${state.baseUrl}${path}`, {
      ...options,
      headers
    });
    
    if (!response.ok) throw new Error(`Erro ${response.status}`);
    if (response.status === 204) return null;
    return response.json();
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

// Check for duplicates
function checkDuplicate(title, author, excludeId = null) {
  const norm = (str) => (str || "").toLowerCase().replace(/[^\w\s]/gi, '').trim();
  const t1 = norm(title);
  const a1 = norm(author);

  return state.books.some(b => {
    if (excludeId && b.id === excludeId) return false;
    const t2 = norm(b.titulo);
    const a2 = norm(b.autor);
    // Exact match on normalized strings
    return t1 === t2 && a1 === a2;
  });
}

// --- Books Logic ---

function getCoverUrl(book) {
  let capaFile = "";
  if (Array.isArray(book.capa) && book.capa.length > 0) {
    capaFile = book.capa[0];
  } else if (typeof book.capa === "string" && book.capa) {
    capaFile = book.capa;
  }
  
  if (!capaFile) return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='140'%3E%3Crect width='100%25' height='100%25' fill='%2321262d'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%238b949e' font-size='12'%3ESem Capa%3C/text%3E%3C/svg%3E";
  
  return fileUrl(book, capaFile);
}

function openBookDetails(book) {
  const cover = document.getElementById("modalCover");
  const title = document.getElementById("modalTitle");
  const author = document.getElementById("modalAuthor");
  const genre = document.getElementById("modalGenre");
  const year = document.getElementById("modalYear");
  const pages = document.getElementById("modalPages");
  const rating = document.getElementById("modalRating");
  const synopsis = document.getElementById("modalSynopsis");
  const files = document.getElementById("modalFiles");
  const editBtn = document.getElementById("modalEditBtn");
  const deleteBtn = document.getElementById("modalDeleteBtn");

  cover.src = getCoverUrl(book);
  title.textContent = book.titulo || "Sem Título";
  author.textContent = book.autor || "Autor desconhecido";
  genre.textContent = book.genero || "Geral";
  year.textContent = book.ano ? `Ano: ${book.ano}` : "Ano: -";
  pages.textContent = `${book.paginas || "?"} págs`;
  rating.textContent = `★ ${book.avaliacao || "-"}`;
  synopsis.textContent = book.sinopse || "Sem sinopse.";
  
  // Files
  const filesArray = Array.isArray(book.arquivo) ? book.arquivo : (book.arquivo ? [book.arquivo] : []);
  files.innerHTML = filesArray.map(f => `
    <a href="${fileUrl(book, f)}" target="_blank">📄 ${f}</a>
  `).join("");

  // Actions
  editBtn.onclick = () => {
    modal.style.display = "none";
    editBook(book);
  };
  
  deleteBtn.onclick = async () => {
    showConfirm("Excluir Livro?", "Tem certeza que deseja excluir este livro? A ação não pode ser desfeita.", async () => {
      try {
        await pocketbaseRequest(`/api/collections/livros/records/${book.id}`, { method: "DELETE" });
        modal.style.display = "none";
        loadBooks();
      } catch (e) {
        showAlert("Erro", e.message);
      }
    });
  };

  modal.style.display = "block";
}

function renderBooks() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = state.books.filter((book) => {
    const text = `${book.titulo || ""} ${book.autor || ""} ${book.genero || ""}`.toLowerCase();
    return text.includes(query);
  });

  booksContainer.innerHTML = "";

  if (filtered.length === 0) {
    booksContainer.innerHTML = `<div class="empty">Nenhum livro encontrado.</div>`;
    return;
  }

  // Group by Genre
  const genres = {};
  filtered.forEach(book => {
    const g = (book.genero || "Outros").trim();
    if (!genres[g]) genres[g] = [];
    genres[g].push(book);
  });

  Object.keys(genres).sort().forEach(genre => {
    const section = document.createElement("div");
    section.className = "genre-section";
    
    const title = document.createElement("h3");
    title.className = "genre-title";
    title.textContent = genre;
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "books-grid";

    genres[genre].forEach((book) => {
      const node = cardTemplate.content.cloneNode(true);
      const card = node.querySelector(".book-card-simple");
      const cover = node.querySelector(".cover");
      const titleEl = node.querySelector(".book-title");
      const badge = node.querySelector(".card-badge");
      const badgeNew = node.querySelector(".card-badge-new");

      cover.src = getCoverUrl(book);
      titleEl.textContent = book.titulo || "Sem Título";
      
      // Check Destaque Expiration
      let isDestaque = !!book.destaque;
      if (isDestaque && book.destaque_expiracao) {
        const now = new Date();
        const exp = new Date(book.destaque_expiracao);
        if (now > exp) isDestaque = false;
      }

      if (isDestaque) {
        badge.style.display = "flex";
      }
      
      // Check Novidade Expiration
      let isNew = !!book.novidade;
      if (isNew && book.novidade_expiracao) {
        const now = new Date();
        const exp = new Date(book.novidade_expiracao);
        if (now > exp) isNew = false;
      }

      if (isNew) {
        badgeNew.style.display = "block";
      }

      card.addEventListener("click", () => openBookDetails(book));
      grid.appendChild(node);
    });

    section.appendChild(grid);
    booksContainer.appendChild(section);
  });
}

async function loadBooks() {
  if (!state.token) return;
  
  try {
    // Removendo sort=-created e adicionando try/catch com alerta
    const data = await pocketbaseRequest("/api/collections/livros/records?perPage=200");
    state.books = Array.isArray(data.items) ? data.items : [];
    
    // Sort local (mais recentes primeiro)
    state.books.sort((a, b) => {
        const da = new Date(a.created || 0);
        const db = new Date(b.created || 0);
        return db - da; 
    });

    renderBooks();
  } catch (e) {
    console.error(e);
    booksContainer.innerHTML = `<div class="empty" style="color: #f85149;">Erro ao carregar livros: ${e.message}</div>`;
  }
}

// --- Genres Logic ---

function renderGenresManager() {
  // Select in Form
  formGeneroSelect.innerHTML = `<option value="">Selecione...</option>`;
  state.genres.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.nome;
    opt.textContent = g.nome;
    formGeneroSelect.appendChild(opt);
  });

  // Manager List
  genresListEl.innerHTML = "";
  state.genres.forEach(g => {
    const chip = document.createElement("div");
    chip.className = "genre-chip";
    chip.innerHTML = `
      <span>${g.nome}</span>
      <button class="delete-genre" type="button">&times;</button>
    `;
    
    const btn = chip.querySelector("button");
    btn.onclick = () => {
      showConfirm("Excluir Gênero?", `Deseja excluir "${g.nome}"?`, async () => {
        try {
          await pocketbaseRequest(`/api/collections/generos/records/${g.id}`, { method: "DELETE" });
          loadGenres();
        } catch(e) { showAlert("Erro", e.message); }
      });
    };
    
    genresListEl.appendChild(chip);
  });
}

async function loadGenres() {
  try {
    const data = await pocketbaseRequest("/api/collections/generos/records?sort=nome");
    state.genres = data.items || [];
    renderGenresManager();
  } catch (e) { console.error(e); }
}

addGenreBtn.addEventListener("click", async () => {
  const nome = (newGenreInput.value || "").trim();
  if (!nome) return;
  try {
    await pocketbaseRequest("/api/collections/generos/records", {
      method: "POST",
      body: JSON.stringify({ nome }),
      headers: { "Content-Type": "application/json" }
    });
    newGenreInput.value = "";
    loadGenres();
  } catch(e) { showAlert("Erro", e.message); }
});

// --- Edit/Create Book Logic ---

function editBook(book) {
  // Switch tab
  document.querySelector('[data-tab="add"]').click();
  
  state.editingId = book.id;
  editingIdInput.value = book.id;
  
  document.getElementById("formTitle").textContent = "Editar Livro";
  document.getElementById("formTitulo").value = book.titulo || "";
  document.getElementById("formAutor").value = book.autor || "";
  document.getElementById("formGenero").value = book.genero || "";
  document.getElementById("formPaginas").value = book.paginas || "";
  document.getElementById("formAno").value = book.ano || "";
  
  const isDestaque = !!book.destaque;
  document.getElementById("formDestaque").checked = isDestaque;
  destaqueDurationGroup.style.display = isDestaque ? "block" : "none";
  document.getElementById("formDestaqueDuracao").value = "";

  const isNovidade = !!book.novidade;
  document.getElementById("formNovidade").checked = isNovidade;
  novidadeDurationGroup.style.display = isNovidade ? "block" : "none";
  document.getElementById("formNovidadeDuracao").value = ""; // Reset select, as we don't store duration int, only expiration date

  document.getElementById("formAvaliacao").value = book.avaliacao || "";
  document.getElementById("formSinopse").value = book.sinopse || "";
  
  saveBookBtn.textContent = "Atualizar Livro";
  cancelEditBtn.style.display = "inline-block";
}

function cancelEdit() {
  state.editingId = null;
  editingIdInput.value = "";
  bookForm.reset();
  novidadeDurationGroup.style.display = "none";
  destaqueDurationGroup.style.display = "none";
  document.getElementById("formTitle").textContent = "Novo Livro";
  saveBookBtn.textContent = "Salvar Livro";
  cancelEditBtn.style.display = "none";
}

cancelEditBtn.addEventListener("click", cancelEdit);

bookForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const titulo = document.getElementById("formTitulo").value;
  const autor = document.getElementById("formAutor").value;
  
  if (checkDuplicate(titulo, autor, state.editingId)) {
    return showAlert("Duplicidade", "Já existe um livro cadastrado com este Título e Autor.");
  }

  saveBookBtn.disabled = true;
  saveBookBtn.textContent = "Processando...";
  
  try {
    const formData = new FormData(bookForm);
    const payload = new FormData();
    
    // Files
    formData.getAll("arquivo").forEach(f => { if(f.size > 0) payload.append("arquivo", f); });
    const capa = formData.get("capa");
    if (capa && capa.size > 0) payload.append("capa", capa);

    // Fields
    payload.append("titulo", formData.get("titulo"));
    payload.append("autor", formData.get("autor"));
    payload.append("genero", formData.get("genero"));
    payload.append("sinopse", formData.get("sinopse"));
    
    const isDestaque = formData.get("destaque") ? true : false;
    payload.append("destaque", isDestaque ? "true" : "false");
    
    if (isDestaque) {
      const days = parseInt(document.getElementById("formDestaqueDuracao").value);
      if (days) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        payload.append("destaque_expiracao", date.toISOString());
      } else {
        payload.append("destaque_expiracao", ""); 
      }
    } else {
      payload.append("destaque_expiracao", "");
    }
    
    const isNovidade = formData.get("novidade") ? true : false;
    payload.append("novidade", isNovidade ? "true" : "false");
    
    if (isNovidade) {
      const days = parseInt(document.getElementById("formNovidadeDuracao").value);
      if (days) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        payload.append("novidade_expiracao", date.toISOString());
      } else {
        payload.append("novidade_expiracao", ""); // Indefinido
      }
    } else {
      payload.append("novidade_expiracao", "");
    }
    
    if (formData.get("paginas")) payload.append("paginas", formData.get("paginas"));
    if (formData.get("ano")) payload.append("ano", formData.get("ano"));
    if (formData.get("avaliacao")) payload.append("avaliacao", formData.get("avaliacao"));

    if (state.editingId) {
      await pocketbaseRequest(`/api/collections/livros/records/${state.editingId}`, {
        method: "PATCH",
        body: payload
      });
      showAlert("Sucesso", "Atualizado com sucesso!");
      cancelEdit();
      document.querySelector('[data-tab="library"]').click();
    } else {
      await pocketbaseRequest("/api/collections/livros/records", {
        method: "POST",
        body: payload
      });
      showAlert("Sucesso", "Criado com sucesso!");
      bookForm.reset();
    }
  } catch(err) {
    showAlert("Erro", err.message);
  } finally {
    saveBookBtn.disabled = false;
    saveBookBtn.textContent = state.editingId ? "Atualizar Livro" : "Salvar Livro";
  }
});

// --- Auth Logic ---

async function checkAuth() {
  const storedUrl = localStorage.getItem("pb_base_url");
  const storedToken = localStorage.getItem("pb_token");
  
  if (storedUrl && storedToken) {
    state.baseUrl = storedUrl;
    state.token = storedToken;
    loginOverlay.style.display = "none";
    setStatus(true);
    await loadGenres(); // Load genres first for the form
    await loadBooks();
  } else {
    loginOverlay.style.display = "flex";
    setStatus(false);
  }
}

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = normalizeBaseUrl(baseUrlInput.value);
  const token = manualTokenInput.value.trim();
  
  if (!url || !token) return showAlert("Aviso", "Preencha todos os campos");
  
  state.baseUrl = url;
  state.token = token;
  
  try {
    // Validate by fetching genres
    await pocketbaseRequest("/api/collections/generos/records");
    
    localStorage.setItem("pb_base_url", url);
    localStorage.setItem("pb_token", token);
    loginOverlay.style.display = "none";
    setStatus(true);
    await loadGenres();
    await loadBooks();
  } catch (e) {
    showAlert("Erro", "Token inválido ou erro de conexão.");
    state.token = "";
  }
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("pb_token");
  location.reload();
});

changeTokenBtn.addEventListener("click", () => {
  showConfirm("Alterar Token", "Isso irá desconectar você. Deseja continuar?", () => {
    localStorage.removeItem("pb_token");
    location.reload();
  });
});

refreshBtn.addEventListener("click", loadBooks);
searchInput.addEventListener("input", renderBooks);

// Close Modal
closeModal.onclick = () => modal.style.display = "none";
window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; };

// Init
checkAuth();
