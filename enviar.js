/* ==========================================================================
   PÁGINA DE ENVÍO DE INVITACIONES (SOLO LECTURA) - 70 AÑOS DE MAMÁ GLADIS
   Pensada para compartirse con un familiar y enviar las invitaciones por
   WhatsApp desde el teléfono. NO permite modificar ni borrar datos.
   ========================================================================== */

// 1. CONFIGURACIÓN DE SUPABASE (misma que el resto del sitio)
const SUPABASE_URL = "https://mvdolghwdhggpiggtxiy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JFLeojGNwTs-PpvCb8y3TQ_05GT-JjB";

// CLAVE DE ACCESO (HASH SHA-256). Corresponde a la contraseña: "Gladis70Envios"
// Para cambiarla, genera el SHA-256 de la nueva clave y reemplaza este valor.
const SEND_PASSWORD_HASH = "472b1be370f8082dc373d5e86f0268140d62f7ad63479551f009e703ee3f49b2";

// Enlace base de la invitación publicada
const INVITE_BASE_URL = "https://sergioc11.github.io/invitacion-gladis/";

// Helper SHA-256
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const isSupabaseConfigured = SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== "";
let supabaseClient = null;

if (isSupabaseConfigured) {
  try {
    if (typeof supabase !== 'undefined') {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  } catch (e) {
    console.error("Error al conectar Supabase:", e);
  }
}

// Datos de prueba locales (si no hay Supabase)
const localMock = [
  { id: "mock-1", nombre_completo: "Sergio Castellanos", telefono: "50212345678", codigo_acceso: "1234", numero_mesa: "Mesa 1", pases_totales: 3, confirmado: true, asistentes_confirmados: 2, invitacion_enviada: true },
  { id: "mock-2", nombre_completo: "María de los Ángeles Estrada", telefono: null, codigo_acceso: "5678", numero_mesa: null, pases_totales: 2, confirmado: null, asistentes_confirmados: 0, invitacion_enviada: false },
  { id: "mock-3", nombre_completo: "Juan Carlos Pérez", telefono: "50255667788", codigo_acceso: "4321", numero_mesa: "Mesa 3", pases_totales: 4, confirmado: false, asistentes_confirmados: 0, invitacion_enviada: false }
];

// Estado
let allGuests = [];

// Detección de dispositivo (móvil vs computadora)
const IS_MOBILE = /Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry/i.test(navigator.userAgent);

// Referencia a la ÚNICA pestaña de WhatsApp Web que abre el panel (escritorio).
// Reutilizarla evita la pantalla intermedia de api.whatsapp.com y que se "bote"
// la sesión por abrir pestañas nuevas en cada envío.
let whatsappWindowRef = null;

// ==========================================================================
// INICIALIZACIÓN Y LOGIN
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("send-login-btn");
  const passInput = document.getElementById("send-pass-input");

  if (loginBtn && passInput) {
    loginBtn.addEventListener("click", verifyAccess);
    passInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") verifyAccess();
    });
  }

  if (sessionStorage.getItem("send_logged_in") === "true") {
    unlockDashboard();
  }

  const searchInput = document.getElementById("send-search-input");
  const filterSelect = document.getElementById("send-filter");
  if (searchInput) searchInput.addEventListener("input", render);
  if (filterSelect) filterSelect.addEventListener("change", render);

  if (typeof lucide !== 'undefined') lucide.createIcons();
});

async function verifyAccess() {
  const passInput = document.getElementById("send-pass-input");
  const errorMsg = document.getElementById("send-login-error");
  if (!passInput) return;

  const enteredHash = await sha256(passInput.value.trim());
  if (enteredHash === SEND_PASSWORD_HASH) {
    sessionStorage.setItem("send_logged_in", "true");
    if (errorMsg) errorMsg.classList.add("hidden");
    unlockDashboard();
  } else {
    if (errorMsg) errorMsg.classList.remove("hidden");
    passInput.value = "";
    passInput.focus();
  }
}

function unlockDashboard() {
  document.getElementById("send-lock-screen").classList.add("hidden");
  document.getElementById("send-dashboard").classList.remove("hidden");
  loadGuests();
}

