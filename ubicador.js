/* ==========================================================================
   UBICADOR DE INVITADOS (PUERTA) - 70 AÑOS DE MAMÁ GLADIS
   Buscador de solo lectura para ubicar invitados en la puerta del evento:
   verifica si confirmaron e indica su mesa.
   ========================================================================== */

// 1. CONFIGURACIÓN DE CONEXIÓN (COMPARTIDA CON admin.js / app.js)
const SUPABASE_URL = "https://mvdolghwdhggpiggtxiy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JFLeojGNwTs-PpvCb8y3TQ_05GT-JjB";

// CLAVE DE LA PUERTA (HASH SHA-256) — independiente de la clave de administrador.
// Corresponde al hash de "Puerta70". Para cambiarla, genera el SHA-256 de tu nueva
// clave y reemplaza este valor.
const PUERTA_PASSWORD_HASH = "14618f8f20dc56d4b3eaa296823185223eb4e14649b0ff879aaec60849712dec";

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const isSupabaseConfigured = SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== "";
let supabaseClient = null;
if (isSupabaseConfigured && typeof supabase !== 'undefined') {
  try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.error("Error al conectar Supabase (ubicador):", e);
  }
}
const useDB = isSupabaseConfigured && supabaseClient;

// Claves de almacenamiento local (las mismas que usa pizarra.js en modo sin conexión)
const LS_MESAS = "pizarra_mesas";
const LS_ASIG = "pizarra_asignaciones";

// Datos de prueba locales (solo si NO hay Supabase configurado)
const localGuestsMock = [
  { id: "mock-1", nombre_completo: "Sergio Castellanos", numero_mesa: "Mesa 1", confirmado: true, asistentes_confirmados: 3, pases_totales: 3 },
  { id: "mock-2", nombre_completo: "Familia Pérez", numero_mesa: "Mesa 5 (4 personas) y Mesa 6 (3 personas)", confirmado: true, asistentes_confirmados: 7, pases_totales: 7 },
  { id: "mock-3", nombre_completo: "Juan Carlos Pérez", numero_mesa: null, confirmado: false, asistentes_confirmados: 0, pases_totales: 4 },
  { id: "mock-4", nombre_completo: "María de los Ángeles Estrada", numero_mesa: null, confirmado: null, asistentes_confirmados: 0, pases_totales: 2 }
];

let searchTimer = null;

// Estado del listado general (se carga una vez al ingresar)
let allGuests = [];            // Todos los invitados
let mesaTextByGuest = {};      // { invitado_id: "Mesa 3" | "Mesa 5 (4 personas)..." }

// ==========================================================================
// LOGIN (clave propia de la puerta, sesión independiente del admin)
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("puerta-login-btn");
  const passInput = document.getElementById("puerta-pass-input");

  if (loginBtn) loginBtn.addEventListener("click", verifyPuertaAccess);
  if (passInput) {
    passInput.addEventListener("keydown", (e) => { if (e.key === "Enter") verifyPuertaAccess(); });
  }

  if (sessionStorage.getItem("puerta_logged_in") === "true") {
    unlockUbicador();
  }

  const searchInput = document.getElementById("ubicador-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", onSearchInput);
  }

  // Cerrar la lista de resultados al hacer clic fuera
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".ubicador-search-wrap")) {
      hideResults();
    }
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
});

async function verifyPuertaAccess() {
  const passInput = document.getElementById("puerta-pass-input");
  const errorMsg = document.getElementById("puerta-login-error");
  if (!passInput) return;

  const enteredHash = await sha256(passInput.value.trim());
  if (enteredHash === PUERTA_PASSWORD_HASH) {
    sessionStorage.setItem("puerta_logged_in", "true");
    if (errorMsg) errorMsg.classList.add("hidden");
    unlockUbicador();
  } else {
    if (errorMsg) errorMsg.classList.remove("hidden");
    passInput.value = "";
    passInput.focus();
  }
}

function unlockUbicador() {
  document.getElementById("puerta-lock-screen").classList.add("hidden");
  document.getElementById("ubicador-app").classList.remove("hidden");
  const input = document.getElementById("ubicador-search-input");
  if (input) input.focus();
  loadDirectory();
}

