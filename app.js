/* ==========================================================================
   LÓGICA DE LA INVITACIÓN Y RSVP - 70 AÑOS DE DOÑA GLADIS
   ========================================================================== */

// 1. CONFIGURACIÓN DE SUPABASE
// --------------------------------------------------------------------------
const SUPABASE_URL = "https://mvdolghwdhggpiggtxiy.supabase.co";
// NOTA PARA EL USUARIO: Reemplaza la cadena de texto de abajo con tu "Anon Key" pública de Supabase
const SUPABASE_ANON_KEY = "sb_publishable_JFLeojGNwTs-PpvCb8y3TQ_05GT-JjB"; 

const isSupabaseConfigured = SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== "PONER_AQUI_TU_ANON_KEY";
let supabaseClient = null;

// Evitar shadowing del objeto global de Supabase si se cargó la CDN
if (isSupabaseConfigured) {
  try {
    if (typeof supabase !== 'undefined') {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("Supabase conectado correctamente.");
    } else {
      console.warn("La librería de Supabase no se ha cargado. Usando modo simulador.");
    }
  } catch (e) {
    console.error("Error al inicializar cliente Supabase:", e);
  }
} else {
  console.log("Ejecutando en Modo Simulador (Datos de prueba locales). Modifica la clave en app.js para conectar con tu Supabase real.");
}

// 2. BASE DE DATOS LOCAL SIMULADA (FALLBACK)
// --------------------------------------------------------------------------
// Estos datos se usarán si no has configurado tu clave de Supabase aún.
let localMockInvitados = [
  { id: "mock-1", nombre_completo: "Sergio Castellanos", codigo_acceso: "1234", numero_mesa: "Mesa 1", pases_totales: 3, confirmado: null, asistentes_confirmados: 0, comentarios: "" },
  { id: "mock-2", nombre_completo: "María de los Ángeles Estrada", codigo_acceso: "5678", numero_mesa: null, pases_totales: 2, confirmado: null, asistentes_confirmados: 0, comentarios: "" },
  { id: "mock-3", nombre_completo: "Juan Carlos Pérez", codigo_acceso: "4321", numero_mesa: "Mesa 3", pases_totales: 4, confirmado: null, asistentes_confirmados: 0, comentarios: "" },
  { id: "mock-4", nombre_completo: "Gladis Elizabeth Ruano Estrada", codigo_acceso: "7070", numero_mesa: "Mesa de Honor", pases_totales: 1, confirmado: null, asistentes_confirmados: 0, comentarios: "" },
  { id: "mock-5", nombre_completo: "Familiar Ruano", codigo_acceso: "9999", numero_mesa: null, pases_totales: 5, confirmado: null, asistentes_confirmados: 0, comentarios: "" }
];

// Variables de Estado Global
let selectedGuest = null;
let searchTimeout = null;
let currentImageIndex = 0;
const galleryImages = [];

// ==========================================================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA (CON CAPTURA DE ERRORES INDEPENDIENTES)
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  // 1. Activar clase de Javascript en el body para iniciar animaciones
  try {
    document.body.classList.add("js-active");
  } catch (e) {
    console.error("Error al añadir js-active class:", e);
  }

  // 1.5. Configurar Portada de Apertura (Sobre / Wax Seal)
  try {
    const sealBtn = document.getElementById("wax-seal-btn");
    const envelopeCover = document.getElementById("envelope-cover");
    const bgMusic = document.getElementById("bg-music");
    const musicBtn = document.getElementById("music-control-btn");

    if (sealBtn && envelopeCover) {
      // Bloquear scroll al cargar la página
      document.body.classList.add("no-scroll");

      sealBtn.addEventListener("click", () => {
        // Deslizar el sobre hacia arriba y desvanecer
        envelopeCover.classList.add("opened");
        
        // Habilitar scroll en la invitación
        document.body.classList.remove("no-scroll");

        // Reproducir música (permitido por los navegadores tras un click del usuario)
        if (bgMusic) {
          bgMusic.play().then(() => {
            if (musicBtn) {
              const iconPlaying = musicBtn.querySelector(".icon-playing");
              const iconPaused = musicBtn.querySelector(".icon-paused");
              if (iconPlaying && iconPaused) {
                iconPlaying.classList.remove("hidden");
                iconPaused.classList.add("hidden");
              }
            }
          }).catch(err => {
            console.log("El navegador bloqueó la auto-reproducción de música:", err);
          });
        }

        // Eliminar el elemento del DOM al terminar la transición
        setTimeout(() => {
          envelopeCover.style.display = "none";
        }, 1200); // 1.2 segundos (coincide con la transición CSS)
      });
    } else {
      document.body.classList.remove("no-scroll");
    }
  } catch (e) {
    console.error("Error en configuración de apertura de sobre:", e);
    document.body.classList.remove("no-scroll");
  }

  // 2. Cargar Iconos de Lucide
  try {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    } else {
      console.warn("Lucide CDN no disponible. Se usarán fallbacks de texto.");
    }
  } catch (e) {
    console.error("Error al inicializar Lucide:", e);
  }
  
  // 3. Iniciar Cuenta Regresiva
  try {
    initCountdown();
  } catch (e) {
    console.error("Error en cuenta regresiva:", e);
  }
  
  // 4. Configurar Animaciones al hacer Scroll
  try {
    initScrollAnimations();
  } catch (e) {
    console.error("Error en animaciones de scroll:", e);
    // Fallback: mostrar todo si falla el IntersectionObserver
    document.querySelectorAll(".animate-on-scroll").forEach(el => el.classList.add("appear"));
  }
  
  // 5. Configurar Galería (Lightbox y Navegación)
  try {
    initGallery();
  } catch (e) {
    console.error("Error al inicializar la galería:", e);
  }
  
  // 6. Configurar Buscador RSVP
  try {
    initRSVPSearch();
    checkRSVPDeadlineOnLoad();
    initAutoLogin();
  } catch (e) {
    console.error("Error al inicializar buscador RSVP:", e);
  }
  
  // 7. Configurar Control de Música
  try {
    initMusicControl();
  } catch (e) {
    console.error("Error al inicializar control de música:", e);
  }
});