// ==========================================================================
// CARGA DE INVITADOS (SOLO LECTURA)
// ==========================================================================
async function loadGuests() {
  const loader = document.getElementById("send-loader");
  if (loader) loader.classList.remove("hidden");

  try {
    if (isSupabaseConfigured && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('invitados')
        .select('id, nombre_completo, telefono, codigo_acceso, numero_mesa, pases_totales, confirmado, asistentes_confirmados, invitacion_enviada')
        .order('nombre_completo', { ascending: true });

      if (error) throw error;
      allGuests = data || [];
    } else {
      allGuests = [...localMock].sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
    }
    render();
  } catch (error) {
    console.error("Error al cargar invitados:", error);
    alert("Ocurrió un error al cargar la lista de invitados. Verifica tu conexión a internet e inténtalo de nuevo.");
  } finally {
    if (loader) loader.classList.add("hidden");
  }
}

// ==========================================================================
// MARCAS DE "ENVIADO" (guardadas en la BASE DE DATOS, campo invitacion_enviada)
// ==========================================================================
async function setSentStatus(guestId, sent) {
  const guest = allGuests.find(g => g.id === guestId);
  if (!guest) return;

  // Actualizar en memoria de inmediato para que la interfaz responda al instante
  guest.invitacion_enviada = sent;
  render();

  try {
    if (isSupabaseConfigured && supabaseClient) {
      const { error } = await supabaseClient
        .from('invitados')
        .update({ invitacion_enviada: sent })
        .eq('id', guestId);

      if (error) throw error;
    }
    // En modo local (mock) la actualización en memoria es suficiente
  } catch (e) {
    console.error("Error al guardar la marca de enviado:", e);
    // Revertir el cambio visual si la base de datos falló
    guest.invitacion_enviada = !sent;
    render();
    alert("No se pudo guardar la marca de enviado en la base de datos. Verifica tu conexión.");
  }
}

function toggleSent(guestId) {
  const guest = allGuests.find(g => g.id === guestId);
  setSentStatus(guestId, !(guest && guest.invitacion_enviada === true));
}

// ==========================================================================
// CONSTRUCCIÓN DEL MENSAJE Y ENLACE DE WHATSAPP
// ==========================================================================
function buildShareMessage(g) {
  const personalInviteUrl = `${INVITE_BASE_URL}?inv=${encodeURIComponent(g.id)}&pin=${encodeURIComponent(g.codigo_acceso)}`;
  return `Hola *${g.nombre_completo}*, queremos invitarte de manera muy especial a celebrar los *70 Años de Mamá Gladis*. 🌸

Solo da clic en tu enlace personal para ver todos los detalles y confirmar tu asistencia. ¡La invitación te reconocerá automáticamente!
👉 ${personalInviteUrl}

🔑 Por si lo necesitas, tu código de acceso personal es: *${g.codigo_acceso}*

¡Esperamos contar con tu valiosa presencia!`;
}

function buildWhatsappUrl(g) {
  const phoneDigits = g.telefono ? String(g.telefono).replace(/\D/g, "") : "";
  const encodedMsg = encodeURIComponent(buildShareMessage(g));

  if (phoneDigits) {
    // Móvil: esquema whatsapp:// -> abre la APP instalada directamente,
    // sin pasar por ninguna página intermedia del navegador.
    // Computadora: web.whatsapp.com -> abre WhatsApp Web directo.
    return IS_MOBILE
      ? `whatsapp://send?phone=${phoneDigits}&text=${encodedMsg}`
      : `https://web.whatsapp.com/send?phone=${phoneDigits}&text=${encodedMsg}`;
  }
  return IS_MOBILE
    ? `whatsapp://send?text=${encodedMsg}`
    : `https://api.whatsapp.com/send?text=${encodedMsg}`;
}

// Abrir WhatsApp reutilizando una sola pestaña de WhatsApp Web en computadora.
// En celular devuelve true para que el enlace abra la app nativa normalmente.
function waSendDesktop(url) {
  if (IS_MOBILE) return true;
  if (whatsappWindowRef && !whatsappWindowRef.closed) {
    whatsappWindowRef.location.href = url;
    whatsappWindowRef.focus();
  } else {
    whatsappWindowRef = window.open(url, "whatsapp_web_panel");
  }
  return false; // evita que el enlace abra además su propia pestaña
}

// Manejar el clic del botón Enviar: marca como enviado (en la BD) y abre WhatsApp.
function sendInvite(guestId, url) {
  const guest = allGuests.find(g => g.id === guestId);
  if (guest && guest.invitacion_enviada !== true) {
    setSentStatus(guestId, true);
  }
  return waSendDesktop(url);
}

