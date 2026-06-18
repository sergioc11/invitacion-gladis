/* ==========================================================================
   PIZARRA DE MESAS - 70 AÑOS DE MAMÁ GLADIS
   Distribución de invitados confirmados en mesas mediante arrastrar y soltar.
   ========================================================================== */

// 1. CONFIGURACIÓN DE CONEXIÓN (COMPARTIDA CON admin.js / app.js)
const SUPABASE_URL = "https://mvdolghwdhggpiggtxiy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JFLeojGNwTs-PpvCb8y3TQ_05GT-JjB";

// CLAVE DE ACCESO ADMINISTRATIVA (mismo hash que el panel: "Gladis70Admin")
const ADMIN_PASSWORD_HASH = "c672ea0fd92f81c3f6a572d67ef98f7792e71d1b5d9f94929bca56fbccf613aa";

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
    console.error("Error al conectar Supabase (pizarra):", e);
  }
}
const useDB = isSupabaseConfigured && supabaseClient;

// Claves de almacenamiento local para el modo sin conexión (pruebas)
const LS_MESAS = "pizarra_mesas";
const LS_ASIG = "pizarra_asignaciones";

// Datos de prueba locales (solo si NO hay Supabase configurado)
let localGuestsMock = [
  { id: "mock-1", nombre_completo: "Sergio Castellanos", numero_mesa: null, confirmado: true, asistentes_confirmados: 3 },
  { id: "mock-2", nombre_completo: "Familia Pérez", numero_mesa: null, confirmado: true, asistentes_confirmados: 7 },
  { id: "mock-3", nombre_completo: "Familia Estrada", numero_mesa: null, confirmado: true, asistentes_confirmados: 5 },
  { id: "mock-4", nombre_completo: "Gladis Elizabeth Ruano", numero_mesa: null, confirmado: true, asistentes_confirmados: 2 }
];

// 2. ESTADO
let guests = [];          // Invitados confirmados (asistirán)
let mesas = [];           // Mesas en el lienzo
let asignaciones = [];    // Relación invitado <-> mesa con cantidad
let guestSearchTerm = "";
let seatContext = null;   // { guestId, mesaId } para el modal de reparto

// Zoom del lienzo
const CANVAS_W = 2400;    // Ancho lógico del lienzo (coincide con el CSS)
const CANVAS_H = 1500;    // Alto lógico del lienzo
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2;
let zoom = 1;

// ==========================================================================
// LOGIN (mismo patrón que el panel administrativo)
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("admin-login-btn");
  const passInput = document.getElementById("admin-pass-input");

  if (loginBtn) loginBtn.addEventListener("click", verifyAdminAccess);
  if (passInput) {
    passInput.addEventListener("keydown", (e) => { if (e.key === "Enter") verifyAdminAccess(); });
  }

  if (sessionStorage.getItem("admin_logged_in") === "true") {
    unlockPizarra();
  }

  const search = document.getElementById("pizarra-guest-search");
  if (search) {
    search.addEventListener("input", (e) => {
      guestSearchTerm = e.target.value.toLowerCase().trim();
      renderSidebar();
    });
  }

  // Zoom con Ctrl + rueda del mouse, centrado en el cursor
  const viewport = document.getElementById("pizarra-viewport");
  if (viewport) {
    viewport.addEventListener("wheel", (e) => {
      if (!e.ctrlKey) return; // sin Ctrl, deja el scroll normal
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      // Punto del contenido (en coordenadas lógicas) bajo el cursor
      const contentX = (viewport.scrollLeft + cx) / zoom;
      const contentY = (viewport.scrollTop + cy) / zoom;
      const step = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom(zoom + step);
      // Reposicionar el scroll para que el punto bajo el cursor no se mueva
      viewport.scrollLeft = contentX * zoom - cx;
      viewport.scrollTop = contentY * zoom - cy;
    }, { passive: false });
  }

  applyZoom();

  if (typeof lucide !== 'undefined') lucide.createIcons();
});

// ==========================================================================
// ZOOM DEL LIENZO
// ==========================================================================
function applyZoom() {
  const canvas = document.getElementById("pizarra-canvas");
  const track = document.getElementById("pizarra-canvas-track");
  const pct = document.getElementById("pizarra-zoom-pct");
  if (canvas) canvas.style.transform = `scale(${zoom})`;
  // La pista define el área desplazable según el zoom
  if (track) {
    track.style.width = (CANVAS_W * zoom) + "px";
    track.style.height = (CANVAS_H * zoom) + "px";
  }
  if (pct) pct.textContent = Math.round(zoom * 100) + "%";
}