// ==========================================================================
// CONTROL DE MÚSICA DE FONDO
// ==========================================================================
function initMusicControl() {
  const musicBtn = document.getElementById("music-control-btn");
  const bgMusic = document.getElementById("bg-music");
  
  if (!musicBtn || !bgMusic) return;

  // Ajustar volumen inicial bajo para que no sature
  bgMusic.volume = 0.35;

  musicBtn.addEventListener("click", () => {
    const iconPlaying = musicBtn.querySelector(".icon-playing");
    const iconPaused = musicBtn.querySelector(".icon-paused");

    if (bgMusic.paused) {
      bgMusic.play().then(() => {
        iconPlaying.classList.remove("hidden");
        iconPaused.classList.add("hidden");
      }).catch(err => {
        console.log("El navegador bloqueó la reproducción automática: ", err);
      });
    } else {
      bgMusic.pause();
      iconPlaying.classList.add("hidden");
      iconPaused.classList.remove("hidden");
    }
  });

  // Tocar automáticamente tras la primera interacción del usuario en la pantalla si está permitido
  document.body.addEventListener("click", () => {
    if (bgMusic.paused && !bgMusic.hasAttribute("data-manual-stop")) {
      bgMusic.play().then(() => {
        const iconPlaying = musicBtn.querySelector(".icon-playing");
        const iconPaused = musicBtn.querySelector(".icon-paused");
        iconPlaying.classList.remove("hidden");
        iconPaused.classList.add("hidden");
      }).catch(() => {
        // Silencioso
      });
    }
  }, { once: true });
}

// ==========================================================================
// CUENTA REGRESIVA (TARGET: 20 DE JUNIO DE 2026, 18:00:00)
// ==========================================================================
function initCountdown() {
  const targetDate = new Date("2026-06-20T18:00:00").getTime();
  
  const timer = setInterval(() => {
    const now = new Date().getTime();
    const distance = targetDate - now;
    
    // Si la fecha ya pasó
    if (distance < 0) {
      clearInterval(timer);
      document.getElementById("days").innerText = "00";
      document.getElementById("hours").innerText = "00";
      document.getElementById("minutes").innerText = "00";
      document.getElementById("seconds").innerText = "00";
      return;
    }
    
    // Cálculos de tiempo
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    
    // Insertar en HTML (con ceros a la izquierda)
    document.getElementById("days").innerText = String(days).padStart(2, '0');
    document.getElementById("hours").innerText = String(hours).padStart(2, '0');
    document.getElementById("minutes").innerText = String(minutes).padStart(2, '0');
    document.getElementById("seconds").innerText = String(seconds).padStart(2, '0');
  }, 1000);
}

// ==========================================================================
// SCROLL SUAVE Y ANIMACIONES EN PANTALLA
// ==========================================================================
function scrollToSection(selector) {
  const element = document.querySelector(selector);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
}

function initScrollAnimations() {
  const animatedElements = document.querySelectorAll(".animate-on-scroll");
  
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("appear");
          observer.unobserve(entry.target); // Dejar de observar una vez animado
        }
      });
    }, {
      threshold: 0.1, // Disminuido para asegurar que se dispare en pantallas pequeñas
      rootMargin: "0px 0px -20px 0px"
    });
    
    animatedElements.forEach(el => observer.observe(el));
  } else {
    // Fallback si no soporta Intersection Observer
    animatedElements.forEach(el => el.classList.add("appear"));
  }
}

// ==========================================================================
// GALERÍA Y LIGHTBOX MODAL
// ==========================================================================
// ABRIR/CERRAR Y NAVEGAR EN LIGHTBOX DESDE EL CARRUSEL
function openLightboxFromCarousel(index) {
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  if (!lightbox || !lightboxImg) return;
  
  currentImageIndex = index;
  lightboxImg.src = galleryImages[currentImageIndex];
  lightbox.style.display = "flex";
  document.body.style.overflow = "hidden"; // Desactivar scroll fondo
}

function closeLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (lightbox) {
    lightbox.style.display = "none";
    document.body.style.overflow = "auto"; // Activar scroll fondo
  }
}

function nextImage() {
  const lightboxImg = document.getElementById("lightbox-img");
  if (lightboxImg && galleryImages.length > 0) {
    currentImageIndex = (currentImageIndex + 1) % galleryImages.length;
    lightboxImg.src = galleryImages[currentImageIndex];
  }
}

function prevImage() {
  const lightboxImg = document.getElementById("lightbox-img");
  if (lightboxImg && galleryImages.length > 0) {
    currentImageIndex = (currentImageIndex - 1 + galleryImages.length) % galleryImages.length;
    lightboxImg.src = galleryImages[currentImageIndex];
  }
}

