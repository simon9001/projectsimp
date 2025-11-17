// ----------------- Tribute helpers -----------------
const form = document.getElementById('tributeForm');
const nameInput = document.getElementById('name');
const relationInput = document.getElementById('relation');
const messageInput = document.getElementById('message');
const list = document.getElementById('tributeList');
const submit = document.getElementById('submitTribute');
const clearAll = document.getElementById('clearAll');

// ✅ Your live Google Apps Script Web App URL (must end with /exec)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw9k8Wz3warLqEPm7YbSBSuJ-K7wnoD2poLvnsnQjKY4sOZQVroGCdYB2Oc-e2s6cnLlQ/exec';

// Unique user UUID for ownership tracking
if (!localStorage.getItem('user_uuid')) {
  localStorage.setItem('user_uuid', crypto.randomUUID());
}
const userUUID = localStorage.getItem('user_uuid');

function loadTributes() {
  const raw = localStorage.getItem('tributes_v1') || '[]';
  try { return JSON.parse(raw); } catch { return []; }
}

function saveTributes(arr) {
  localStorage.setItem('tributes_v1', JSON.stringify(arr));
}

function escapeHtml(s) {
  return (s + '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function renderTributes(tributes = loadTributes()) {
  list.innerHTML = '';
  if (!tributes.length) {
    list.innerHTML = '<p class="muted">No tributes yet — be the first to share a memory.</p>';
    return;
  }

  tributes.slice().reverse().forEach(t => {
    const el = document.createElement('div');
    el.className = 'tribute';
    el.dataset.uuid = t.uuid || '';
    el.dataset.id = t.id || '';

    el.innerHTML = `
      <strong>${escapeHtml(t.name || 'Anonymous')}</strong>
      <small>• ${escapeHtml(t.relation || '')}</small>
      <div style="margin-top:6px">${escapeHtml(t.message)}</div>
      ${t.uuid === userUUID ? '<button class="delete-btn">Delete</button>' : ''}
      <small class="muted">${t.ts ? new Date(t.ts).toLocaleString() : ''}</small>`;

    list.appendChild(el);

    if (t.uuid === userUUID) {
      el.querySelector('.delete-btn').addEventListener('click', async () => {
        if (confirm('Delete your tribute?')) {
          await deleteTribute(t.id, t.uuid);
          const updated = loadTributes().filter(x => x.id !== t.id);
          saveTributes(updated);
          renderTributes(updated);
        }
      });
    }
  });
}

// ----------------- POST new tribute -----------------
async function submitToWebApp(name, relation, message) {
  const payload = { name, relation, message, uuid: userUUID, ts: Date.now() };

  try {
    submit.disabled = true;
    console.log('Sending request to:', SCRIPT_URL);
    console.log('Payload:', payload);

    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('Response status:', res.status);
    console.log('Response ok:', res.ok);

    const data = await res.json();
    console.log('Response data:', data);
    
    submit.disabled = false;

    if (data.status === 'success') return data.id;
    
    console.error('Submission failed:', data);
    alert('Failed to submit tribute: ' + (data.message || 'Unknown error'));
    return null;
    
  } catch (err) {
    submit.disabled = false;
    console.error('Error submitting tribute:', err);
    console.error('Error details:', err.message, err.stack);
    
    // More specific error message
    if (err.name === 'TypeError') {
      alert('Network error - check if script URL is correct and CORS is enabled.');
    } else {
      alert('Unable to reach the server. Check your internet or script URL.');
    }
    return null;
  }
}
// ----------------- DELETE tribute -----------------
async function deleteTribute(id, uuid) {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteId: id, uuid })
    });
    const data = await res.json();

    if (data.status === 'deleted') {
      console.log(`Deleted tribute with id ${id}`);
    } else {
      console.warn('Delete failed or not found', id);
    }
  } catch (err) {
    console.error('Error deleting tribute:', err);
  }
}

// ----------------- GET tributes -----------------
async function loadAllTributes() {
  try {
    const res = await fetch(SCRIPT_URL);
    const json = await res.json();

    // Expect { status: 'success', data: [...] }
    const tributes = json?.data || [];
    saveTributes(tributes);
    renderTributes(tributes);
  } catch (err) {
    console.error('Error loading tributes:', err);
    renderTributes();
  }
}