// ==========================================================================
// LISTADO GENERAL (todos los invitados, para ubicar por scroll)
// ==========================================================================
async function loadDirectory() {
  const listEl = document.getElementById("ubicador-directory-list");
  if (listEl) listEl.innerHTML = `<p class="ubicador-result-empty">Cargando listado...</p>`;

  try {
    let mesasAll = [], asigAll = [];
    if (useDB) {
      const [gRes, mRes, aRes] = await Promise.all([
        supabaseClient.from('invitados').select('id, nombre_completo, numero_mesa, confirmado, asistentes_confirmados, pases_totales').order('nombre_completo', { ascending: true }),
        supabaseClient.from('mesas').select('id, numero, nombre'),
        supabaseClient.from('asignaciones').select('invitado_id, mesa_id, cantidad')
      ]);
      if (gRes.error) throw gRes.error;
      // mesas/asignaciones podrían no existir si no se corrió el SQL: se ignora sin romper
      allGuests = gRes.data || [];
      mesasAll = (mRes && !mRes.error && mRes.data) ? mRes.data : [];
      asigAll = (aRes && !aRes.error && aRes.data) ? aRes.data : [];
    } else {
      allGuests = [...localGuestsMock].sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
      mesasAll = JSON.parse(localStorage.getItem(LS_MESAS) || "[]");
      asigAll = JSON.parse(localStorage.getItem(LS_ASIG) || "[]");
    }

    // Construir el texto de mesa por invitado a partir de las asignaciones reales
    mesaTextByGuest = {};
    allGuests.forEach(g => {
      const rows = asigAll
        .filter(a => a.invitado_id === g.id)
        .map(a => {
          const m = mesasAll.find(x => x.id === a.mesa_id);
          return m ? { numero: m.numero, nombre: m.nombre, cantidad: a.cantidad } : null;
        })
        .filter(Boolean);
      const fromPizarra = buildMesaText(rows);
      const fallback = (g.numero_mesa && String(g.numero_mesa).trim() !== "") ? g.numero_mesa : null;
      mesaTextByGuest[g.id] = fromPizarra || fallback;
    });

    renderDirectory();
  } catch (err) {
    console.error("Error al cargar el listado:", err);
    if (listEl) listEl.innerHTML = `<p class="ubicador-result-empty">No se pudo cargar el listado.</p>`;
  }
}