function initGallery() {
  const slides = document.querySelectorAll(".carousel-slide");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const closeBtn = document.getElementById("lightbox-close");
  const prevBtn = document.getElementById("lightbox-prev");
  const nextBtn = document.getElementById("lightbox-next");
  
  if (!lightbox || !lightboxImg) return;
  
  // Guardar rutas de imágenes para el Lightbox
  slides.forEach((slide) => {
    const img = slide.querySelector("img");
    if (img) {
      galleryImages.push(img.src);
    }
  });

  // Eventos de botones
  closeBtn.addEventListener("click", closeLightbox);
  nextBtn.addEventListener("click", nextImage);
  prevBtn.addEventListener("click", prevImage);

  // Cerrar al hacer clic fuera de la foto
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });

  // Navegación con teclado
  document.addEventListener("keydown", (e) => {
    if (lightbox.style.display === "flex") {
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "Escape") closeLightbox();
    }
  });

  // --- Lógica de Navegación del Carrusel ---
  const track = document.getElementById("carousel-track");
  const btnNext = document.getElementById("carousel-next");
  const btnPrev = document.getElementById("carousel-prev");
  const dotsContainer = document.getElementById("carousel-dots");
  
  if (!track || !btnNext || !btnPrev || !dotsContainer) return;
  
  let currentSlide = 0;
  const totalSlides = slides.length;
  
  // Crear puntos indicadores (dots)
  for (let i = 0; i < totalSlides; i++) {
    const dot = document.createElement("div");
    dot.className = `carousel-dot ${i === 0 ? 'active' : ''}`;
    dot.addEventListener("click", () => {
      goToSlide(i);
      resetAutoPlay();
    });
    dotsContainer.appendChild(dot);
  }
  
  const dots = document.querySelectorAll(".carousel-dot");
  
  function goToSlide(index) {
    if (index < 0) index = totalSlides - 1;
    if (index >= totalSlides) index = 0;
    
    currentSlide = index;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    
    // Actualizar clase activa de los puntos
    dots.forEach((dot, idx) => {
      if (idx === currentSlide) {
        dot.classList.add("active");
      } else {
        dot.classList.remove("active");
      }
    });
  }
  
  // Botones Siguiente / Anterior
  btnNext.addEventListener("click", () => {
    goToSlide(currentSlide + 1);
    resetAutoPlay();
  });
  
  btnPrev.addEventListener("click", () => {
    goToSlide(currentSlide - 1);
    resetAutoPlay();
  });
  
  // Auto-play cada 4 segundos
  let autoPlayInterval = setInterval(() => {
    goToSlide(currentSlide + 1);
  }, 4000);
  
  function resetAutoPlay() {
    clearInterval(autoPlayInterval);
    autoPlayInterval = setInterval(() => {
      goToSlide(currentSlide + 1);
    }, 4500); // Retardo extra tras interacción manual
  }
  
  // Soporte de gestos táctiles (Swipe) para teléfonos móviles
  let touchStartX = 0;
  let touchEndX = 0;
  
  track.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  
  track.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });
  
  function handleSwipe() {
    const swipeThreshold = 50;
    if (touchStartX - touchEndX > swipeThreshold) {
      // Deslizar a la izquierda -> Siguiente
      goToSlide(currentSlide + 1);
      resetAutoPlay();
    } else if (touchEndX - touchStartX > swipeThreshold) {
      // Deslizar a la derecha -> Anterior
      goToSlide(currentSlide - 1);
      resetAutoPlay();
    }
  }
}

// ==========================================================================
// SECCIÓN RSVP: BUSCADOR Y AUTOCOMPLETADO
// ==========================================================================
function initRSVPSearch() {
  const searchInput = document.getElementById("rsvp-search-input");
  const suggestionsList = document.getElementById("rsvp-suggestions-list");
  const clearBtn = document.getElementById("rsvp-clear-btn");
  const loader = document.getElementById("rsvp-loader");
  
  if (!searchInput || !suggestionsList || !clearBtn || !loader) return;

  // Escuchar escritura con de-bounce
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.trim();
    
    // Limpiar temporizador anterior
    clearTimeout(searchTimeout);
    
    if (query.length === 0) {
      clearSearch();
      return;
    }
    
    clearBtn.classList.remove("hidden");
    
    // Esperar 300ms a que el usuario pare de escribir
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);
  });

  // Limpiar búsqueda
  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearSearch();
    searchInput.focus();
  });

  // Cerrar lista al hacer clic fuera del buscador
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-container")) {
      suggestionsList.classList.add("hidden");
    }
  });

  // Enfocar buscador al hacer clic si ya tiene texto
  searchInput.addEventListener("focus", () => {
    if (searchInput.value.trim().length > 0 && suggestionsList.children.length > 0) {
      suggestionsList.classList.remove("hidden");
    }
  });

  // Configurar botones de verificación de PIN
  const verifyPinBtn = document.getElementById("rsvp-verify-pin-btn");
  if (verifyPinBtn) {
    verifyPinBtn.addEventListener("click", verifyRSVPPin);
  }
  
  const pinInput = document.getElementById("rsvp-pin-input");
  if (pinInput) {
    pinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        verifyRSVPPin();
      }
    });
  }
}

function clearSearch() {
  const suggestionsList = document.getElementById("rsvp-suggestions-list");
  const clearBtn = document.getElementById("rsvp-clear-btn");
  const loader = document.getElementById("rsvp-loader");
  
  if (suggestionsList) suggestionsList.classList.add("hidden");
  if (clearBtn) clearBtn.classList.add("hidden");
  if (loader) loader.classList.add("hidden");
}

// REALIZAR LA BÚSQUEDA (CON SUPABASE O MOCK)
async function performSearch(query) {
  const suggestionsList = document.getElementById("rsvp-suggestions-list");
  const loader = document.getElementById("rsvp-loader");
  
  suggestionsList.classList.add("hidden");
  loader.classList.remove("hidden");
  
  let results = [];
  
  try {
    if (isSupabaseConfigured && supabaseClient) {
      // Búsqueda de nombres: solo seleccionamos id y nombre_completo por seguridad y privacidad
      const { data, error } = await supabaseClient
        .from('invitados')
        .select('id, nombre_completo')
        .ilike('nombre_completo', `%${query}%`)
        .limit(8);
        
      if (error) throw error;
      results = data || [];
    } else {
      // Simulación local (filtrando y mapeando solo id y nombre_completo)
      const searchTerms = query.toLowerCase().split(" ");
      results = localMockInvitados
        .filter(inv => {
          const fullName = inv.nombre_completo.toLowerCase();
          return searchTerms.every(term => fullName.includes(term));
        })
        .map(inv => ({ id: inv.id, nombre_completo: inv.nombre_completo }));
    }
  } catch (error) {
    console.error("Error al buscar invitados: ", error);
  } finally {
    loader.classList.add("hidden");
    displaySuggestions(results, query);
  }
}