function setZoom(value) {
  zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
  applyZoom();
}

// Zoom desde los botones, centrado en el medio del lienzo visible
function zoomBy(delta) {
  const viewport = document.getElementById("pizarra-viewport");
  if (!viewport) { setZoom(zoom + delta); return; }
  const cx = viewport.clientWidth / 2;
  const cy = viewport.clientHeight / 2;
  const contentX = (viewport.scrollLeft + cx) / zoom;
  const contentY = (viewport.scrollTop + cy) / zoom;
  setZoom(zoom + delta);
  viewport.scrollLeft = contentX * zoom - cx;
  viewport.scrollTop = contentY * zoom - cy;
}

function resetZoom() {
  setZoom(1);
}

async function verifyAdminAccess() {
  const passInput = document.getElementById("admin-pass-input");
  const errorMsg = document.getElementById("admin-login-error");
  if (!passInput) return;

  const enteredHash = await sha256(passInput.value.trim());
  if (enteredHash === ADMIN_PASSWORD_HASH) {
    sessionStorage.setItem("admin_logged_in", "true");
    if (errorMsg) errorMsg.classList.add("hidden");
    unlockPizarra();
  } else {
    if (errorMsg) errorMsg.classList.remove("hidden");
    passInput.value = "";
    passInput.focus();
  }
}

function unlockPizarra() {
  document.getElementById("admin-lock-screen").classList.add("hidden");
  document.getElementById("pizarra-app").classList.remove("hidden");
  loadPizarra();
}

// ==========================================================================
// CARGA DE DATOS
// ==========================================================================
async function loadPizarra() {
  const loader = document.getElementById("pizarra-loader");
  const body = document.getElementById("pizarra-body");
  const badge = document.getElementById("pizarra-conn-badge");
  if (loader) loader.classList.remove("hidden");
  if (body) body.classList.add("hidden");

  try {
    if (useDB) {
      const [gRes, mRes, aRes] = await Promise.all([
        supabaseClient.from('invitados').select('id, nombre_completo, numero_mesa, asistentes_confirmados, confirmado').eq('confirmado', true).order('nombre_completo', { ascending: true }),
        supabaseClient.from('mesas').select('*').order('numero', { ascending: true }),
        supabaseClient.from('asignaciones').select('*')
      ]);
      if (gRes.error) throw gRes.error;
      if (mRes.error) throw mRes.error;
      if (aRes.error) throw aRes.error;
      guests = gRes.data || [];
      mesas = mRes.data || [];
      asignaciones = aRes.data || [];
      if (badge) { badge.textContent = "● Conectado"; badge.classList.add("online"); }
    } else {
      guests = localGuestsMock.filter(g => g.confirmado === true)
        .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
      mesas = JSON.parse(localStorage.getItem(LS_MESAS) || "[]");
      asignaciones = JSON.parse(localStorage.getItem(LS_ASIG) || "[]");
      if (badge) { badge.textContent = "● Modo local (sin conexión)"; badge.classList.add("offline"); }
    }

    renderAll();
  } catch (err) {
    console.error("Error al cargar la pizarra:", err);
    alert("No se pudieron cargar los datos. Si es la primera vez, asegúrate de haber ejecutado el script 'supabase-schema-mesas.sql' en Supabase.");
  } finally {
    if (loader) loader.classList.add("hidden");
    if (body) body.classList.remove("hidden");
  }
}

function saveLocal() {
  localStorage.setItem(LS_MESAS, JSON.stringify(mesas));
  localStorage.setItem(LS_ASIG, JSON.stringify(asignaciones));
}

// ==========================================================================
// HELPERS DE CÁLCULO
// ==========================================================================
function mesaLabel(mesa) {
  return (mesa.nombre && mesa.nombre.trim() !== "") ? mesa.nombre.trim() : `Mesa ${mesa.numero}`;
}
function mesaOccupied(mesaId) {
  return asignaciones.filter(a => a.mesa_id === mesaId).reduce((s, a) => s + (a.cantidad || 0), 0);
}
function guestSeated(guestId) {
  return asignaciones.filter(a => a.invitado_id === guestId).reduce((s, a) => s + (a.cantidad || 0), 0);
}
function guestTotal(guest) { return guest.asistentes_confirmados || 0; }
function guestRemaining(guest) { return guestTotal(guest) - guestSeated(guest.id); }
function findGuest(id) { return guests.find(g => g.id === id); }
function findMesa(id) { return mesas.find(m => m.id === id); }