function renderDirectory() {
  const listEl = document.getElementById("ubicador-directory-list");
  const countEl = document.getElementById("ubicador-dir-count");
  if (!listEl) return;

  if (countEl) countEl.textContent = `${allGuests.length} invitado${allGuests.length === 1 ? '' : 's'}`;

  if (allGuests.length === 0) {
    listEl.innerHTML = `<p class="ubicador-result-empty">No hay invitados registrados.</p>`;
    return;
  }

  listEl.innerHTML = "";
  allGuests.forEach(g => {
    const statusDot = g.confirmado === true ? "dot-ok" : (g.confirmado === false ? "dot-no" : "dot-pend");
    const mesa = mesaTextByGuest[g.id];
    const mesaHtml = mesa
      ? `<span class="udir-mesa">${escapeHtml(mesa)}</span>`
      : `<span class="udir-mesa sin">Sin mesa</span>`;

    const row = document.createElement("button");
    row.type = "button";
    row.className = "ubicador-dir-item";
    row.innerHTML = `
      <span class="uri-dot ${statusDot}"></span>
      <span class="udir-name">${escapeHtml(g.nombre_completo)}</span>
      ${mesaHtml}
    `;
    row.addEventListener("click", () => {
      showDetail(g);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    listEl.appendChild(row);
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================================================
// BÚSQUEDA
// ==========================================================================
function onSearchInput(e) {
  const term = e.target.value.trim();
  const clearBtn = document.getElementById("ubicador-clear");
  if (clearBtn) clearBtn.classList.toggle("hidden", term === "");

  clearTimeout(searchTimer);
  if (term.length < 2) { hideResults(); return; }
  // Pequeño retraso para no consultar en cada tecla
  searchTimer = setTimeout(() => runSearch(term), 200);
}

function runSearch(term) {
  const resultsEl = document.getElementById("ubicador-results");
  if (!resultsEl) return;

  // Filtrar sobre el listado ya cargado en memoria
  const t = term.toLowerCase();
  const matches = allGuests
    .filter(g => g.nombre_completo.toLowerCase().includes(t))
    .slice(0, 12);

  renderResults(matches, term);
}

function renderResults(matches, term) {
  const resultsEl = document.getElementById("ubicador-results");
  resultsEl.innerHTML = "";

  if (matches.length === 0) {
    resultsEl.innerHTML = `<div class="ubicador-result-empty">No se encontró ningún invitado con «${escapeHtml(term)}».</div>`;
    resultsEl.classList.add("visible");
    return;
  }

  matches.forEach(g => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "ubicador-result-item";
    const statusDot = g.confirmado === true ? "dot-ok" : (g.confirmado === false ? "dot-no" : "dot-pend");
    item.innerHTML = `
      <span class="uri-dot ${statusDot}"></span>
      <span class="uri-name">${highlight(g.nombre_completo, term)}</span>
      <i data-lucide="chevron-right"></i>
    `;
    item.addEventListener("click", () => showDetail(g));
    resultsEl.appendChild(item);
  });

  resultsEl.classList.add("visible");
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function hideResults() {
  const resultsEl = document.getElementById("ubicador-results");
  if (resultsEl) resultsEl.classList.remove("visible");
}

// ==========================================================================
// MESA REAL (desde las asignaciones de la Pizarra de Mesas)
// ==========================================================================
function mesaLabel(mesa) {
  return (mesa.nombre && String(mesa.nombre).trim() !== "") ? String(mesa.nombre).trim() : `Mesa ${mesa.numero}`;
}

// Construye el texto estandarizado a partir de las asignaciones reales:
//  - 1 mesa  -> "Mesa 1"
//  - varias  -> "Mesa 1 (3 personas) y Mesa 2 (2 personas)"
function buildMesaText(rows) {
  if (!rows || rows.length === 0) return null;
  rows.sort((a, b) => a.numero - b.numero);
  if (rows.length === 1) return mesaLabel(rows[0]);
  return rows.map(r => `${mesaLabel(r)} (${r.cantidad} persona${r.cantidad === 1 ? '' : 's'})`).join(" y ");
}

// Obtiene la mesa asignada en la pizarra para un invitado (fuente de verdad).
// Devuelve el texto, o null si esa familia aún no fue asignada en la pizarra.
async function getAssignedMesaText(guestId) {
  try {
    if (useDB) {
      const { data: asigs, error } = await supabaseClient
        .from('asignaciones')
        .select('mesa_id, cantidad')
        .eq('invitado_id', guestId);
      if (error) throw error;
      if (!asigs || asigs.length === 0) return null;

      const mesaIds = [...new Set(asigs.map(a => a.mesa_id))];
      const { data: mesasData, error: mErr } = await supabaseClient
        .from('mesas')
        .select('id, numero, nombre')
        .in('id', mesaIds);
      if (mErr) throw mErr;

      const rows = asigs.map(a => {
        const m = (mesasData || []).find(x => x.id === a.mesa_id);
        return m ? { numero: m.numero, nombre: m.nombre, cantidad: a.cantidad } : null;
      }).filter(Boolean);
      return buildMesaText(rows);
    } else {
      // Modo local: leer la distribución guardada por la pizarra en este navegador
      const mesasLS = JSON.parse(localStorage.getItem(LS_MESAS) || "[]");
      const asigLS = JSON.parse(localStorage.getItem(LS_ASIG) || "[]");
      const rows = asigLS
        .filter(a => a.invitado_id === guestId)
        .map(a => {
          const m = mesasLS.find(x => x.id === a.mesa_id);
          return m ? { numero: m.numero, nombre: m.nombre, cantidad: a.cantidad } : null;
        })
        .filter(Boolean);
      return buildMesaText(rows);
    }
  } catch (err) {
    console.error("Error al obtener la mesa asignada:", err);
    return null;
  }
}

// ==========================================================================
// DETALLE DEL INVITADO (tarjeta grande para la puerta)
// ==========================================================================
async function showDetail(g) {
  hideResults();
  const detail = document.getElementById("ubicador-detail");
  if (!detail) return;

  // Mesa real desde la pizarra; si nunca se asignó allí, usar la columna de texto como respaldo
  const assignedMesa = await getAssignedMesaText(g.id);
  const mesaText = assignedMesa || ((g.numero_mesa && String(g.numero_mesa).trim() !== "") ? g.numero_mesa : null);

  // Estado de confirmación
  let statusHtml, statusClass;
  if (g.confirmado === true) {
    statusClass = "status-ok";
    statusHtml = `<i data-lucide="check-circle"></i> Confirmó asistencia`;
  } else if (g.confirmado === false) {
    statusClass = "status-no";
    statusHtml = `<i data-lucide="x-circle"></i> Indicó que NO asistiría`;
  } else {
    statusClass = "status-pend";
    statusHtml = `<i data-lucide="help-circle"></i> No respondió la invitación`;
  }

  const hasMesa = mesaText !== null;
  const mesaBlock = hasMesa
    ? `<div class="ubicador-mesa"><span class="ubicador-mesa-label">Mesa asignada</span><span class="ubicador-mesa-value">${escapeHtml(mesaText)}</span></div>`
    : `<div class="ubicador-mesa sin-mesa"><span class="ubicador-mesa-label">Mesa asignada</span><span class="ubicador-mesa-value">Sin mesa asignada todavía</span></div>`;

  // Personas (solo relevante si confirmó)
  const personasHtml = g.confirmado === true
    ? `<div class="ubicador-personas"><i data-lucide="users"></i> ${g.asistentes_confirmados || 0} persona(s) asistirán</div>`
    : "";

  detail.innerHTML = `
    <button type="button" class="ubicador-detail-close" title="Buscar otro" onclick="clearUbicador()"><i data-lucide="x"></i></button>
    <h2 class="ubicador-detail-name">${escapeHtml(g.nombre_completo)}</h2>
    <div class="ubicador-status ${statusClass}">${statusHtml}</div>
    ${mesaBlock}
    ${personasHtml}
  `;
  detail.classList.remove("hidden");
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function clearUbicador() {
  const input = document.getElementById("ubicador-search-input");
  const detail = document.getElementById("ubicador-detail");
  const clearBtn = document.getElementById("ubicador-clear");
  if (input) { input.value = ""; input.focus(); }
  if (detail) detail.classList.add("hidden");
  if (clearBtn) clearBtn.classList.add("hidden");
  hideResults();
}

// ==========================================================================
// UTILIDADES
// ==========================================================================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Resaltar el término buscado dentro del nombre
function highlight(name, term) {
  const safe = escapeHtml(name);
  if (!term) return safe;
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    const regex = new RegExp(`(${escapedTerm})`, "gi");
    return safe.replace(regex, "<strong>$1</strong>");
  } catch (e) {
    return safe;
  }
}