// ----------------- Form handling -----------------
submit?.addEventListener('click', async e => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const relation = relationInput.value.trim();
  const message = messageInput.value.trim();

  if (!message) {
    alert('Please write a short tribute.');
    messageInput.focus();
    return;
  }

  const id = await submitToWebApp(name, relation, message);
  if (!id) return;

  const tribute = { id, name, relation, message, ts: Date.now(), uuid: userUUID };
  const arr = loadTributes();
  arr.push(tribute);
  saveTributes(arr);
  renderTributes(arr);

  nameInput.value = '';
  relationInput.value = '';
  messageInput.value = '';
});

// ----------------- Initialize -----------------
document.addEventListener('DOMContentLoaded', loadAllTributes);

// Clear all locally cached tributes
clearAll?.addEventListener('click', () => {
  if (confirm('Clear all tributes stored locally?')) {
    localStorage.removeItem('tributes_v1');
    renderTributes();
  }
});

// ----------------- Accordion (unchanged) -----------------
document.querySelectorAll('.accordion-header').forEach(button => {
  button.addEventListener('click', () => {
    const item = button.parentElement;
    const openItem = document.querySelector('.accordion-item.active');
    if (openItem && openItem !== item) {
      openItem.classList.remove('active');
      openItem.querySelector('.accordion-content').style.maxHeight = null;
    }
    item.classList.toggle('active');
    const content = item.querySelector('.accordion-content');
    if (item.classList.contains('active')) {
      content.style.maxHeight = content.scrollHeight + 'px';
    } else {
      content.style.maxHeight = null;
    }
  });
});

