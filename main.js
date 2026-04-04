// Cleaned single implementation. Use relative fetch paths for GitHub Pages compatibility.
const STATE = {
  exams: [],
  sortKey: null,
  sortDir: 1,
  showAll: false,
  totalCount: 0,
};

const el = (id) => document.getElementById(id);
const tbody = () => el('examsTable').querySelector('tbody');

// Score how well a programme matches a query.
// Returns 3 for exact token match, 2 for token prefix, 1 for substring, 0 for no match.
function programmeMatchScore(programme, query) {
  if (!query) return 3;
  const q = String(query).toLowerCase().trim();
  if (!q) return 3;

  // normalize programme: remove common degree prefixes and punctuation
  let p = String(programme || '').toLowerCase();
  p = p.replace(/\b(bsc|b\.sc|bsc\.)\b/g, '');
  p = p.replace(/[.,/\\]+/g, ' ');
  p = p.replace(/\s+/g, ' ').trim();
  if (!p) return 0;

  const tokens = p.split(/[^a-z0-9]+/).filter(Boolean);
  // exact token match
  if (tokens.some(t => t === q)) return 3;
  // token prefix match
  if (tokens.some(t => t.startsWith(q))) return 2;
  // substring match
  if (p.includes(q)) return 1;
  return 0;
}

async function tryFetch(paths) {
  for (const p of paths) {
    try {
      const res = await fetch(p);
      if (res.ok) return res.json();
    } catch (e) {
      // ignore and try next
    }
  }
  throw new Error('Could not fetch exams_data.json from any known path');
}

function fetchData() {
  // Try a few relative candidates (avoid absolute leading slash which breaks on GitHub Pages deployed under a repo path)
  const candidates = ['exams_data.json', './exams_data.json', '../exams_data.json'];
  return tryFetch(candidates);
}

function uniqueNormalized(arr, key) {
  const map = new Map();
  for (const item of arr) {
    const raw = item[key] || '';
    const norm = raw.trim().toLowerCase();
    if (!norm) continue;
    if (!map.has(norm)) map.set(norm, raw.trim());
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}

function dedupeExams(arr) {
  const map = new Map();
  for (const e of arr) {
    const key = [e.day || '', e.timeSlot || '', (e.programme || '').trim().toLowerCase(), (e.unitCode || '').trim().toLowerCase(), (e.venue || '').trim().toLowerCase()].join('|');
    if (!map.has(key)) map.set(key, e);
  }
  return Array.from(map.values());
}

function populateFilters() {
  const dlist = el('programmeOptions'); dlist.innerHTML = '';
  const yearSel = el('yearFilter'); yearSel.innerHTML = '<option value="">All</option>';
  const daySel = el('dayFilter'); daySel.innerHTML = '<option value="">All</option>';

  if (dlist.dataset.populated === '1') return;

  const programmes = uniqueNormalized(STATE.exams, 'programme');
  programmes.forEach(p => { const opt = document.createElement('option'); opt.value = p; dlist.appendChild(opt); });

  const years = uniqueNormalized(STATE.exams, 'yearSemester');
  years.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; yearSel.appendChild(o); });

  const days = uniqueNormalized(STATE.exams, 'day');
  days.forEach(d => { const o = document.createElement('option'); o.value = d; o.textContent = d; daySel.appendChild(o); });
  dlist.dataset.populated = '1';

  // setup mobile-friendly suggestions (fallback for devices without datalist support)
  const suggestions = el('programmeSuggestions');
  suggestions.innerHTML = '';
  programmes.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = p;
    b.addEventListener('click', () => {
      el('programmeFilter').value = p;
      suggestions.style.display = 'none';
    });
    suggestions.appendChild(b);
  });
}