// ==========================================================================
// RENDER PRINCIPAL
// ==========================================================================
function renderAll() {
  renderSidebar();
  renderCanvas();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- Lateral de invitados ---
function renderSidebar() {
  const list = document.getElementById("pizarra-guest-list");
  const pendingEl = document.getElementById("pizarra-pending-count");
  if (!list) return;

  const visible = guests.filter(g => g.nombre_completo.toLowerCase().includes(guestSearchTerm));
  const pendingFamilies = guests.filter(g => guestRemaining(g) > 0).length;
  if (pendingEl) pendingEl.textContent = `${pendingFamilies} por ubicar`;

  list.innerHTML = "";
  if (visible.length === 0) {
    list.innerHTML = `<p class="pizarra-empty-list">No hay invitados confirmados que coincidan.</p>`;
    return;
  }

  visible.forEach(g => {
    const seated = guestSeated(g.id);
    const total = guestTotal(g);
    const remaining = total - seated;
    const complete = remaining <= 0 && total > 0;

    const card = document.createElement("div");
    card.className = "pizarra-guest-card" + (complete ? " is-complete" : "");
    card.dataset.guestId = g.id;
    card.draggable = remaining > 0;

    card.innerHTML = `
      <div class="pgc-main">
        <span class="pgc-name">${escapeHtml(g.nombre_completo)}</span>
        <span class="pgc-count">${seated}/${total} sentados</span>
      </div>
      <span class="pgc-badge ${complete ? 'ok' : 'pending'}">
        ${complete ? '<i data-lucide="check"></i> Listo' : `Faltan ${remaining}`}
      </span>
    `;

    if (remaining > 0) {
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/guest", g.id);
        e.dataTransfer.effectAllowed = "move";
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
    }
    list.appendChild(card);
  });
}

// --- Lienzo de mesas ---
function renderCanvas() {
  const canvas = document.getElementById("pizarra-canvas");
  const empty = document.getElementById("pizarra-empty-canvas");
  if (!canvas) return;

  // Quitar mesas previas (conservando el mensaje de vacío)
  canvas.querySelectorAll(".pizarra-mesa").forEach(el => el.remove());

  if (empty) empty.style.display = mesas.length === 0 ? "block" : "none";

  mesas.forEach(mesa => {
    const occupied = mesaOccupied(mesa.id);
    const over = occupied > mesa.capacidad;
    const asigns = asignaciones.filter(a => a.mesa_id === mesa.id);

    const el = document.createElement("div");
    el.className = "pizarra-mesa" + (over ? " is-over" : "");
    el.style.left = (mesa.pos_x || 40) + "px";
    el.style.top = (mesa.pos_y || 40) + "px";
    el.dataset.mesaId = mesa.id;

    // Sillas alrededor (visual)
    let chairsHtml = "";
    const cap = Math.max(1, mesa.capacidad);
    for (let i = 0; i < cap; i++) {
      const angle = (i / cap) * 360;
      const filled = i < occupied ? "filled" : "";
      chairsHtml += `<span class="mesa-chair ${filled}" style="transform: rotate(${angle}deg) translate(0, -54px);"></span>`;
    }

    // Chips de familias sentadas
    let chipsHtml = "";
    if (asigns.length === 0) {
      chipsHtml = `<p class="mesa-empty-hint">Arrastra invitados aquí</p>`;
    } else {
      asigns.forEach(a => {
        const g = findGuest(a.invitado_id);
        const name = g ? g.nombre_completo : "(desconocido)";
        chipsHtml += `
          <div class="mesa-chip">
            <span class="mesa-chip-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
            <span class="mesa-chip-qty">${a.cantidad}</span>
            <button type="button" class="mesa-chip-x" title="Quitar de esta mesa" onclick="removeAsignacion('${a.id}')">&times;</button>
          </div>`;
      });
    }

    el.innerHTML = `
      <div class="mesa-head" data-drag-handle="1">
        <span class="mesa-title">${escapeHtml(mesaLabel(mesa))}</span>
        <span class="mesa-occ ${over ? 'over' : ''}">${occupied}/${mesa.capacidad}</span>
        <div class="mesa-tools">
          <button type="button" class="mesa-tool-btn" title="Editar mesa" onclick="openEditMesaModal('${mesa.id}')"><i data-lucide="pencil"></i></button>
          <button type="button" class="mesa-tool-btn" title="Eliminar mesa" onclick="deleteMesa('${mesa.id}')"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
      <div class="mesa-table">
        ${chairsHtml}
        <span class="mesa-table-num">${mesa.numero}</span>
      </div>
      <div class="mesa-chips">${chipsHtml}</div>
    `;

    // Soltar invitados sobre la mesa (HTML5 drag & drop)
    el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("drop-hover"); });
    el.addEventListener("dragleave", () => el.classList.remove("drop-hover"));
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      el.classList.remove("drop-hover");
      const guestId = e.dataTransfer.getData("text/guest");
      if (guestId) openSeatModal(guestId, mesa.id);
    });

    // Mover la mesa por el lienzo (pointer events sobre el encabezado)
    enableMesaDrag(el, mesa);

    canvas.appendChild(el);
  });
}