// ==========================================================================
// RENDERIZADO DE LA LISTA Y CONTADOR
// ==========================================================================
function render() {
  const list = document.getElementById("send-list");
  if (!list) return;

  // Estadísticas
  const total = allGuests.length;
  const sent = allGuests.filter(g => g.invitacion_enviada === true).length;
  document.getElementById("send-stat-total").innerText = total;
  document.getElementById("send-stat-sent").innerText = sent;
  document.getElementById("send-stat-pending").innerText = total - sent;

  // Filtros
  const searchVal = (document.getElementById("send-search-input").value || "").toLowerCase().trim();
  const filterVal = document.getElementById("send-filter").value;

  const visible = allGuests.filter(g => {
    const nameMatch = g.nombre_completo.toLowerCase().includes(searchVal);
    const isSent = g.invitacion_enviada === true;
    const hasPhone = g.telefono && String(g.telefono).trim() !== "";

    let filterMatch = true;
    if (filterVal === "pending") filterMatch = !isSent;
    else if (filterVal === "sent") filterMatch = isSent;
    else if (filterVal === "withphone") filterMatch = hasPhone;
    else if (filterVal === "nophone") filterMatch = !hasPhone;

    return nameMatch && filterMatch;
  });

  list.innerHTML = "";

  if (visible.length === 0) {
    list.innerHTML = `<div class="send-empty">No hay invitados que coincidan con la búsqueda.</div>`;
    return;
  }

  visible.forEach(g => {
    list.appendChild(buildCard(g));
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function buildCard(g) {
  const isSent = g.invitacion_enviada === true;
  const hasPhone = g.telefono && String(g.telefono).trim() !== "";

  // Estado / badge
  let badge;
  if (g.confirmado === true) {
    badge = `<span class="send-badge badge-yes"><i data-lucide="check"></i> Confirmado (${g.asistentes_confirmados}/${g.pases_totales})</span>`;
  } else if (g.confirmado === false) {
    badge = `<span class="send-badge badge-no"><i data-lucide="x"></i> No asistirá</span>`;
  } else {
    badge = `<span class="send-badge badge-wait"><i data-lucide="clock"></i> Pendiente</span>`;
  }

  // Mesa
  const mesa = g.numero_mesa && g.numero_mesa.trim() !== ""
    ? `<span class="meta-item"><i data-lucide="armchair"></i> ${g.numero_mesa}</span>`
    : `<span class="meta-item meta-muted"><i data-lucide="armchair"></i> Mesa por asignar</span>`;

  // Teléfono
  const tel = hasPhone
    ? `<span class="meta-item"><i data-lucide="phone"></i> ${g.telefono}</span>`
    : `<span class="meta-item meta-muted"><i data-lucide="phone-off"></i> Sin teléfono</span>`;

  const pases = `<span class="meta-item"><i data-lucide="ticket"></i> ${g.pases_totales} ${g.pases_totales === 1 ? 'pase' : 'pases'}</span>`;

  const whatsappUrl = buildWhatsappUrl(g);
  const sendLabel = hasPhone ? "Enviar invitación" : "Enviar (elegir contacto)";

  const card = document.createElement("div");
  card.className = "guest-card" + (isSent ? " is-sent" : "");

  card.innerHTML = `
    <div class="guest-card-top">
      <div class="guest-card-name">${g.nombre_completo}</div>
      <span class="guest-card-sentflag ${isSent ? '' : 'hidden'}"><i data-lucide="check-circle"></i> Enviado</span>
    </div>
    <div class="guest-card-meta">
      ${tel}
      ${mesa}
      ${pases}
      <span class="meta-item">${badge}</span>
    </div>
    <div class="guest-card-actions">
      <a href="${whatsappUrl}" onclick="return sendInvite('${g.id}', '${whatsappUrl}')" target="_blank" rel="noopener" class="btn-send-wa" title="${sendLabel}">
        <i data-lucide="send"></i> ${sendLabel}
      </a>
      <button type="button" class="btn-mark ${isSent ? 'active' : ''}" title="Marcar como enviado">
        <i data-lucide="${isSent ? 'check' : 'circle'}"></i>
      </button>
    </div>
  `;

  // Botón de marcar como enviado
  const markBtn = card.querySelector(".btn-mark");
  markBtn.addEventListener("click", () => toggleSent(g.id));

  // (El botón de WhatsApp usa onclick inline -> sendInvite, igual que el panel)

  return card;
}