// MOSTRAR SUGERENCIAS EN LA LISTA DESPLEGABLE
function displaySuggestions(results, query) {
  const suggestionsList = document.getElementById("rsvp-suggestions-list");
  if (!suggestionsList) return;
  
  suggestionsList.innerHTML = "";
  
  if (results.length === 0) {
    const li = document.createElement("li");
    li.className = "no-results";
    li.innerHTML = `No encontramos a "<strong>${query}</strong>" en la lista. Por favor, revisa la ortografía o intenta solo con tu apellido.`;
    suggestionsList.appendChild(li);
    suggestionsList.classList.remove("hidden");
    return;
  }
  
  results.forEach(guest => {
    const li = document.createElement("li");
    
    // Resaltar coincidencia sutilmente
    const regex = new RegExp(`(${query})`, 'gi');
    const highlightedName = guest.nombre_completo.replace(regex, "<strong>$1</strong>");
    
    li.innerHTML = `<i data-lucide="user" style="width:16px; color:#C5A880;"></i> <span>${highlightedName}</span>`;
    
    // Al hacer clic en un invitado
    li.addEventListener("click", () => {
      selectGuest(guest);
    });
    
    suggestionsList.appendChild(li);
  });
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons(); // Recargar iconos agregados dinámicamente
  }
  suggestionsList.classList.remove("hidden");
}

// SELECCIONAR UN INVITADO DE LAS SUGERENCIAS (MUESTRA LA VERIFICACIÓN DE PIN)
function selectGuest(guest) {
  selectedGuest = guest;
  clearSearch();
  
  // Rellenar buscador con el nombre seleccionado
  document.getElementById("rsvp-search-input").value = guest.nombre_completo;
  
  // Limpiar y resetear campos
  const pinInput = document.getElementById("rsvp-pin-input");
  const pinError = document.getElementById("rsvp-pin-error");
  const pinContainer = document.getElementById("rsvp-pin-container");
  const detailsForm = document.getElementById("rsvp-details-form");
  const successMsg = document.getElementById("rsvp-success-message");
  
  if (pinInput) pinInput.value = "";
  if (pinError) pinError.classList.add("hidden");
  if (successMsg) successMsg.classList.add("hidden");
  if (detailsForm) detailsForm.classList.add("hidden");
  
  // Mostrar pantalla de validación de PIN para privacidad
  if (pinContainer) {
    pinContainer.classList.remove("hidden");
    setTimeout(() => {
      pinContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (pinInput) pinInput.focus();
    }, 100);
  }
}

