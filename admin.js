/* ==========================================================================
   LÓGICA DEL PANEL DE ADMINISTRACIÓN - 70 AÑOS DE DOÑA GLADIS
   ========================================================================== */

// 1. CONFIGURACIÓN DE CONEXIÓN A SUPABASE (COMPARTIDA CON APP.JS)
const SUPABASE_URL = "https://mvdolghwdhggpiggtxiy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JFLeojGNwTs-PpvCb8y3TQ_05GT-JjB";

// CLAVE DE ACCESO ADMINISTRATIVA (HASH SHA-256)
// Corresponde al hash de "Gladis70Admin". Puedes generar otro hash en SHA-256 y reemplazarlo aquí para cambiar la contraseña.
const ADMIN_PASSWORD_HASH = "c672ea0fd92f81c3f6a572d67ef98f7792e71d1b5d9f94929bca56fbccf613aa";

// Helper para calcular hash SHA-256 en el cliente
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

const isSupabaseConfigured = SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== "";
let supabaseClient = null;

// Inicializar Supabase si está disponible
if (isSupabaseConfigured) {
  try {
    if (typeof supabase !== 'undefined') {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  } catch (e) {
    console.error("Error al conectar Supabase Admin:", e);
  }
}

// Datos de prueba locales si no está conectado Supabase
let localAdminMock = [
  { id: "mock-1", nombre_completo: "Sergio Castellanos", codigo_acceso: "1234", numero_mesa: "Mesa 1", pases_totales: 3, confirmado: true, asistentes_confirmados: 2, comentarios: "¡Felicidades Doña Gladis, un fuerte abrazo!", fecha_confirmacion: "2026-06-09T14:10:00Z" },
  { id: "mock-2", nombre_completo: "María de los Ángeles Estrada", codigo_acceso: "5678", numero_mesa: null, pases_totales: 2, confirmado: null, asistentes_confirmados: 0, comentarios: "" },
  { id: "mock-3", nombre_completo: "Juan Carlos Pérez", codigo_acceso: "4321", numero_mesa: "Mesa 3", pases_totales: 4, confirmado: false, asistentes_confirmados: 0, comentarios: "Lamentablemente no podré ir por un viaje, saludos." },
  { id: "mock-4", nombre_completo: "Gladis Elizabeth Ruano Estrada", codigo_acceso: "7070", numero_mesa: "Mesa de Honor", pases_totales: 1, confirmado: null, asistentes_confirmados: 0, comentarios: "" },
  { id: "mock-5", nombre_completo: "Familiar Ruano", codigo_acceso: "9999", numero_mesa: null, pases_totales: 5, confirmado: null, asistentes_confirmados: 0, comentarios: "" }
];

// Variables de Estado
let allGuests = [];
let filteredGuests = [];

// ==========================================================================
// INICIALIZACIÓN Y CONTROL DE ACCESO (LOGIN)
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("admin-login-btn");
  const passInput = document.getElementById("admin-pass-input");
  
  if (loginBtn && passInput) {
    // Escuchar botón de login
    loginBtn.addEventListener("click", verifyAdminAccess);
    
    // Escuchar tecla Enter en input
    passInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        verifyAdminAccess();
      }
    });
  }

  // Verificar si ya inició sesión en esta sesión del navegador
  if (sessionStorage.getItem("admin_logged_in") === "true") {
    unlockAdminDashboard();
  }

  // Configurar buscador y filtros en tiempo real
  const searchInput = document.getElementById("admin-search-input");
  const filterSelect = document.getElementById("admin-filter-status");
  
  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }
  if (filterSelect) {
    filterSelect.addEventListener("change", applyFilters);
  }

  // Cargar iconos iniciales
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

// Verificar Contraseña de Administración (Comparando hashes)
async function verifyAdminAccess() {
  const passInput = document.getElementById("admin-pass-input");
  const errorMsg = document.getElementById("admin-login-error");
  
  if (!passInput) return;
  
  const enteredPass = passInput.value.trim();
  const enteredHash = await sha256(enteredPass);
  
  if (enteredHash === ADMIN_PASSWORD_HASH) {
    sessionStorage.setItem("admin_logged_in", "true");
    if (errorMsg) errorMsg.classList.add("hidden");
    unlockAdminDashboard();
  } else {
    if (errorMsg) errorMsg.classList.remove("hidden");
    passInput.value = "";
    passInput.focus();
  }
}

