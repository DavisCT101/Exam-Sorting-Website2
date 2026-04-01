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
    programmeSuggestions.style.display = 'block';
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

  programmeFilter.addEventListener('blur', () => { setTimeout(() => programmeSuggestions.style.display = 'none', 150) });
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