function renderRows(list, limit) {
  const body = tbody();
  body.innerHTML = '';
  const toRender = (typeof limit === 'number') ? list.slice(0, limit) : list;
  toRender.forEach(row => {
    const tr = document.createElement('tr');
    ['day', 'timeSlot', 'programme', 'unitCode', 'unitName', 'venue'].forEach(k => {
      const td = document.createElement('td'); td.textContent = row[k] || ''; tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

function applyFilters() {
  let res = STATE.exams.slice();
  const prog = el('programmeFilter').value.trim().toLowerCase();
  const year = el('yearFilter').value;
  const day = el('dayFilter').value;
  const text = el('textSearch').value.trim().toLowerCase();

  if (prog) res = res.filter(x => (x.programme || '').toLowerCase().includes(prog));
  if (year) res = res.filter(x => (x.yearSemester || '') === year);
  if (day) res = res.filter(x => (x.day || '') === day);
  if (text) res = res.filter(x => ((x.unitName || '') + ' ' + (x.unitCode || '') + ' ' + (x.venue || '')).toLowerCase().includes(text));

  // AUTO-SORT: If programme filter is exactly "bsc cs", sort by programme ascending
  // This mimics clicking the "Programme" header
  const programmeFilterValue = el('programmeFilter').value.trim().toLowerCase();
  if (programmeFilterValue === 'bsc cs') {
    STATE.sortKey = 'programme';
    STATE.sortDir = 1;
    // Update the visual indicator on the table header (optional)
    updateSortIndicator();
  }

  if (STATE.sortKey) {
    res.sort((a, b) => {
      const A = (a[STATE.sortKey] || '').toString();
      const B = (b[STATE.sortKey] || '').toString();
      return A.localeCompare(B) * STATE.sortDir;
    });
  }

  const limit = STATE.showAll ? undefined : 200;
  renderRows(res, limit);
  updateCounts(res.length);
}

// Helper function to update sort indicator arrows on table headers
function updateSortIndicator() {
  // Remove existing indicators
  document.querySelectorAll('#examsTable thead th').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    // Remove any existing arrow text
    const existingArrow = th.querySelector('.sort-arrow');
    if (existingArrow) existingArrow.remove();
  });
  
  // Add indicator to the sorted column
  if (STATE.sortKey) {
    const th = document.querySelector(`#examsTable thead th[data-key="${STATE.sortKey}"]`);
    if (th) {
      const arrow = document.createElement('span');
      arrow.className = 'sort-arrow';
      arrow.textContent = STATE.sortDir === 1 ? ' ↑' : ' ↓';
      arrow.style.marginLeft = '5px';
      th.appendChild(arrow);
      th.classList.add(STATE.sortDir === 1 ? 'sort-asc' : 'sort-desc');
    }
  }
}

function updateCounts(visibleCount) {
  const countsEl = el('counts');
  countsEl.textContent = `Loaded: ${STATE.totalCount} exams — Showing: ${visibleCount}`;
}

function resetFilters() {
  el('programmeFilter').value = '';
  el('yearFilter').selectedIndex = 0;
  el('dayFilter').selectedIndex = 0;
  el('textSearch').value = '';
  STATE.sortKey = null; STATE.sortDir = 1;
  // Remove sort indicators
  updateSortIndicator();
  const limit = STATE.showAll ? undefined : 200;
  renderRows(STATE.exams, limit);
  updateCounts(STATE.exams.length);
}

function setupInteractions() {
  el('apply').addEventListener('click', applyFilters);
  el('reset').addEventListener('click', resetFilters);
  const showAllBtn = el('showAll');
  if (showAllBtn) showAllBtn.addEventListener('click', () => {
    STATE.showAll = !STATE.showAll;
    showAllBtn.textContent = STATE.showAll ? 'Show first 200' : 'Show all';
    applyFilters();
  });

  // table sorting
  document.querySelectorAll('#examsTable thead th').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (STATE.sortKey === key) STATE.sortDir = -STATE.sortDir; else { STATE.sortKey = key; STATE.sortDir = 1; }
      updateSortIndicator();
      applyFilters();
    });
  });

  // Setup simple fallback suggestions and year filtering on input
  const programmeFilter = el('programmeFilter');
  const programmeSuggestions = el('programmeSuggestions');
  const programmeOptions = el('programmeOptions');
  const yearFilter = el('yearFilter');
  const dayFilter = el('dayFilter');
  const textSearch = el('textSearch');

  function updateYearOptions(prog) {
    while (yearFilter.options.length > 1) yearFilter.remove(1);
    let filteredExams = STATE.exams;
    if (prog && prog.trim() !== '') {
      const lower = prog.toLowerCase();
      filteredExams = STATE.exams.filter(e => e.programme && e.programme.toLowerCase().includes(lower));
    }
    const yrs = Array.from(new Set(filteredExams.map(e => e.yearSemester))).filter(Boolean).sort();
    yrs.forEach(y => yearFilter.appendChild(new Option(y, y)));
  }

  function showProgrammeSuggestions(filteredProg) {
    programmeSuggestions.innerHTML = '';
    if (!filteredProg || filteredProg.length === 0) { programmeSuggestions.style.display = 'none'; return }

    // Positioning: place below by default, but if there's not enough space (keyboard on mobile), place above input.
    const rect = programmeFilter.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const preferredMax = 220;

    // Set width to match input for easier tapping
    programmeSuggestions.style.width = programmeFilter.offsetWidth + 'px';
    programmeSuggestions.style.left = '0';

    let maxH, placeAbove = false;
    if (spaceBelow >= Math.min(preferredMax, 160)) {
      // enough room below
      programmeSuggestions.style.top = (programmeFilter.offsetHeight + 6) + 'px';
      programmeSuggestions.style.bottom = 'auto';
      maxH = Math.min(preferredMax, Math.max(80, spaceBelow - 16));
    } else if (spaceAbove >= Math.min(preferredMax, 160)) {
      // place above
      programmeSuggestions.style.top = 'auto';
      programmeSuggestions.style.bottom = (programmeFilter.offsetHeight + 6) + 'px';
      maxH = Math.min(preferredMax, Math.max(80, spaceAbove - 16));
      placeAbove = true;
    } else {
      // pick the larger side
      if (spaceAbove > spaceBelow) {
        programmeSuggestions.style.top = 'auto';
        programmeSuggestions.style.bottom = (programmeFilter.offsetHeight + 6) + 'px';
        maxH = Math.max(60, spaceAbove - 16);
        placeAbove = true;
      } else {
        programmeSuggestions.style.top = (programmeFilter.offsetHeight + 6) + 'px';
        programmeSuggestions.style.bottom = 'auto';
        maxH = Math.max(60, spaceBelow - 16);
      }
    }

    programmeSuggestions.style.maxHeight = Math.max(80, Math.min(preferredMax, Math.floor(maxH))) + 'px';

    for (const p of filteredProg.slice(0, 30)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = p;
      btn.addEventListener('click', () => {
        programmeFilter.value = p;
        programmeSuggestions.style.display = 'none';
        updateYearOptions(p);
        applyFilters();
      });
      programmeSuggestions.appendChild(btn);
    }

    // Ensure it's visible and on top
    programmeSuggestions.style.display = 'block';
    programmeSuggestions.style.zIndex = '9999';
    // If placed above, add a class for possible styling tweaks
    if (placeAbove) programmeSuggestions.classList.add('above'); else programmeSuggestions.classList.remove('above');
  }

  // Build a list of programmes for suggestions
  const programmes = uniqueNormalized(STATE.exams, 'programme');
  programmes.forEach(p => {
    const opt = document.createElement('option'); opt.value = p; programmeOptions.appendChild(opt);
  });

  programmeFilter.addEventListener('input', (ev) => {
    const v = ev.target.value.trim();
    updateYearOptions(v);
    if (!v) { programmeSuggestions.style.display = 'none'; return }
    const lower = v.toLowerCase();
    const matches = programmes.filter(p => p.toLowerCase().includes(lower));
    showProgrammeSuggestions(matches);
  });

  // Hide suggestions on blur *unless* focus moves into the suggestions (e.g., user tapped a suggestion).
  programmeFilter.addEventListener('blur', () => {
    setTimeout(() => {
      const active = document.activeElement;
      if (!programmeSuggestions.contains(active)) programmeSuggestions.style.display = 'none';
    }, 300);
  });
}

// init
fetchData().then(data => {
  const loaded = Array.isArray(data) ? data : [];
  STATE.totalCount = loaded.length;
  STATE.exams = dedupeExams(loaded);
  populateFilters();
  setupInteractions();
  const limit = STATE.showAll ? undefined : 200;
  renderRows(STATE.exams, limit);
  updateCounts(STATE.exams.length);
}).catch(err => {
  console.error('Failed to load exams_data.json', err);
  const body = tbody(); body.innerHTML = '<tr><td colspan="6">Failed to load data. Check exams_data.json is present.</td></tr>';
});