// Desbloquear Panel y Mostrar Datos
function unlockAdminDashboard() {
  const lockScreen = document.getElementById("admin-lock-screen");
  const dashboard = document.getElementById("admin-dashboard");
  
  if (lockScreen) lockScreen.classList.add("hidden");
  if (dashboard) dashboard.classList.remove("hidden");
  
  // Cargar la lista desde la base de datos
  loadGuestsList();
}

// Cerrar Panel (Logout)
function logoutAdmin() {
  sessionStorage.removeItem("admin_logged_in");
  
  const lockScreen = document.getElementById("admin-lock-screen");
  const dashboard = document.getElementById("admin-dashboard");
  const passInput = document.getElementById("admin-pass-input");
  
  if (lockScreen) lockScreen.classList.remove("hidden");
  if (dashboard) dashboard.classList.add("hidden");
  if (passInput) {
    passInput.value = "";
    passInput.focus();
  }
}

// ==========================================================================
// OPERACIONES DE CARGA Y BÚSQUEDA DE INVITADOS
// ==========================================================================
async function loadGuestsList() {
  const loader = document.getElementById("admin-main-loader");
  if (loader) loader.classList.remove("hidden");
  
  try {
    if (isSupabaseConfigured && supabaseClient) {
      // Consultar todos los invitados de Supabase ordenados por nombre
      const { data, error } = await supabaseClient
        .from('invitados')
        .select('*')
        .order('nombre_completo', { ascending: true });
        
      if (error) throw error;
      allGuests = data || [];
    } else {
      // Modo Mock local
      allGuests = [...localAdminMock];
      // Ordenar por nombre
      allGuests.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
    }
    
    // Calcular estadísticas y renderizar
    calculateStats(allGuests);
    applyFilters();
    
  } catch (error) {
    console.error("Error al cargar la lista de invitados:", error);
    alert("Ocurrió un error al conectar con Supabase. Asegúrate de haber ejecutado el script SQL y configurado las credenciales.");
  } finally {
    if (loader) loader.classList.add("hidden");
  }
}

// Calcular Estadísticas de Confirmación (KPIs)
function calculateStats(guests) {
  let total = guests.length;
  let confirmed = 0;
  let declined = 0;
  let pending = 0;
  let plates = 0;
  
  guests.forEach(g => {
    if (g.confirmado === true) {
      confirmed++;
      plates += (g.asistentes_confirmados || 0);
    } else if (g.confirmado === false) {
      declined++;
    } else {
      pending++;
    }
  });
  
  document.getElementById("stat-total").innerText = total;
  document.getElementById("stat-confirmed").innerText = confirmed;
  document.getElementById("stat-plates").innerText = plates;
  document.getElementById("stat-declined").innerText = declined;
  document.getElementById("stat-pending").innerText = pending;
}

// Aplicar Búsqueda y Filtros
function applyFilters() {
  const searchVal = document.getElementById("admin-search-input").value.toLowerCase().trim();
  const filterVal = document.getElementById("admin-filter-status").value;
  
  filteredGuests = allGuests.filter(g => {
    // 1. Filtro de Búsqueda de Nombre
    const nameMatch = g.nombre_completo.toLowerCase().includes(searchVal);
    
    // 2. Filtro de Estado
    let statusMatch = true;
    if (filterVal === "attending") {
      statusMatch = g.confirmado === true;
    } else if (filterVal === "declined") {
      statusMatch = g.confirmado === false;
    } else if (filterVal === "pending") {
      statusMatch = g.confirmado === null;
    }
    
    return nameMatch && statusMatch;
  });
  
  renderTable(filteredGuests);
}