// VERIFICAR EL PIN INGRESADO PARA DESBLOQUEAR LOS DETALLES
async function verifyRSVPPin() {
  if (!selectedGuest) return;
  
  const pinInput = document.getElementById("rsvp-pin-input");
  const pinError = document.getElementById("rsvp-pin-error");
  const verifyBtn = document.getElementById("rsvp-verify-pin-btn");
  
  if (!pinInput || !verifyBtn) return;
  
  const pinVal = pinInput.value.trim();
  
  if (pinVal.length !== 4) {
    if (pinError) {
      pinError.innerHTML = `<i data-lucide="alert-triangle"></i> El código debe ser de 4 dígitos.`;
      pinError.classList.remove("hidden");
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    return;
  }
  
  // Deshabilitar botón y mostrar carga
  const originalBtnText = verifyBtn.innerHTML;
  verifyBtn.disabled = true;
  verifyBtn.innerHTML = `<div class="spinner" style="width:14px; height:14px; border-width:2px;"></div>`;
  if (pinError) pinError.classList.add("hidden");
  
  let verifiedGuest = null;
  
  try {
    if (isSupabaseConfigured && supabaseClient) {
      // Realizar consulta segura en Supabase filtrando por ID y PIN
      const { data, error } = await supabaseClient
        .from('invitados')
        .select('*')
        .eq('id', selectedGuest.id)
        .eq('codigo_acceso', pinVal)
        .maybeSingle();
        
      if (error) throw error;
      verifiedGuest = data;
    } else {
      // Validación en la simulación local
      const match = localMockInvitados.find(inv => inv.id === selectedGuest.id && inv.codigo_acceso === pinVal);
      verifiedGuest = match ? { ...match } : null;
    }
    
    if (verifiedGuest) {
      // Éxito: Guardar los datos completos del invitado verificado
      selectedGuest = verifiedGuest;
      
      // Guardar en localStorage para persistencia de sesión
      try {
        localStorage.setItem("rsvp_guest_id", selectedGuest.id);
        localStorage.setItem("rsvp_guest_pin", pinVal);
      } catch (e) {
        console.warn("No se pudo guardar la sesión en localStorage:", e);
      }
      
      // Ocultar sección de PIN
      const pinContainer = document.getElementById("rsvp-pin-container");
      if (pinContainer) pinContainer.classList.add("hidden");
      
      // Desbloquear y mostrar el formulario con los detalles reales del invitado
      unlockRSVPDetails(selectedGuest);
    } else {
      // Error: Código incorrecto
      if (pinError) {
        pinError.innerHTML = `<i data-lucide="alert-triangle"></i> Código de confirmación incorrecto. Inténtalo de nuevo.`;
        pinError.classList.remove("hidden");
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
      pinInput.value = "";
      pinInput.focus();
    }
  } catch (error) {
    console.error("Error al verificar código de acceso:", error);
    alert("Ocurrió un error al verificar tu código. Por favor intenta nuevamente.");
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.innerHTML = originalBtnText;
  }
}

// DESBLOQUEAR Y REVELAR EL FORMULARIO RSVP CON DATOS REALES
function unlockRSVPDetails(guest, shouldScroll = true) {
  const detailsForm = document.getElementById("rsvp-details-form");
  const form = document.getElementById("rsvp-form");
  
  if (!detailsForm || !form) return;

  // Ocultar buscador de RSVP
  document.querySelector(".search-container").classList.add("hidden");
  document.querySelector(".rsvp-instructions").classList.add("hidden");
  const deadlineNotice = document.querySelector(".rsvp-deadline-notice");
  if (deadlineNotice) deadlineNotice.classList.add("hidden");
  
  // Rellenar campos en la UI
  document.getElementById("guest-name-val").innerText = guest.nombre_completo;
  document.getElementById("guest-passes-val").innerText = guest.pases_totales === 1 ? '1 pase' : `${guest.pases_totales} pases`;
  
  // ASIGNACIÓN DE MESA DINÁMICA: Si tiene mesa asignada la muestra, si no indica que está por definirse
  const tableValEl = document.getElementById("guest-table-val");
  if (guest.numero_mesa && guest.numero_mesa.trim() !== "") {
    tableValEl.innerHTML = `Mesa <strong>${guest.numero_mesa}</strong>`;
  } else {
    tableValEl.innerHTML = `<span style="color:var(--color-text-muted); font-style:italic;">Por asignarse (Te notificaremos pronto)</span>`;
  }
  
  // Verificar si la fecha límite ya expiró (Domingo 14 de Junio de 2026, 23:59:59)
  const now = new Date();
  const deadline = new Date("2026-06-15T00:00:00");
  const isDeadlinePassed = now >= deadline;

  // Eliminar cualquier mensaje previo de deadline anterior
  const oldDeadlineMsg = document.getElementById("rsvp-deadline-message");
  if (oldDeadlineMsg) oldDeadlineMsg.remove();

  if (isDeadlinePassed) {
    form.classList.add("hidden");

    // Crear y mostrar mensaje de plazo vencido
    const deadlineMsg = document.createElement("div");
    deadlineMsg.id = "rsvp-deadline-message";
    deadlineMsg.className = "deadline-passed-box";
    
    if (guest.confirmado === true) {
      deadlineMsg.innerHTML = `
        <div class="status-badge status-attending"><i data-lucide="check-circle"></i> Asistencia Confirmada</div>
        <p class="deadline-msg-text">El período de confirmaciones finalizó el 14 de junio. Registraste tu asistencia con <strong>${guest.asistentes_confirmados} de ${guest.pases_totales} pases</strong>.</p>
        <p class="deadline-msg-sub">${guest.numero_mesa ? `¡Te esperamos en la <strong>${guest.numero_mesa}</strong>!` : '¡Te esperamos! Te notificaremos tu mesa asignada pronto.'}</p>
      `;
    } else if (guest.confirmado === false) {
      deadlineMsg.innerHTML = `
        <div class="status-badge status-declined"><i data-lucide="x-circle"></i> Asistencia Declinada</div>
        <p class="deadline-msg-text">El período de confirmaciones finalizó el 14 de junio. Registraste que no te era posible asistir.</p>
      `;
    } else {
      deadlineMsg.innerHTML = `
        <div class="status-badge status-pending"><i data-lucide="alert-circle"></i> Plazo Vencido</div>
        <p class="deadline-msg-text">El período de confirmaciones finalizó el domingo 14 de junio. No se registró respuesta a esta invitación.</p>
        <p class="deadline-msg-sub">Por favor, comunícate directamente con los organizadores si tienes dudas.</p>
      `;
    }
    
    detailsForm.appendChild(deadlineMsg);
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  } else {
    // Si no ha expirado el plazo, asegurar que el formulario sea visible
    form.classList.remove("hidden");
  }

  // Poblar dinámicamente el selector de acompañantes reales
  const selectAttendees = document.getElementById("asistentes_reales");
  selectAttendees.innerHTML = "";
  
  // Opción por defecto deshabilitada para obligar selección
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.disabled = true;
  placeholderOption.selected = true;
  placeholderOption.innerText = "-- Seleccione cantidad --";
  selectAttendees.appendChild(placeholderOption);
  
  for (let i = 1; i <= guest.pases_totales; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.innerText = i === 1 ? '1 persona' : `${i} personas`;
    selectAttendees.appendChild(option);
  }
  
  // Pre-rellenar formulario según respuestas previas
  const radioYes = form.querySelector('input[name="attendance"][value="true"]');
  const radioNo = form.querySelector('input[name="attendance"][value="false"]');
  const textarea = document.getElementById("rsvp-comment");
  
  textarea.value = guest.comentarios || "";
  
  if (guest.confirmado === true) {
    radioYes.checked = true;
    selectAttendees.value = guest.asistentes_confirmados || (guest.pases_totales === 1 ? "1" : "");
    if (guest.pases_totales > 1) {
      document.getElementById("attendees-selector-group").classList.remove("hidden");
      selectAttendees.required = true;
    } else {
      document.getElementById("attendees-selector-group").classList.add("hidden");
      selectAttendees.required = false;
    }
  } else if (guest.confirmado === false) {
    radioNo.checked = true;
    document.getElementById("attendees-selector-group").classList.add("hidden");
    selectAttendees.required = false;
  } else {
    radioYes.checked = false;
    radioNo.checked = false;
    document.getElementById("attendees-selector-group").classList.add("hidden");
    selectAttendees.required = false;
  }
  
  // Escuchar cambios en los botones de radio para mostrar/ocultar el selector de pases reales y alternar required
  const radioButtons = form.querySelectorAll('input[name="attendance"]');
  radioButtons.forEach(radio => {
    radio.addEventListener("change", (e) => {
      const selectorGroup = document.getElementById("attendees-selector-group");
      if (e.target.value === "true") {
        if (guest.pases_totales > 1) {
          selectorGroup.classList.remove("hidden");
          selectAttendees.required = true;
        } else {
          selectorGroup.classList.add("hidden");
          selectAttendees.required = false;
          selectAttendees.value = "1"; // Auto-seleccionar 1 si es pase individual
        }
      } else {
        selectorGroup.classList.add("hidden");
        selectAttendees.required = false;
        selectAttendees.value = ""; // Resetear a vacío
      }
    });
  });
  
  // Si ya tiene una respuesta previa guardada en la base de datos, ir directo a la pantalla de éxito
  if (guest.confirmado !== null) {
    showSuccessState(guest.confirmado, guest.asistentes_confirmados, shouldScroll);
  } else {
    // Mostrar formulario de confirmación con animación
    const successMsg = document.getElementById("rsvp-success-message");
    successMsg.classList.add("hidden");
    detailsForm.classList.remove("hidden");
    
    // Desplazar suavemente si se requiere
    if (shouldScroll) {
      setTimeout(() => {
        detailsForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }
}

// ENVIAR CONFIRMACIÓN A LA BASE DE DATOS
async function submitRSVP(event) {
  event.preventDefault();
  
  if (!selectedGuest) return;
  
  const submitBtn = document.getElementById("rsvp-submit-btn");
  const originalBtnContent = submitBtn.innerHTML;
  
  // Deshabilitar botón y mostrar carga
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>Procesando...</span> <div class="spinner" style="width:14px; height:14px; border-width:2px; margin-left: 8px;"></div>`;
  
  const form = document.getElementById("rsvp-form");
  const isAttending = form.querySelector('input[name="attendance"]:checked').value === "true";
  const comment = document.getElementById("rsvp-comment").value.trim();
  
  // Determinar cuántas personas asisten realmente
  let attendeesCount = 0;
  if (isAttending) {
    const val = document.getElementById("asistentes_reales").value;
    attendeesCount = val ? parseInt(val, 10) : (selectedGuest.pases_totales === 1 ? 1 : 0);
    
    // Si la cantidad es inválida para más de 1 pase (vacía), alertar y detener
    if (selectedGuest.pases_totales > 1 && !val) {
      alert("Por favor, selecciona cuántas personas asistirán en total.");
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnContent;
      return;
    }
  }
  
  const confirmationTime = new Date().toISOString();
  
  try {
    if (isSupabaseConfigured && supabaseClient) {
      // Guardar en la base de datos real de Supabase
      const { data, error } = await supabaseClient
        .from('invitados')
        .update({
          confirmado: isAttending,
          asistentes_confirmados: attendeesCount,
          comentarios: comment,
          fecha_confirmacion: confirmationTime
        })
        .eq('id', selectedGuest.id)
        .select();
        
      if (error) throw error;
      
      // Actualizar estado local si las consultas posteriores se realizan sobre este mismo invitado
      if (data && data.length > 0) {
        selectedGuest = data[0];
      }
    } else {
      // Simular guardado local (actualizar nuestro array en memoria)
      const index = localMockInvitados.findIndex(inv => inv.id === selectedGuest.id);
      if (index !== -1) {
        localMockInvitados[index].confirmado = isAttending;
        localMockInvitados[index].asistentes_confirmados = attendeesCount;
        localMockInvitados[index].comentarios = comment;
        localMockInvitados[index].fecha_confirmacion = confirmationTime;
        selectedGuest = localMockInvitados[index];
      }
    }

    // Guardar en localStorage para persistencia de sesión
    try {
      localStorage.setItem("rsvp_guest_id", selectedGuest.id);
      localStorage.setItem("rsvp_guest_pin", selectedGuest.codigo_acceso);
    } catch (e) {
      console.warn("No se pudo guardar la sesión en localStorage:", e);
    }
    
    // Éxito: Ocultar formulario y mostrar mensaje final
    showSuccessState(isAttending, attendeesCount);
    
  } catch (error) {
    console.error("Error al registrar RSVP: ", error);
    alert("Ocurrió un error al guardar tu confirmación. Por favor intenta de nuevo.");
  } finally {
    // Restaurar botón
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnContent;
  }
}

// MOSTRAR PANTALLA DE ÉXITO
function showSuccessState(isAttending, attendeesCount, shouldScroll = true) {
  const detailsForm = document.getElementById("rsvp-details-form");
  const successMsg = document.getElementById("rsvp-success-message");
  const summaryBox = document.getElementById("success-summary-box");
  const successText = document.getElementById("success-message-text");
  
  detailsForm.classList.add("hidden");
  successMsg.classList.remove("hidden");
  
  // Asegurar que el buscador permanezca oculto
  document.querySelector(".search-container").classList.add("hidden");
  document.querySelector(".rsvp-instructions").classList.add("hidden");
  const deadlineNotice = document.querySelector(".rsvp-deadline-notice");
  if (deadlineNotice) deadlineNotice.classList.add("hidden");

  // Eliminar cualquier aviso de mesa previo si existe
  const oldNotice = document.getElementById("success-table-notice");
  if (oldNotice) oldNotice.remove();
  
  if (isAttending) {
    successText.innerText = `¡Gracias por confirmar tu asistencia! Nos alegra mucho saber que nos acompañarás en la celebración de los 70 años de Doña Gladis.`;
    
    summaryBox.innerHTML = `
      <div class="success-summary-row">
        <span class="success-label">Invitado Principal:</span>
        <span class="success-val">${selectedGuest.nombre_completo}</span>
      </div>
      <div class="success-summary-row">
        <span class="success-label">Asistencia:</span>
        <span class="success-val" style="color: #2E7D32;">✔ Confirmada</span>
      </div>
      <div class="success-summary-row">
        <span class="success-label">Personas Confirmadas:</span>
        <span class="success-val">${attendeesCount} de ${selectedGuest.pases_totales} pases</span>
      </div>
      <div class="success-summary-row">
        <span class="success-label">Mesa Asignada:</span>
        <span class="success-val">${selectedGuest.numero_mesa || "Por definirse"}</span>
      </div>
    `;

    // Si no tiene mesa asignada, agregar el aviso dinámicamente
    if (!selectedGuest.numero_mesa || selectedGuest.numero_mesa.trim() === "") {
      const noticeDiv = document.createElement("div");
      noticeDiv.id = "success-table-notice";
      noticeDiv.className = "success-table-notice";
      noticeDiv.innerHTML = `
        <i data-lucide="info"></i>
        <span><strong>Nota importante:</strong> Tu mesa está en proceso de asignación. Por favor, consulta esta invitación en los próximos días para revisar tu número de mesa.</span>
      `;
      // Insertar antes de success-actions
      const actionsDiv = successMsg.querySelector(".success-actions");
      successMsg.insertBefore(noticeDiv, actionsDiv);
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  } else {
    successText.innerText = `Lamentamos que no puedas acompañarnos en esta ocasión. Agradecemos mucho tu confirmación de todas formas y te tendremos en mente en este día especial.`;
    
    summaryBox.innerHTML = `
      <div class="success-summary-row">
        <span class="success-label">Invitado Principal:</span>
        <span class="success-val">${selectedGuest.nombre_completo}</span>
      </div>
      <div class="success-summary-row">
        <span class="success-label">Asistencia:</span>
        <span class="success-val" style="color: #C62828;">✘ Declinada</span>
      </div>
    `;
  }
  
  // Centrar pantalla de éxito si se requiere
  if (shouldScroll) {
    setTimeout(() => {
      successMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }
}

// PERMITIR MODIFICAR LA RESPUESTA
function resetRSVPForm() {
  const detailsForm = document.getElementById("rsvp-details-form");
  const successMsg = document.getElementById("rsvp-success-message");
  
  successMsg.classList.add("hidden");
  detailsForm.classList.remove("hidden");
}

// CERRAR SESIÓN / CONSULTAR OTRA INVITACIÓN
function clearSelectedGuest() {
  selectedGuest = null;
  
  try {
    localStorage.removeItem("rsvp_guest_id");
    localStorage.removeItem("rsvp_guest_pin");
  } catch (e) {
    console.warn("No se pudo limpiar localStorage:", e);
  }
  
  // Mostrar buscador y elementos iniciales
  document.querySelector(".search-container").classList.remove("hidden");
  document.querySelector(".rsvp-instructions").classList.remove("hidden");
  
  // Mostrar aviso de deadline si no ha vencido el plazo
  const now = new Date();
  const deadline = new Date("2026-06-15T00:00:00");
  const deadlineNotice = document.querySelector(".rsvp-deadline-notice");
  if (deadlineNotice && now < deadline) {
    deadlineNotice.classList.remove("hidden");
  }
  
  // Ocultar formulario, PIN y mensajes de éxito
  document.getElementById("rsvp-details-form").classList.add("hidden");
  document.getElementById("rsvp-success-message").classList.add("hidden");
  document.getElementById("rsvp-pin-container").classList.add("hidden");
  
  // Limpiar inputs
  document.getElementById("rsvp-search-input").value = "";
  document.getElementById("rsvp-pin-input").value = "";
  
  // Eliminar cualquier mensaje de plazo vencido específico de invitado
  const oldDeadlineMsg = document.getElementById("rsvp-deadline-message");
  if (oldDeadlineMsg) oldDeadlineMsg.remove();
  
  // Recargar iconos
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  
  // Desplazar suavemente de vuelta al buscador
  setTimeout(() => {
    document.getElementById("confirmar").scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

// COORDINADOR DE INICIO DE SESIÓN AUTOMÁTICO
// Prioriza el código que viene embebido en el enlace (URL); si no hay,
// recurre a la sesión guardada previamente en este dispositivo.
async function initAutoLogin() {
  const handledByURL = await autoLoginFromURL();
  if (!handledByURL) {
    await autoLoginFromLocalStorage();
  }
}

// INICIAR SESIÓN AUTOMÁTICA DESDE EL ENLACE PERSONALIZADO (URL)
// El enlace que se envía por WhatsApp incluye el id del invitado y su código,
// por ejemplo: ...?inv=<id>&pin=<codigo>. Al detectarlos, reconocemos
// automáticamente al invitado sin que tenga que escribir su código.
async function autoLoginFromURL() {
  let urlId, urlPin;
  try {
    const params = new URLSearchParams(window.location.search);
    urlId = params.get("inv");
    urlPin = params.get("pin");
  } catch (e) {
    return false;
  }

  // Si el enlace no trae los parámetros, no hacemos nada aquí
  if (!urlId || !urlPin) return false;

  const loader = document.getElementById("rsvp-loader");
  if (loader) loader.classList.remove("hidden");

  // Ocultar temporalmente el buscador mientras se valida
  document.querySelector(".search-container").classList.add("hidden");
  document.querySelector(".rsvp-instructions").classList.add("hidden");
  const deadlineNotice = document.querySelector(".rsvp-deadline-notice");
  if (deadlineNotice) deadlineNotice.classList.add("hidden");

  let verifiedGuest = null;

  try {
    if (isSupabaseConfigured && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('invitados')
        .select('*')
        .eq('id', urlId)
        .eq('codigo_acceso', urlPin)
        .maybeSingle();

      if (error) throw error;
      verifiedGuest = data;
    } else {
      // Simulación local
      verifiedGuest = localMockInvitados.find(inv => inv.id === urlId && inv.codigo_acceso === urlPin);
    }

    if (verifiedGuest) {
      selectedGuest = verifiedGuest;

      // Guardar sesión para que no tenga que volver a identificarse en este dispositivo
      try {
        localStorage.setItem("rsvp_guest_id", selectedGuest.id);
        localStorage.setItem("rsvp_guest_pin", urlPin);
      } catch (e) {
        console.warn("No se pudo guardar la sesión en localStorage:", e);
      }

      // Limpiar el código de la barra de direcciones por privacidad
      // (sin recargar la página), dejando la URL base.
      try {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      } catch (e) {
        // Silencioso si el navegador lo bloquea
      }

      // Mostrar el nombre del invitado reconocido
      document.getElementById("rsvp-search-input").value = selectedGuest.nombre_completo;

      const hasTable = selectedGuest.numero_mesa && selectedGuest.numero_mesa.trim() !== "";
      const shouldScroll = selectedGuest.confirmado === true && hasTable;
      unlockRSVPDetails(selectedGuest, shouldScroll);

      return true;
    } else {
      // Enlace inválido o invitado eliminado: mostrar buscador normal
      document.querySelector(".search-container").classList.remove("hidden");
      document.querySelector(".rsvp-instructions").classList.remove("hidden");
      if (deadlineNotice) deadlineNotice.classList.remove("hidden");
      return false;
    }
  } catch (error) {
    console.error("Error en auto-login desde URL:", error);
    // Mostrar buscador en caso de fallo de red para no dejar la pantalla vacía
    document.querySelector(".search-container").classList.remove("hidden");
    document.querySelector(".rsvp-instructions").classList.remove("hidden");
    if (deadlineNotice) deadlineNotice.classList.remove("hidden");
    return false;
  } finally {
    if (loader) loader.classList.add("hidden");
  }
}

// INICIAR SESIÓN AUTOMÁTICA DESDE LOCALSTORAGE
async function autoLoginFromLocalStorage() {
  let cachedId, cachedPin;
  try {
    cachedId = localStorage.getItem("rsvp_guest_id");
    cachedPin = localStorage.getItem("rsvp_guest_pin");
  } catch (e) {
    return;
  }
  
  if (!cachedId || !cachedPin) return;
  
  console.log("Caché de confirmación encontrada. Iniciando sesión automática...");
  
  const loader = document.getElementById("rsvp-loader");
  if (loader) loader.classList.remove("hidden");
  
  // Ocultar temporalmente el buscador mientras carga
  document.querySelector(".search-container").classList.add("hidden");
  document.querySelector(".rsvp-instructions").classList.add("hidden");
  const deadlineNotice = document.querySelector(".rsvp-deadline-notice");
  if (deadlineNotice) deadlineNotice.classList.add("hidden");
  
  let verifiedGuest = null;
  
  try {
    if (isSupabaseConfigured && supabaseClient) {
      const { data, error } = await supabaseClient
        .from('invitados')
        .select('*')
        .eq('id', cachedId)
        .eq('codigo_acceso', cachedPin)
        .maybeSingle();
        
      if (error) throw error;
      verifiedGuest = data;
    } else {
      // Simulación local
      verifiedGuest = localMockInvitados.find(inv => inv.id === cachedId && inv.codigo_acceso === cachedPin);
    }
    
    if (verifiedGuest) {
      selectedGuest = verifiedGuest;
      
      // Llenar el input con su nombre para que sepa quién está conectado
      document.getElementById("rsvp-search-input").value = selectedGuest.nombre_completo;
      
      // Desbloquear detalles, desplazar a la sección solo si ya confirmó (asistirá) y tiene mesa asignada
      const hasTable = selectedGuest.numero_mesa && selectedGuest.numero_mesa.trim() !== "";
      const shouldScroll = selectedGuest.confirmado === true && hasTable;
      unlockRSVPDetails(selectedGuest, shouldScroll);
    } else {
      // Credenciales inválidas o eliminadas de la base de datos
      localStorage.removeItem("rsvp_guest_id");
      localStorage.removeItem("rsvp_guest_pin");
      
      document.querySelector(".search-container").classList.remove("hidden");
      document.querySelector(".rsvp-instructions").classList.remove("hidden");
      if (deadlineNotice) deadlineNotice.classList.remove("hidden");
    }
  } catch (error) {
    console.error("Error en auto-login:", error);
    // Mostrar buscador en caso de fallo de red
    document.querySelector(".search-container").classList.remove("hidden");
    document.querySelector(".rsvp-instructions").classList.remove("hidden");
    if (deadlineNotice) deadlineNotice.classList.remove("hidden");
  } finally {
    if (loader) loader.classList.add("hidden");
  }
}

// VERIFICACIÓN DE FECHA LÍMITE AL CARGAR LA PÁGINA
function checkRSVPDeadlineOnLoad() {
  try {
    const now = new Date();
    const deadline = new Date("2026-06-15T00:00:00"); // Lunes 15 a las 00:00 (límite Domingo 14 a las 23:59:59)
    
    if (now >= deadline) {
      const deadlineNotice = document.querySelector(".rsvp-deadline-notice");
      if (deadlineNotice) {
        deadlineNotice.style.backgroundColor = "#FFEBEE";
        deadlineNotice.style.borderColor = "#FFCDD2";
        deadlineNotice.style.color = "#C62828";
        deadlineNotice.innerHTML = `
          <i data-lucide="calendar-x" style="color:#C62828;"></i>
          <span>El período de confirmación finalizó el <strong>Domingo 14 de Junio de 2026</strong></span>
        `;
      }
      
      const instructions = document.querySelector(".rsvp-instructions");
      if (instructions) {
        instructions.innerText = "El período de confirmaciones ha cerrado, pero aún puedes buscar tu nombre para consultar tu número de mesa asignado:";
      }
      
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }
  } catch (e) {
    console.error("Error al comprobar fecha límite de carga:", e);
  }
}