// ----------------- Gallery: responsive pages + auto-slide + lightbox -----------------
document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.gallery-container');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = lightbox ? lightbox.querySelector('img') : null;
  if (!container) {
    // nothing to do
    renderTributes();
    return;
  }

  // store original thumbs (so we can rebuild pages on resize)
  const originalThumbs = Array.from(container.querySelectorAll('.thumb'));
  let pages = [];
  let currentPage = 0;
  let perPage = calcPerPage();
  let autoSlide = null;
  let isPaused = false;
  let resumeTimer = null;
  const AUTO_MS = 4000;

  function calcPerPage() {
    const w = window.innerWidth;
    if (w > 900) return 6; // 3 cols x 2 rows
    if (w > 600) return 4; // 2 cols x 2 rows
    return 2;               // 1 col x 2 rows
  }

  function buildPages() {
    perPage = calcPerPage();
    // keep a reference to which logical index we were showing
    const visibleStartIndex = currentPage * perPage;

    // clear container and rebuild pages by chunking originalThumbs
    container.innerHTML = '';
    pages = [];
    for (let i = 0; i < originalThumbs.length; i += perPage) {
      const page = document.createElement('div');
      page.className = 'gallery-page';
      const grid = document.createElement('div');
      grid.className = 'gallery-grid';
      // append up to perPage thumbs
      const slice = originalThumbs.slice(i, i + perPage);
      slice.forEach(t => grid.appendChild(t));
      page.appendChild(grid);
      container.appendChild(page);
      pages.push(page);
    }

    // clamp currentPage and scroll there
    currentPage = Math.min(Math.floor(visibleStartIndex / perPage), Math.max(0, pages.length - 1));
    requestAnimationFrame(() => {
      container.scrollTo({ left: currentPage * container.clientWidth, behavior: 'auto' });
    });

    attachThumbHandlers();
  }

  function attachThumbHandlers() {
    // attach click to each thumb image (these elements are reused)
    const imgs = container.querySelectorAll('.thumb img');
    imgs.forEach(img => {
      img.onclick = () => {
        openLightbox(img);
      };
    });
  }

  // Auto slide functions
  function startAutoSlide() {
    if (isPaused || pages.length <= 1) return;
    stopAutoSlide();
    autoSlide = setInterval(() => {
      currentPage = (currentPage + 1) % pages.length;
      container.scrollTo({ left: currentPage * container.clientWidth, behavior: 'smooth' });
    }, AUTO_MS);
  }
  function stopAutoSlide() {
    clearInterval(autoSlide);
    autoSlide = null;
  }

  // pause/resume helpers (used for manual scroll)
  function pauseThenResume() {
    stopAutoSlide();
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      if (!isPaused) startAutoSlide();
    }, 3000);
  }

  // scroll listener to update page index and pause/resume
  container.addEventListener('scroll', () => {
    clearTimeout(container._scrollTimeout);
    stopAutoSlide();
    container._scrollTimeout = setTimeout(() => {
      if (!isPaused) startAutoSlide();
    }, 3000);
    currentPage = Math.round(container.scrollLeft / Math.max(1, container.clientWidth));
  }, { passive: true });

  container.addEventListener('wheel', () => { pauseThenResume(); }, { passive: true });
  container.addEventListener('touchstart', () => { pauseThenResume(); }, { passive: true });

  // lightbox open/close
  function openLightbox(imgEl) {
    if (!lightbox || !lightboxImg) return;
    isPaused = true;
    stopAutoSlide();
    lightboxImg.src = imgEl.src;
    lightboxImg.alt = imgEl.alt || '';
    lightbox.classList.add('show');
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('show');
    isPaused = false;
    // small delay to prevent immediate auto scroll while closing animation
    setTimeout(() => startAutoSlide(), 250);
  }

  // lightbox close handlers
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      // close if clicking outside the image or on the image
      if (e.target === lightbox || e.target === lightboxImg) {
        closeLightbox();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  // responsive rebuild with debounce
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const oldPer = perPage;
      perPage = calcPerPage();
      // rebuild pages only if per-page count changes
      if (perPage !== oldPer) {
        buildPages();
      } else {
        // still ensure pages width corrected (in case of width change)
        container.scrollTo({ left: currentPage * container.clientWidth, behavior: 'auto' });
      }
    }, 220);
  });

  // initial build + start auto
  buildPages();
  startAutoSlide();

  // expose a manual stop (useful for debugging)
  window.__galleryStop = stopAutoSlide;
  window.__galleryStart = startAutoSlide;

  // end gallery section
  // ------------------
  // Initialize tributes (render)
  renderTributes();

  // ------------------ Farewell canvas (petals) ------------------
  const canvas = document.getElementById('farewellCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let petals = [];
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    petals = Array.from({length: 40}, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: 2 + Math.random() * 3,
      speedY: 0.2 + Math.random() * 0.5,
      speedX: Math.random() * 0.3 - 0.15,
      opacity: 0.3 + Math.random() * 0.6
    }));

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      petals.forEach(p => {
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 182, 193, ${p.opacity})`;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        p.y -= p.speedY;
        p.x += p.speedX;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.x < -10) p.x = canvas.width + 10;
      });
      requestAnimationFrame(animate);
    }
    animate();
  }

}); // end DOMContentLoaded

function showDownloadMessage(event) {
  event.preventDefault(); // Stop immediate download
  const link = event.currentTarget;
  const progressContainer = document.getElementById('downloadProgress');
  const fill = document.querySelector('.progress-fill');

  // Show progress bar
  progressContainer.style.display = 'block';
  fill.style.width = '0%';
  
  // Show alert to user
  alert('Your download is starting...\n\nPlease keep this page open.');

  // Animate progress bar
  setTimeout(() => fill.style.width = '100%', 100);

  // Simulate download delay
  setTimeout(() => {
    // Trigger actual download
    const a = document.createElement('a');
    a.href = link.getAttribute('href');
    a.download = link.getAttribute('download');
    a.click();

    // Notify user
    alert('✅ Download complete! Check your downloads folder.');
    progressContainer.style.display = 'none';
  }, 2500);
}

document.addEventListener('DOMContentLoaded', () => {
  const switchBtn = document.getElementById('langSwitch');
  let isKikuyu = false; // default language = English

  // when clicked, toggle between English and Kikuyu
  switchBtn.addEventListener('click', () => {
    isKikuyu = !isKikuyu;
    switchBtn.textContent = isKikuyu ? 'Change to English' : 'Change to Kikuyu';

    document.querySelectorAll('.timeline, .mutes, .muted').forEach(p => {
      const text = isKikuyu ? p.dataset.ki : p.dataset.en;
      if (text) p.innerHTML = text; // ✅ changed from textContent to innerHTML
    });
  });
});

const toggle = document.getElementById("navbarToggle");
const menu = document.getElementById("navMenu");

toggle.addEventListener("click", () => {
  menu.classList.toggle("open");
});