// Renderizar Tabla
function renderTable(guests) {
  const tbody = document.getElementById("admin-table-body");
  if (!tbody) return;
  
  tbody.innerHTML = "";
  
  if (guests.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--color-text-muted); font-style: italic; padding: 30px;">
          No se encontraron invitados con los criterios de búsqueda.
        </td>
      </tr>
    `;
    return;
  }
  
  guests.forEach(g => {
    const tr = document.createElement("tr");
    
    // Badge de Estado
    let badgeHtml = "";
    if (g.confirmado === true) {
      badgeHtml = `<span class="admin-badge badge-attending"><i data-lucide="check"></i> Sí</span>`;
    } else if (g.confirmado === false) {
      badgeHtml = `<span class="admin-badge badge-declined"><i data-lucide="x"></i> No</span>`;
    } else {
      badgeHtml = `<span class="admin-badge badge-pending"><i data-lucide="help-circle"></i> Pendiente</span>`;
    }
    
    // Mesa
    const mesaText = g.numero_mesa && g.numero_mesa.trim() !== "" 
      ? g.numero_mesa 
      : `<span style="color:var(--color-text-muted); font-style:italic;">Por asignarse</span>`;
      
    // Asistentes reales confirmados
    const asistentesText = g.confirmado === true ? `${g.asistentes_confirmados} de ${g.pases_totales}` : `-`;
    
    // Comentario / Mensaje
    let commentHtml = "-";
    if (g.comentarios && g.comentarios.trim() !== "") {
      // Escapar caracteres del comentario para pasarlo seguro al atributo onclick
      const escapedComment = g.comentarios.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
      commentHtml = `
        <button type="button" class="btn-comment-bubble" onclick="openCommentModal('${g.nombre_completo.replace(/'/g, "\\'")}', '${escapedComment}')" title="Leer mensaje">
          <i data-lucide="message-square"></i>
        </button>
      `;
    }

    // Generar mensaje de invitación personalizado
    const inviteUrl = "https://sergioc11.github.io/invitacion-gladis/";
    // Enlace personalizado: lleva el código embebido para que la invitación
    // reconozca automáticamente al invitado al hacer clic (sin teclear el código).
    const personalInviteUrl = `${inviteUrl}?inv=${encodeURIComponent(g.id)}&pin=${encodeURIComponent(g.codigo_acceso)}`;
    const shareMessage = `Hola *${g.nombre_completo}*, queremos invitarte de manera muy especial a celebrar los *70 Años de Doña Gladis*. 🌸

Solo da clic en tu enlace personal para ver todos los detalles y confirmar tu asistencia. ¡La invitación te reconocerá automáticamente!
👉 ${personalInviteUrl}

🔑 Por si lo necesitas, tu código de acceso personal es: *${g.codigo_acceso}*