// Reposicionar una mesa arrastrando su encabezado
function enableMesaDrag(el, mesa) {
  const handle = el.querySelector(".mesa-head");
  if (!handle) return;

  handle.addEventListener("pointerdown", (e) => {
    // No iniciar arrastre si se hizo clic en un botón de herramientas
    if (e.target.closest(".mesa-tool-btn")) return;
    e.preventDefault();
    el.classList.add("moving");

    const startX = e.clientX, startY = e.clientY;
    const origX = mesa.pos_x || 40, origY = mesa.pos_y || 40;

    function onMove(ev) {
      // Dividir el desplazamiento entre el zoom para que la mesa siga al cursor
      let nx = origX + (ev.clientX - startX) / zoom;
      let ny = origY + (ev.clientY - startY) / zoom;
      // Mantener dentro del lienzo (coordenadas lógicas)
      nx = Math.max(0, Math.min(nx, CANVAS_W - el.offsetWidth));
      ny = Math.max(0, Math.min(ny, CANVAS_H - el.offsetHeight));
      el.style.left = nx + "px";
      el.style.top = ny + "px";
      mesa.pos_x = nx;
      mesa.pos_y = ny;
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      el.classList.remove("moving");
      persistMesaPosition(mesa);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  });
}

async function persistMesaPosition(mesa) {
  try {
    if (useDB) {
      const { error } = await supabaseClient.from('mesas')
        .update({ pos_x: Math.round(mesa.pos_x), pos_y: Math.round(mesa.pos_y) })
        .eq('id', mesa.id);
      if (error) throw error;
    } else {
      saveLocal();
    }
  } catch (err) {
    console.error("Error al guardar la posición de la mesa:", err);
  }
}

// ==========================================================================
// MODAL: AGREGAR / EDITAR MESA
// ==========================================================================
function openAddMesaModal() {
  document.getElementById("mesa-modal-title").innerText = "Agregar Mesa";
  document.getElementById("mesa-modal-id").value = "";
  const nextNum = mesas.length ? Math.max(...mesas.map(m => m.numero)) + 1 : 1;
  document.getElementById("mesa-modal-numero").value = nextNum;
  document.getElementById("mesa-modal-capacidad").value = 10;
  document.getElementById("mesa-modal-nombre").value = "";
  document.getElementById("mesa-modal").classList.add("active");
}

function openEditMesaModal(mesaId) {
  const mesa = findMesa(mesaId);
  if (!mesa) return;
  document.getElementById("mesa-modal-title").innerText = "Editar Mesa";
  document.getElementById("mesa-modal-id").value = mesa.id;
  document.getElementById("mesa-modal-numero").value = mesa.numero;
  document.getElementById("mesa-modal-capacidad").value = mesa.capacidad;
  document.getElementById("mesa-modal-nombre").value = mesa.nombre || "";
  document.getElementById("mesa-modal").classList.add("active");
}

function closeMesaModal() {
  document.getElementById("mesa-modal").classList.remove("active");
}

async function saveMesa(event) {
  event.preventDefault();
  const id = document.getElementById("mesa-modal-id").value;
  const numero = parseInt(document.getElementById("mesa-modal-numero").value, 10);
  const capacidad = parseInt(document.getElementById("mesa-modal-capacidad").value, 10);
  const nombre = document.getElementById("mesa-modal-nombre").value.trim();

  if (isNaN(numero) || numero < 1 || isNaN(capacidad) || capacidad < 1) {
    alert("Revisa el número de mesa y la cantidad de sillas.");
    return;
  }
  // Evitar números de mesa duplicados
  if (mesas.some(m => m.numero === numero && m.id !== id)) {
    alert(`Ya existe una mesa con el número ${numero}.`);
    return;
  }
  // Al reducir la capacidad, no permitir que queden personas de más
  if (id) {
    const occ = mesaOccupied(id);
    if (capacidad < occ) {
      alert(`Esta mesa ya tiene ${occ} personas sentadas. No puedes dejar la capacidad por debajo de ese número.`);
      return;
    }
  }

  try {
    if (id) {
      // Editar
      const payload = { numero, capacidad, nombre: nombre || null };
      if (useDB) {
        const { error } = await supabaseClient.from('mesas').update(payload).eq('id', id);
        if (error) throw error;
      }
      const mesa = findMesa(id);
      Object.assign(mesa, payload);
      // El nombre/número visible cambió → actualizar el texto de los invitados de esta mesa
      const affected = [...new Set(asignaciones.filter(a => a.mesa_id === id).map(a => a.invitado_id))];
      for (const gId of affected) await recomputeNumeroMesa(gId);
    } else {
      // Crear (posición escalonada para que no se encimen)
      const offset = mesas.length * 30;
      const newMesa = {
        numero, capacidad, nombre: nombre || null,
        pos_x: 40 + (offset % 360), pos_y: 40 + (offset % 240)
      };
      if (useDB) {
        const { data, error } = await supabaseClient.from('mesas').insert([newMesa]).select();
        if (error) throw error;
        mesas.push(data[0]);
      } else {
        newMesa.id = (crypto.randomUUID ? crypto.randomUUID() : "m-" + Date.now());
        mesas.push(newMesa);
      }
    }
    if (!useDB) saveLocal();
    mesas.sort((a, b) => a.numero - b.numero);
    closeMesaModal();
    renderAll();
  } catch (err) {
    console.error("Error al guardar la mesa:", err);
    alert("No se pudo guardar la mesa. Revisa la consola.");
  }
}

async function deleteMesa(mesaId) {
  const mesa = findMesa(mesaId);
  if (!mesa) return;
  const occ = mesaOccupied(mesaId);
  const msg = occ > 0
    ? `La ${mesaLabel(mesa)} tiene ${occ} personas asignadas. Si la eliminas, esas familias volverán al lateral para reubicarse. ¿Continuar?`
    : `¿Eliminar la ${mesaLabel(mesa)}?`;
  if (!confirm(msg)) return;

  const affected = [...new Set(asignaciones.filter(a => a.mesa_id === mesaId).map(a => a.invitado_id))];

  try {
    if (useDB) {
      // ON DELETE CASCADE borra también las asignaciones de esta mesa
      const { error } = await supabaseClient.from('mesas').delete().eq('id', mesaId);
      if (error) throw error;
    }
    mesas = mesas.filter(m => m.id !== mesaId);
    asignaciones = asignaciones.filter(a => a.mesa_id !== mesaId);
    if (!useDB) saveLocal();
    for (const gId of affected) await recomputeNumeroMesa(gId);
    renderAll();
  } catch (err) {
    console.error("Error al eliminar la mesa:", err);
    alert("No se pudo eliminar la mesa. Revisa la consola.");
  }
}

// ==========================================================================
// MODAL: SENTAR (reparto de familia en una mesa)
// ==========================================================================
function openSeatModal(guestId, mesaId) {
  const g = findGuest(guestId);
  const mesa = findMesa(mesaId);
  if (!g || !mesa) return;

  const remaining = guestRemaining(g);
  const free = mesa.capacidad - mesaOccupied(mesaId);

  if (remaining <= 0) { alert(`${g.nombre_completo} ya está completamente ubicado.`); return; }
  if (free <= 0) { alert(`La ${mesaLabel(mesa)} ya está llena.`); return; }

  const maxQty = Math.min(remaining, free);
  seatContext = { guestId, mesaId, maxQty };

  document.getElementById("seat-guest-name").innerText = g.nombre_completo;
  document.getElementById("seat-mesa-name").innerText = mesaLabel(mesa);
  document.getElementById("seat-remaining").innerText = `${remaining} persona(s)`;
  document.getElementById("seat-free").innerText = `${free} lugar(es)`;

  const qtyInput = document.getElementById("seat-qty");
  qtyInput.max = maxQty;
  qtyInput.value = maxQty;
  document.getElementById("seat-modal").classList.add("active");
  qtyInput.focus();
}

function closeSeatModal() {
  document.getElementById("seat-modal").classList.remove("active");
  seatContext = null;
}

async function confirmSeat() {
  if (!seatContext) return;
  let qty = parseInt(document.getElementById("seat-qty").value, 10);
  if (isNaN(qty) || qty < 1) { alert("Indica al menos 1 persona."); return; }
  if (qty > seatContext.maxQty) {
    alert(`Máximo ${seatContext.maxQty} persona(s) para esta combinación.`);
    return;
  }

  const { guestId, mesaId } = seatContext;
  try {
    const existing = asignaciones.find(a => a.invitado_id === guestId && a.mesa_id === mesaId);
    if (existing) {
      const newQty = existing.cantidad + qty;
      if (useDB) {
        const { error } = await supabaseClient.from('asignaciones').update({ cantidad: newQty }).eq('id', existing.id);
        if (error) throw error;
      }
      existing.cantidad = newQty;
    } else {
      const row = { invitado_id: guestId, mesa_id: mesaId, cantidad: qty };
      if (useDB) {
        const { data, error } = await supabaseClient.from('asignaciones').insert([row]).select();
        if (error) throw error;
        asignaciones.push(data[0]);
      } else {
        row.id = (crypto.randomUUID ? crypto.randomUUID() : "a-" + Date.now());
        asignaciones.push(row);
      }
    }
    if (!useDB) saveLocal();
    await recomputeNumeroMesa(guestId);
    closeSeatModal();
    renderAll();
  } catch (err) {
    console.error("Error al sentar al invitado:", err);
    alert("No se pudo guardar la asignación. Revisa la consola.");
  }
}

async function removeAsignacion(asigId) {
  const asig = asignaciones.find(a => a.id === asigId);
  if (!asig) return;
  const guestId = asig.invitado_id;
  try {
    if (useDB) {
      const { error } = await supabaseClient.from('asignaciones').delete().eq('id', asigId);
      if (error) throw error;
    }
    asignaciones = asignaciones.filter(a => a.id !== asigId);
    if (!useDB) saveLocal();
    await recomputeNumeroMesa(guestId);
    renderAll();
  } catch (err) {
    console.error("Error al quitar la asignación:", err);
    alert("No se pudo quitar la asignación. Revisa la consola.");
  }
}

// ==========================================================================
// ESTANDARIZACIÓN DEL TEXTO QUE VE EL INVITADO (campo numero_mesa)
// Una sola mesa  -> "Mesa 1" (o el nombre).
// Repartida      -> "Mesa 1 (3 personas) y Mesa 2 (2 personas)".
// ==========================================================================
function buildNumeroMesaText(guestId) {
  const rows = asignaciones
    .filter(a => a.invitado_id === guestId)
    .map(a => ({ mesa: findMesa(a.mesa_id), cantidad: a.cantidad }))
    .filter(r => r.mesa)
    .sort((a, b) => a.mesa.numero - b.mesa.numero);

  if (rows.length === 0) return null;
  if (rows.length === 1) return mesaLabel(rows[0].mesa);
  return rows.map(r => `${mesaLabel(r.mesa)} (${r.cantidad} persona${r.cantidad === 1 ? '' : 's'})`).join(" y ");
}

async function recomputeNumeroMesa(guestId) {
  const text = buildNumeroMesaText(guestId);
  const g = findGuest(guestId);
  if (g) g.numero_mesa = text;
  try {
    if (useDB) {
      const { error } = await supabaseClient.from('invitados').update({ numero_mesa: text }).eq('id', guestId);
      if (error) throw error;
    } else {
      const m = localGuestsMock.find(x => x.id === guestId);
      if (m) m.numero_mesa = text;
    }
  } catch (err) {
    console.error("Error al actualizar el texto de mesa del invitado:", err);
  }
}

// ==========================================================================
// UTILIDADES
// ==========================================================================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