¡Esperamos contar con tu valiosa presencia!`;

    const escapedShareMessage = shareMessage.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
    
    tr.innerHTML = `
      <td class="td-guest-name">${g.nombre_completo}</td>
      <td>${mesaText}</td>
      <td class="td-guest-pin">${g.codigo_acceso}</td>
      <td style="text-align: center; font-weight: 600;">${g.pases_totales}</td>
      <td style="text-align: center;">${badgeHtml}</td>
      <td style="text-align: center; font-weight: 500;">${asistentesText}</td>
      <td style="text-align: center;">${commentHtml}</td>
      <td style="text-align: center;">
        <div style="display: flex; gap: 8px; justify-content: center;">
          <button type="button" class="btn-action btn-edit-action" onclick="copyToClipboard('${escapedShareMessage}', this)" title="Copiar mensaje de invitación">
            <i data-lucide="copy" style="width:14px; height:14px;"></i>
          </button>
          <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}" target="_blank" class="btn-action" style="color: #2E7D32; border: 1.5px solid #A5D6A7; background-color: #E8F5E9;" title="Compartir por WhatsApp">
            <i data-lucide="send" style="width:14px; height:14px;"></i>
          </a>
        </div>
      </td>
      <td style="text-align: center;">
        <div class="admin-actions" style="justify-content: center;">
          <button type="button" class="btn-action btn-edit-action" onclick="openEditGuestModal('${g.id}')" title="Editar">
            <i data-lucide="edit-2" style="width:14px; height:14px;"></i>
          </button>
          <button type="button" class="btn-action btn-delete-action" onclick="deleteGuestConfirm('${g.id}', '${g.nombre_completo.replace(/'/g, "\\'")}')" title="Eliminar">
            <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
          </button>
        </div>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  
  // Recargar iconos de Lucide dinámicos
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// ==========================================================================
// DESCARGAR REPORTE DE INVITADOS (CSV)
// ==========================================================================
function downloadReport() {
  if (!allGuests || allGuests.length === 0) {
    alert("No hay invitados para exportar.");
    return;
  }

  // Encabezados de las columnas solicitadas
  const headers = ["No.", "Nombre Completo", "Mesa", "Pases Totales", "Estado", "Asistentes Reales"];

  // Helper para escapar valores en formato CSV
  const escapeCSV = (value) => {
    const str = (value === null || value === undefined) ? "" : String(value);
    // Si contiene comas, comillas o saltos de línea, se envuelve en comillas dobles
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Construir filas a partir de la lista completa (ordenada por nombre)
  const rows = allGuests.map((g, index) => {
    const mesa = (g.numero_mesa && g.numero_mesa.trim() !== "") ? g.numero_mesa : "Por asignarse";

    let estado;
    if (g.confirmado === true) {
      estado = "Confirmado (Sí)";
    } else if (g.confirmado === false) {
      estado = "No Asistirá";
    } else {
      estado = "Pendiente";
    }

    // Asistentes reales: solo aplica si confirmó asistencia
    const asistentes = g.confirmado === true ? (g.asistentes_confirmados || 0) : 0;

    return [
      escapeCSV(index + 1),
      escapeCSV(g.nombre_completo),
      escapeCSV(mesa),
      escapeCSV(g.pases_totales),
      escapeCSV(estado),
      escapeCSV(asistentes)
    ].join(",");
  });

  // Unir todo con BOM UTF-8 para acentos correctos en Excel
  const csvContent = "﻿" + [headers.join(","), ...rows].join("\n");

  // Generar y disparar la descarga
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const fecha = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `reporte-invitados-${fecha}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==========================================================================
// MODAL: CREAR / EDITAR INVITADOS (CRUD)
// ==========================================================================
function openAddGuestModal() {
  // Configurar Modal para Insertar
  document.getElementById("modal-title").innerText = "Agregar Nuevo Invitado";
  document.getElementById("modal-guest-id").value = "";
  
  // Limpiar campos
  document.getElementById("modal-guest-name").value = "";
  document.getElementById("modal-guest-passes").value = "1";
  document.getElementById("modal-guest-table").value = "";
  
  // Generar PIN aleatorio por defecto
  generateRandomPIN();
  
  // Mostrar modal
  document.getElementById("admin-guest-modal").classList.add("active");
  document.getElementById("modal-guest-name").focus();
}

function openEditGuestModal(guestId) {
  // Buscar invitado en el array local
  const guest = allGuests.find(g => g.id === guestId);
  if (!guest) return;
  
  // Configurar Modal para Editar
  document.getElementById("modal-title").innerText = "Editar Invitado";
  document.getElementById("modal-guest-id").value = guest.id;
  
  // Poblar campos
  document.getElementById("modal-guest-name").value = guest.nombre_completo;
  document.getElementById("modal-guest-passes").value = guest.pases_totales;
  document.getElementById("modal-guest-table").value = guest.numero_mesa || "";
  document.getElementById("modal-guest-pin").value = guest.codigo_acceso;
  
  // Mostrar modal
  document.getElementById("admin-guest-modal").classList.add("active");
  document.getElementById("modal-guest-name").focus();
}

function closeGuestModal() {
  document.getElementById("admin-guest-modal").classList.remove("active");
}

// Generador de PIN Aleatorio de 4 Dígitos
function generateRandomPIN() {
  const pinInput = document.getElementById("modal-guest-pin");
  if (!pinInput) return;
  
  // Generar un número aleatorio de 4 dígitos (1000 a 9999)
  const pin = Math.floor(1000 + Math.random() * 9000);
  pinInput.value = pin;
}

// Guardar o Actualizar Invitado (Supabase o Fallback)
async function saveGuest(event) {
  event.preventDefault();
  
  const saveBtn = document.getElementById("btn-save-submit");
  const guestId = document.getElementById("modal-guest-id").value;
  const name = document.getElementById("modal-guest-name").value.trim();
  const passes = parseInt(document.getElementById("modal-guest-passes").value, 10);
  const table = document.getElementById("modal-guest-table").value.trim();
  const pin = document.getElementById("modal-guest-pin").value.trim();
  
  // Validaciones
  if (!name || isNaN(passes) || passes < 1 || !pin) {
    alert("Por favor completa los campos obligatorios.");
    return;
  }
  
  if (pin.length !== 4 || isNaN(parseInt(pin, 10))) {
    alert("El PIN de confirmación debe constar exactamente de 4 dígitos numéricos.");
    return;
  }
  
  // Deshabilitar botón
  saveBtn.disabled = true;
  const originalBtnText = saveBtn.innerText;
  saveBtn.innerText = "Procesando...";
  
  try {
    if (isSupabaseConfigured && supabaseClient) {
      if (guestId) {
        // ACTUALIZAR (UPDATE)
        const { error } = await supabaseClient
          .from('invitados')
          .update({
            nombre_completo: name,
            pases_totales: passes,
            numero_mesa: table !== "" ? table : null,
            codigo_acceso: pin
          })
          .eq('id', guestId);
          
        if (error) throw error;
      } else {
        // CREAR NUEVO (INSERT)
        const { error } = await supabaseClient
          .from('invitados')
          .insert([{
            nombre_completo: name,
            pases_totales: passes,
            numero_mesa: table !== "" ? table : null,
            codigo_acceso: pin
          }]);
          
        if (error) throw error;
      }
    } else {
      // Modo Fallback Local
      if (guestId) {
        // Actualizar en array en memoria
        const idx = localAdminMock.findIndex(g => g.id === guestId);
        if (idx !== -1) {
          localAdminMock[idx].nombre_completo = name;
          localAdminMock[idx].pases_totales = passes;
          localAdminMock[idx].numero_mesa = table !== "" ? table : null;
          localAdminMock[idx].codigo_acceso = pin;
        }
      } else {
        // Agregar nuevo elemento local
        const newId = "mock-" + Date.now();
        localAdminMock.push({
          id: newId,
          nombre_completo: name,
          pases_totales: passes,
          numero_mesa: table !== "" ? table : null,
          codigo_acceso: pin,
          confirmado: null,
          asistentes_confirmados: 0,
          comentarios: ""
        });
      }
    }
    
    // Cerrar y Recargar
    closeGuestModal();
    await loadGuestsList();
    
  } catch (error) {
    console.error("Error al guardar invitado:", error);
    alert("Ocurrió un error al guardar el registro en la base de datos de Supabase. Revisa la consola para más detalles.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = originalBtnText;
  }
}

// Eliminar Invitado
async function deleteGuestConfirm(guestId, guestName) {
  const consent = confirm(`¿Estás completamente seguro de que deseas eliminar permanentemente a "${guestName}" de la lista de invitados?`);
  if (!consent) return;
  
  const loader = document.getElementById("admin-main-loader");
  if (loader) loader.classList.remove("hidden");
  
  try {
    if (isSupabaseConfigured && supabaseClient) {
      // Eliminar de Supabase (DELETE)
      const { error } = await supabaseClient
        .from('invitados')
        .delete()
        .eq('id', guestId);
        
      if (error) throw error;
    } else {
      // Fallback local
      localAdminMock = localAdminMock.filter(g => g.id !== guestId);
    }
    
    // Recargar lista
    await loadGuestsList();
    
  } catch (error) {
    console.error("Error al eliminar invitado:", error);
    alert("Ocurrió un error al borrar el invitado de la base de datos.");
  } finally {
    if (loader) loader.classList.add("hidden");
  }
}

// ==========================================================================
// MODAL: MOSTRAR COMENTARIOS LARGOS
// ==========================================================================
function openCommentModal(guestName, commentText) {
  const modal = document.getElementById("admin-comment-modal");
  const authorEl = document.getElementById("comment-modal-author");
  const textEl = document.getElementById("comment-modal-text");
  
  if (modal && authorEl && textEl) {
    authorEl.innerText = guestName;
    textEl.innerText = commentText;
    modal.classList.add("active");
  }
}

function closeCommentModal() {
  document.getElementById("admin-comment-modal").classList.remove("active");
}

// Copiar texto al portapapeles con indicador de éxito
function copyToClipboard(text, buttonElement) {
  navigator.clipboard.writeText(text).then(() => {
    // Feedback visual inmediato en el botón
    const originalHTML = buttonElement.innerHTML;
    const originalBorder = buttonElement.style.borderColor;
    const originalColor = buttonElement.style.color;
    
    buttonElement.innerHTML = `<i data-lucide="check" style="width:14px; height:14px;"></i>`;
    buttonElement.style.borderColor = "#2E7D32";
    buttonElement.style.color = "#2E7D32";
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // Restaurar después de 1.5 segundos
    setTimeout(() => {
      buttonElement.innerHTML = originalHTML;
      buttonElement.style.borderColor = originalBorder;
      buttonElement.style.color = originalColor;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 1500);
  }).catch(err => {
    console.error("Error al copiar texto:", err);
    alert("No se pudo copiar el mensaje automáticamente. Intenta seleccionándolo manualmente.");
  });
}
