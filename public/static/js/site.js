(function () {

  function attachAutocomplete(input, onChoose) {
    const field = input.closest('.field') || input.parentElement;
    field.classList.add('ac-field');
    const list = document.createElement('ul');
    list.className = 'ac-list';
    list.hidden = true;
    field.appendChild(list);
    let items = [], active = -1, timer = null, lastQ = '';
    if (input.value.trim()) input.dataset.picked = input.value.trim();

    const hide = () => { list.hidden = true; active = -1; };
    const render = () => {
      if (!items.length) { hide(); return; }
      list.innerHTML = items.map((s, i) =>
        `<li class="ac-item${i === active ? ' active' : ''}" data-i="${i}">${s}</li>`).join('');
      list.hidden = false;
    };
    const choose = (i) => {
      input.value = items[i];
      input.dataset.picked = items[i];
      hide(); lastQ = items[i];
      if (onChoose) onChoose();
    };
    async function search() {
      const q = input.value.trim();
      if (q.length < 3) { items = []; hide(); return; }
      if (q === lastQ) return;
      lastQ = q;
      try {
        const res = await fetch('/address-suggest?' + new URLSearchParams({ q }));
        const d = await res.json();
        items = (d.ok && d.suggestions) ? d.suggestions : [];
        active = -1; render();
      } catch (e) { items = []; hide(); }
    }

    input.addEventListener('input', () => {
      delete input.dataset.picked;
      clearTimeout(timer); timer = setTimeout(search, 300);
    });
    input.addEventListener('keydown', (e) => {
      if (list.hidden || !items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, items.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = active <= 0 ? items.length - 1 : active - 1; render(); }
      else if (e.key === 'Enter') { if (active >= 0) { e.preventDefault(); choose(active); } }
      else if (e.key === 'Escape') { hide(); }
    });

    list.addEventListener('mousedown', (e) => {
      const li = e.target.closest('.ac-item');
      if (!li) return;
      e.preventDefault();
      choose(+li.dataset.i);
    });
    input.addEventListener('blur', () => setTimeout(hide, 150));
  }

  const heroTitle = document.getElementById('heroTitle');
  if (heroTitle) setTimeout(() => heroTitle.classList.add('swapped'), 3000);

  const scrollCue = document.querySelector('.scroll-cue');
  if (scrollCue) {
    window.addEventListener('scroll', () => {
      scrollCue.classList.toggle('gone', window.scrollY > 60);
    }, { passive: true });
  }

  const bar   = document.createElement('div'); bar.className = 'lucid-scrollbar';
  const thumb = document.createElement('div'); thumb.className = 'lucid-scroll-thumb';
  bar.appendChild(thumb);
  document.body.appendChild(bar);

  const docEl = document.documentElement;
  function updateBar() {
    const dh = docEl.scrollHeight - innerHeight;
    if (dh <= 2) { bar.classList.remove('ready'); return; }
    bar.classList.add('ready');
    const thumbH = Math.max((innerHeight / docEl.scrollHeight) * innerHeight, 44);
    const maxTop = innerHeight - thumbH;
    thumb.style.height = thumbH + 'px';
    thumb.style.transform = `translateY(${(window.scrollY / dh) * maxTop}px)`;
  }
  window.addEventListener('scroll', updateBar, { passive: true });
  window.addEventListener('resize', updateBar);
  setTimeout(updateBar, 100);

  let dragging = false, startY = 0, startScroll = 0;
  thumb.addEventListener('pointerdown', (e) => {
    dragging = true; startY = e.clientY; startScroll = window.scrollY;
    thumb.classList.add('drag'); thumb.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  thumb.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dh = docEl.scrollHeight - innerHeight;
    const maxTop = innerHeight - thumb.offsetHeight;
    window.scrollTo(0, startScroll + ((e.clientY - startY) / maxTop) * dh);
  });
  const endDrag = () => { dragging = false; thumb.classList.remove('drag'); };
  thumb.addEventListener('pointerup', endDrag);
  thumb.addEventListener('pointercancel', endDrag);

  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('show'); io.unobserve(en.target); }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  document.querySelectorAll('.btn-silver').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--shine', `${((e.clientX - r.left) / r.width) * 100}%`);
    });
    btn.addEventListener('pointerleave', () => btn.style.setProperty('--shine', '50%'));
  });

  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });

  const bookForm = document.getElementById('bookForm');
  if (bookForm) {
    let data = {};
    try { data = JSON.parse(bookForm.dataset.pricing || '{}'); } catch (e) {}
    const svcSel = document.getElementById('serviceSelect');
    const sizeSel = document.getElementById('sizeSelect');
    const serviceField = document.getElementById('serviceField');
    const addrInput = bookForm.querySelector('[name="address"]');
    const receipt = document.getElementById('receipt');
    const receiptDesc = document.getElementById('receiptDesc');
    const receiptLines = document.getElementById('receiptLines');
    const receiptTotal = document.getElementById('receiptTotal');
    const receiptEst = document.getElementById('receiptEst');
    const receiptHint = document.getElementById('receiptHint');
    const fmtDur = (m) => m < 60 ? `~${m} min` : `~${(m / 60).toString().replace(/\.0$/, '')} hr`;
    const apptField = document.getElementById('apptField');
    const apptBtn = document.getElementById('apptBtn');
    const bookDate = document.getElementById('bookDate');
    const bookTime = document.getElementById('bookTime');
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const line = (label, amount, cls) =>
      `<li${cls ? ` class="${cls}"` : ''}><span>${label}</span><strong>${amount}</strong></li>`;
    const fmtDate = (s) => new Date(s + 'T00:00:00')
      .toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const fmt12 = (t) => {
      let [h, m] = t.split(':').map(Number);
      const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
      return `${h}:${String(m).padStart(2, '0')} ${ap}`;
    };

    let travel = null;
    let lastQuoted = '';
    async function quoteTravel() {
      const addr = (addrInput ? addrInput.value : '').trim();
      if (addr === lastQuoted) return;
      lastQuoted = addr;
      if (!addr) { travel = null; calcPrice(); return; }
      travel = 'pending'; calcPrice();
      try {
        const res = await fetch('/quote-travel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ address: addr }),
        });
        const d = await res.json();
        travel = d.ok ? { fee: d.fee, miles: d.miles } : 'error';
      } catch (e) {
        travel = 'error';
      }
      calcPrice();
    }
    if (addrInput) {
      addrInput.addEventListener('change', quoteTravel);
      attachAutocomplete(addrInput, quoteTravel);
    }
    function updateServiceVisibility() {
      const show = !!sizeSel.value || !!svcSel.value;
      serviceField.classList.toggle('hidden', !show);
      svcSel.disabled = !show;
    }
    const BIKE = 79;
    function updateServiceOptions() {
      const bike = sizeSel.value === 'bike';
      const size = data.sizes && data.sizes[sizeSel.value];
      const sur = size ? size.surcharge : 0;
      [...svcSel.options].forEach((opt) => {
        if (!opt.value) return;
        const s = data.services && data.services[opt.value];
        if (!s) return;
        if (bike) {
          opt.hidden = opt.value !== 'full';
          opt.disabled = opt.value !== 'full';
          if (opt.value === 'full') opt.textContent = `Full Detail — $${BIKE}`;
        } else {
          opt.hidden = false; opt.disabled = false;
          opt.textContent = `${s.label} — $${s.price + sur}`;
        }
      });
      if (bike) svcSel.value = 'full';
    }
    function calcPrice() {
      const svc = data.services && data.services[svcSel.value];
      const size = data.sizes && data.sizes[sizeSel.value];
      if (svc && size) {
        const bike = sizeSel.value === 'bike';
        const base = bike ? BIKE : svc.price + size.surcharge;
        let total = base;
        receiptDesc.textContent = bike ? 'Full detail for your bike or motorcycle.' : (svc.desc || '');
        let lines = '';
        if (bookDate.value && bookTime.value) {
          lines += line('Appointment', `${fmtDate(bookDate.value)} · ${fmt12(bookTime.value)}`, 'appt-line');
        }
        lines += line(bike ? 'Full Detail' : svc.label, '$' + (bike ? BIKE : svc.price));
        lines += line(bike ? 'Bike / Motorcycle' : `${cap(sizeSel.value)} car`,
          bike ? 'Included' : (size.surcharge ? '+$' + size.surcharge : 'Included'));
        if (travel === 'pending') {
          lines += line('Travel fee', 'calculating…', 'muted-line');
        } else if (travel === 'error') {
          lines += line('Travel fee', 'enter a valid address', 'muted-line');
        } else if (travel && typeof travel === 'object') {
          lines += line(`Travel fee (${travel.miles} mi)`, '+$' + travel.fee);
          total = Math.round((total + travel.fee) * 100) / 100;
        }
        receiptLines.innerHTML = lines;
        receiptTotal.textContent = '$' + total;
        if (svc.minutes) { receiptEst.textContent = `Estimated detail time: ${fmtDur(svc.minutes)}`; receiptEst.hidden = false; }
        receipt.hidden = false;
        receiptHint.hidden = true;
      } else {
        receipt.hidden = true;
        receiptHint.hidden = false;
      }
    }
    function updateApptVisibility() {
      apptField.classList.toggle('hidden', !svcSel.value);
    }
    function resetAppt() {
      selDate = ''; bookDate.value = ''; bookTime.value = '';
      apptBtn.textContent = 'Choose date & time'; apptBtn.classList.remove('chosen');
    }

    svcSel.addEventListener('change', async () => {
      resetAppt(); updateApptVisibility(); updateServiceOptions();
      await refreshOpenDates(); calcPrice();
    });
    sizeSel.addEventListener('change', () => {
      updateServiceVisibility(); updateServiceOptions(); updateApptVisibility(); calcPrice();
    });
    updateServiceVisibility();
    updateServiceOptions();
    updateApptVisibility();

    const apptModal = document.getElementById('apptModal');
    const apptGrid = document.getElementById('apptGrid');
    const apptLabel = document.getElementById('apptLabel');
    const apptTimes = document.getElementById('apptTimes');
    const apptDur = document.getElementById('apptDur');
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'];
    const pad = (n) => String(n).padStart(2, '0');
    const isoOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
    const _t = new Date();
    const todayStr = isoOf(_t.getFullYear(), _t.getMonth(), _t.getDate());
    let openSet = new Set();
    let fullSet = new Set();
    let viewY = _t.getFullYear(), viewM = _t.getMonth();
    let selDate = bookDate.value || '';

    async function refreshOpenDates() {
      openSet = new Set(); fullSet = new Set();
      if (!svcSel.value) return;
      try {
        const r = await (await fetch('/open-dates?' + new URLSearchParams({ service: svcSel.value }))).json();
        if (r.ok) { openSet = new Set(r.dates); fullSet = new Set(r.full || []); }
      } catch (_) {  }
    }
    function renderApptCal() {
      apptLabel.textContent = `${MONTHS[viewM]} ${viewY}`;
      const firstDow = new Date(viewY, viewM, 1).getDay();
      const days = new Date(viewY, viewM + 1, 0).getDate();
      let html = '';
      for (let i = 0; i < firstDow; i++) html += '<span class="cal-cell empty"></span>';
      for (let d = 1; d <= days; d++) {
        const ds = isoOf(viewY, viewM, d);
        const open = openSet.has(ds);
        const full = fullSet.has(ds);
        const cls = ['cal-cell'];
        if (!open) cls.push('disabled');
        if (full) cls.push('full');
        if (ds === selDate) cls.push('sel');
        if (ds === todayStr) cls.push('is-today');
        const tag = full ? '<small class="cal-full">FULL</small>' : '';
        html += `<button type="button" class="${cls.join(' ')}" data-date="${ds}"${open ? '' : ' disabled'}>${d}${tag}</button>`;
      }
      apptGrid.innerHTML = html;
    }
    async function loadTimes(ds) {
      apptTimes.innerHTML = '<p class="appt-times-hint">Loading times…</p>';
      try {
        const r = await (await fetch('/slots?' + new URLSearchParams({ date: ds, service: svcSel.value }))).json();
        const slots = (r.ok && r.slots) ? r.slots : [];
        apptTimes.innerHTML = slots.length
          ? '<div class="time-list">' + slots.map((t) =>
              `<button type="button" class="time-opt${(ds === selDate && t === bookTime.value) ? ' sel' : ''}" data-time="${t}">${fmt12(t)}</button>`).join('') + '</div>'
          : '<p class="appt-times-hint">No open times that day.</p>';
      } catch (_) {
        apptTimes.innerHTML = '<p class="appt-times-hint">Couldn\'t load times.</p>';
      }
    }
    function openAppt() {
      const svc = data.services && data.services[svcSel.value];
      if (svc) {
        const m = svc.minutes;
        apptDur.textContent = `${svc.label} · about ${m >= 60 ? (m / 60) + ' hr' : m + ' min'}`;
      }
      renderApptCal();
      if (selDate && openSet.has(selDate)) loadTimes(selDate);
      else apptTimes.innerHTML = '<p class="appt-times-hint">Select a date to see open times.</p>';
      apptModal.hidden = false;
    }
    const closeAppt = () => { apptModal.hidden = true; };
    apptBtn.addEventListener('click', async () => {
      if (!svcSel.value) return;
      await refreshOpenDates();
      openAppt();
    });
    apptGrid.addEventListener('click', (e) => {
      const c = e.target.closest('.cal-cell');
      if (!c || c.disabled || c.classList.contains('empty')) return;
      selDate = c.dataset.date; renderApptCal(); loadTimes(selDate);
    });
    apptTimes.addEventListener('click', (e) => {
      const b = e.target.closest('.time-opt');
      if (!b) return;
      bookDate.value = selDate; bookTime.value = b.dataset.time;
      apptBtn.textContent = `${fmtDate(selDate)} · ${fmt12(b.dataset.time)}`;
      apptBtn.classList.add('chosen');
      closeAppt(); calcPrice();
    });
    document.getElementById('apptPrev').addEventListener('click', () => { if (--viewM < 0) { viewM = 11; viewY--; } renderApptCal(); });
    document.getElementById('apptNext').addEventListener('click', () => { if (++viewM > 11) { viewM = 0; viewY++; } renderApptCal(); });
    apptModal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeAppt));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !apptModal.hidden) closeAppt(); });

    const addrErr = document.getElementById('addrErr');
    if (addrInput) addrInput.addEventListener('input', () => {
      addrInput.classList.remove('input-err');
      if (addrErr) addrErr.hidden = true;
    });
    bookForm.addEventListener('submit', (e) => {
      let focused = false;
      const addrOK = addrInput && addrInput.dataset.picked &&
        addrInput.dataset.picked === addrInput.value.trim();
      if (addrInput && !addrOK) {
        e.preventDefault();
        addrInput.classList.add('input-err');
        if (addrErr) addrErr.hidden = false;
        addrInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        addrInput.focus();
        focused = true;
      }
      if (svcSel.value && (!bookDate.value || !bookTime.value)) {
        e.preventDefault();
        apptBtn.classList.add('err');
        if (!focused) apptBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    if (svcSel.value) refreshOpenDates();
    calcPrice();
  }

  function setupMarquee(row, staticClass) {
    const wrap = row.parentElement;
    function build() {
      row.querySelectorAll('[data-clone]').forEach((n) => n.remove());
      row.style.animation = 'none';
      wrap.classList.remove(staticClass);
      const originals = [...row.children];
      if (row.scrollWidth > wrap.clientWidth + 4) {
        originals.forEach((c) => {
          const cl = c.cloneNode(true);
          cl.setAttribute('data-clone', '');
          cl.setAttribute('aria-hidden', 'true');
          row.appendChild(cl);
        });
        row.style.animation = `baScroll ${Math.max(originals.length * 6, 14)}s linear infinite`;
      } else {
        wrap.classList.add(staticClass);
      }
    }
    build();
    let rt = null;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 200); });
  }
  const baRowEl = document.querySelector('.ba-row');
  if (baRowEl) setupMarquee(baRowEl, 'ba-static');
  const rvRowEl = document.querySelector('.rv-row');
  if (rvRowEl) setupMarquee(rvRowEl, 'rv-static');

  const adminData = document.getElementById('admin-data');
  if (adminData) {

    const tabs = document.getElementById('adminTabs');
    if (tabs) {
      const panels = [...document.querySelectorAll('.admin-panel')];
      const activate = (name) => {
        panels.forEach((p) => { p.hidden = p.dataset.tab !== name; });
        tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
        try { localStorage.setItem('lucidAdminTab', name); } catch (e) {  }
      };
      tabs.querySelectorAll('button').forEach((b) =>
        b.addEventListener('click', () => activate(b.dataset.tab)));
      let initial = 'bookings';
      try { initial = localStorage.getItem('lucidAdminTab') || 'bookings'; } catch (e) {  }
      if (!panels.some((p) => p.dataset.tab === initial)) initial = 'bookings';
      activate(initial);
    }

    const cfg = JSON.parse(adminData.textContent);
    const bookings = JSON.parse(document.getElementById('bookings-data').textContent);
    const avail = new Set(cfg.availability);
    const today = cfg.today;
    const pad = (n) => String(n).padStart(2, '0');
    const isoOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
    const t12 = (t) => { let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${pad(m)} ${ap}`; };
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'];

    const counts = {};
    bookings.forEach((b) => { if (b.date) counts[b.date] = (counts[b.date] || 0) + 1; });

    const grid = document.getElementById('calGrid');
    const label = document.getElementById('calLabel');
    const start0 = new Date(today + 'T00:00:00');
    let viewY = start0.getFullYear(), viewM = start0.getMonth();

    function renderCal() {
      label.textContent = `${MONTHS[viewM]} ${viewY}`;
      document.getElementById('quickMonth').textContent = MONTHS[viewM];
      const firstDow = new Date(viewY, viewM, 1).getDay();
      const days = new Date(viewY, viewM + 1, 0).getDate();
      let html = '';
      for (let i = 0; i < firstDow; i++) html += '<span class="cal-cell empty"></span>';
      for (let d = 1; d <= days; d++) {
        const ds = isoOf(viewY, viewM, d);
        const past = ds < today;
        const cls = ['cal-cell'];
        if (past) cls.push('past');
        if (avail.has(ds)) cls.push('avail');
        if (ds === today) cls.push('is-today');
        const badge = counts[ds] ? `<i class="cal-badge">${counts[ds]}</i>` : '';
        html += `<button type="button" class="${cls.join(' ')}" data-date="${ds}"${past ? ' disabled' : ''}>${d}${badge}</button>`;
      }
      grid.innerHTML = html;
    }
    grid.addEventListener('click', async (e) => {
      const cell = e.target.closest('.cal-cell');
      if (!cell || cell.classList.contains('empty') || cell.disabled) return;
      const ds = cell.dataset.date;
      cell.classList.toggle('avail');
      try {
        const r = await fetch('/admin/availability/toggle', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ date: ds }),
        });
        const d = await r.json();
        if (!d.ok) { cell.classList.toggle('avail'); return; }
        if (d.active) avail.add(ds); else avail.delete(ds);
      } catch (_) { cell.classList.toggle('avail'); }
    });
    document.getElementById('calPrev').addEventListener('click', () => { if (--viewM < 0) { viewM = 11; viewY--; } renderCal(); });
    document.getElementById('calNext').addEventListener('click', () => { if (++viewM > 11) { viewM = 0; viewY++; } renderCal(); });

    async function bulkAvail(list, active) {
      if (!list.length) return;
      await fetch('/admin/availability/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ dates: list.join(','), active: active ? '1' : '0' }),
      });
    }
    document.querySelectorAll('.quick-opts button').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const mode = btn.dataset.quick;
        const days = new Date(viewY, viewM + 1, 0).getDate();
        const add = [], remove = [];
        for (let d = 1; d <= days; d++) {
          const ds = isoOf(viewY, viewM, d);
          if (ds < today) continue;
          const dow = new Date(viewY, viewM, d).getDay();
          if (mode === 'clear') { if (avail.has(ds)) remove.push(ds); }
          else if (mode === 'all') add.push(ds);
          else if (mode === 'weekdays') { if (dow >= 1 && dow <= 5) add.push(ds); }
          else if (mode === 'weekends') { if (dow === 0 || dow === 6) add.push(ds); }
        }
        await bulkAvail(add, true); await bulkAvail(remove, false);
        add.forEach((d) => avail.add(d)); remove.forEach((d) => avail.delete(d));
        renderCal();
      });
    });

    const tsStart = document.getElementById('tsStart'), tsEnd = document.getElementById('tsEnd'),
      tsMins = document.getElementById('tsMins'), tsPrev = document.getElementById('tsPreview');
    for (let h = 0; h <= 23; h++) tsStart.add(new Option(t12(pad(h) + ':00'), h));
    for (let h = 1; h <= 24; h++) tsEnd.add(new Option(h === 24 ? '12:00 AM' : t12(pad(h) + ':00'), h));
    tsStart.value = cfg.slotStart; tsEnd.value = cfg.slotEnd; tsMins.value = cfg.buffer;
    function showPreview() {
      const o = t12(pad(+tsStart.value) + ':00');
      const cl = (+tsEnd.value === 24) ? '12:00 AM' : t12(pad(+tsEnd.value) + ':00');
      tsPrev.textContent = `Open ${o} – ${cl} · ${tsMins.value} min travel buffer between jobs.`;
    }
    [tsStart, tsEnd, tsMins].forEach((s) => s.addEventListener('change', showPreview));
    showPreview();
    document.getElementById('tsSave').addEventListener('click', async () => {
      const btn = document.getElementById('tsSave');
      const r = await fetch('/admin/availability/hours', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ start: tsStart.value, end: tsEnd.value, buffer: tsMins.value }),
      });
      const d = await r.json();
      btn.textContent = d.ok ? 'Saved ✓' : (d.error || 'Error');
      setTimeout(() => { btn.textContent = 'Save hours'; }, 1600);
    });

    const cards = [...document.querySelectorAll('.booking-card')];
    const filterEmpty = document.getElementById('filterEmpty');
    const plusDays = (n) => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() + n); return isoOf(d.getFullYear(), d.getMonth(), d.getDate()); };
    function applyFilter(mode) {
      const weekEnd = plusDays(6);
      let shown = 0;
      cards.forEach((c) => {
        const d = c.dataset.date;
        let ok = mode === 'all';
        if (d && mode === 'today') ok = d === today;
        else if (d && mode === 'week') ok = d >= today && d <= weekEnd;
        else if (d && mode === 'upcoming') ok = d >= today;
        c.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      if (filterEmpty) filterEmpty.hidden = shown > 0 || !cards.length;
    }
    document.querySelectorAll('#filters button').forEach((b) =>
      b.addEventListener('click', () => {
        document.querySelectorAll('#filters button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active'); applyFilter(b.dataset.filter);
      }));
    applyFilter('all');

    const confirmModal = document.getElementById('confirmModal');
    const confirmText = document.getElementById('confirmText');
    let pending = null;
    const askConfirm = (text, url, onOk) => {
      confirmText.textContent = text; pending = { url, onOk }; confirmModal.hidden = false;
    };
    const closeConfirm = () => { confirmModal.hidden = true; pending = null; };
    confirmModal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeConfirm));
    document.getElementById('confirmDelete').addEventListener('click', async () => {
      if (!pending) return;
      const r = await fetch(pending.url, { method: 'POST' });
      if ((await r.json()).ok && pending.onOk) pending.onOk();
      closeConfirm();
    });

    document.querySelectorAll('.del-btn').forEach((b) =>
      b.addEventListener('click', () => {
        const card = b.closest('.booking-card');
        askConfirm(`Delete the booking for ${card.querySelector('h3').textContent}? This can't be undone.`,
          `/admin/booking/${b.dataset.id}/delete`, () => card.remove());
      }));

    const editModal = document.getElementById('editModal');
    const byId = Object.fromEntries(bookings.map((b) => [b.id, b]));
    const $ = (id) => document.getElementById(id);
    const edAddr = $('ed_address');
    function openEdit(id) {
      const b = byId[id]; if (!b) return;
      $('editId').value = b.id;
      $('ed_name').value = b.name; $('ed_phone').value = b.phone; $('ed_email').value = b.email;
      $('ed_car').value = b.car; edAddr.value = b.address; $('ed_size').value = b.size;
      $('ed_service').value = b.service; $('ed_date').value = b.date; $('ed_time').value = b.time;
      $('ed_info').value = b.info;
      $('editResult').hidden = true;
      editModal.hidden = false;
    }
    document.querySelectorAll('.edit-btn').forEach((b) =>
      b.addEventListener('click', () => openEdit(+b.dataset.id)));
    editModal.querySelectorAll('[data-close]').forEach((el) =>
      el.addEventListener('click', () => { editModal.hidden = true; }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { editModal.hidden = true; if (confirmModal) closeConfirm(); }
    });
    attachAutocomplete(edAddr);
    $('editForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = $('editId').value;
      const res = $('editResult');
      res.hidden = false; res.className = 'travel-result'; res.textContent = 'Saving…';
      const r = await fetch(`/admin/booking/${id}/update`, {
        method: 'POST', body: new URLSearchParams(new FormData(e.target)),
      });
      const d = await r.json();
      if (d.ok) { location.reload(); }
      else { res.classList.add('err'); res.textContent = d.error || 'Error saving.'; }
    });

    document.querySelectorAll('.gi-del').forEach((b) =>
      b.addEventListener('click', async () => {
        const r = await fetch(`/admin/gallery/${b.dataset.id}/delete`, { method: 'POST' });
        if ((await r.json()).ok) b.closest('.gallery-item').remove();
      }));

    document.querySelectorAll('.rv-del').forEach((b) =>
      b.addEventListener('click', async () => {
        const r = await fetch(`/admin/review/${b.dataset.id}/delete`, { method: 'POST' });
        if ((await r.json()).ok) b.closest('.review-card').remove();
      }));

    const rvGrid = document.getElementById('rvGrid');
    if (rvGrid) {
      const rvLabel = document.getElementById('rvLabel');
      const rvDate = document.getElementById('rvDate');
      let vy = start0.getFullYear(), vm = start0.getMonth();
      let selected = cfg.today;
      rvDate.value = selected;
      function rvRender() {
        rvLabel.textContent = `${MONTHS[vm]} ${vy}`;
        const first = new Date(vy, vm, 1).getDay();
        const days = new Date(vy, vm + 1, 0).getDate();
        let html = '';
        for (let i = 0; i < first; i++) html += '<span class="cal-cell empty"></span>';
        for (let d = 1; d <= days; d++) {
          const ds = isoOf(vy, vm, d);
          const future = ds > cfg.today;
          const cls = ['cal-cell'];
          if (future) cls.push('disabled');
          if (ds === selected) cls.push('sel');
          if (ds === cfg.today) cls.push('is-today');
          html += `<button type="button" class="${cls.join(' ')}" data-date="${ds}"${future ? ' disabled' : ''}>${d}</button>`;
        }
        rvGrid.innerHTML = html;
      }
      rvGrid.addEventListener('click', (e) => {
        const c = e.target.closest('.cal-cell');
        if (!c || c.disabled || c.classList.contains('empty')) return;
        selected = c.dataset.date; rvDate.value = selected; rvRender();
      });
      document.getElementById('rvPrev').addEventListener('click', () => { if (--vm < 0) { vm = 11; vy--; } rvRender(); });
      document.getElementById('rvNext').addEventListener('click', () => { if (++vm > 11) { vm = 0; vy++; } rvRender(); });
      rvRender();
    }

    const custModal = document.getElementById('customerModal');
    if (custModal) {
      const customers = JSON.parse(document.getElementById('customers-data').textContent);
      const servicesMap = JSON.parse(document.getElementById('services-data').textContent);
      const byCust = Object.fromEntries(customers.map((c) => [c.id, c]));
      const bookingsByEmail = {};
      bookings.forEach((b) => {
        const k = (b.email || '').toLowerCase();
        (bookingsByEmail[k] = bookingsByEmail[k] || []).push(b);
      });
      const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g,
        (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
      const money = (n) => '$' + (n % 1 === 0 ? n : n.toFixed(2));
      const gid = (x) => document.getElementById(x);
      const custView = gid('custView'), custForm = gid('custForm'), custResult = gid('custResult');
      const cbModal = gid('custBookingsModal'), cbList = gid('cbList');
      let curCust = null;

      const detRow = (k, v) => `<li><span>${k}</span><strong>${esc(v) || '—'}</strong></li>`;
      function openCustomer(id) {
        const c = byCust[id]; if (!c) return;
        curCust = c;
        gid('custName').textContent = c.name || 'Unnamed';
        const n = (bookingsByEmail[(c.email || '').toLowerCase()] || []).length;
        gid('custDetails').innerHTML =
          detRow('Phone', c.phone) + detRow('Email', c.email) + detRow('Address', c.address) +
          detRow('Vehicle', c.car) + detRow('Notes', c.notes) + detRow('Customer since', c.created) +
          detRow('Bookings', n);
        custForm.hidden = true; custView.hidden = false; custResult.hidden = true;
        custModal.hidden = false;
      }
      document.querySelectorAll('.cust-row').forEach((r) =>
        r.addEventListener('click', () => openCustomer(+r.dataset.id)));

      gid('custEditBtn').addEventListener('click', () => {
        if (!curCust) return;
        gid('cu_name').value = curCust.name || ''; gid('cu_phone').value = curCust.phone || '';
        gid('cu_email').value = curCust.email || ''; gid('cu_car').value = curCust.car || '';
        gid('cu_address').value = curCust.address || ''; gid('cu_notes').value = curCust.notes || '';
        custView.hidden = true; custForm.hidden = false;
      });
      gid('custCancel').addEventListener('click', () => { custForm.hidden = true; custView.hidden = false; });
      attachAutocomplete(gid('cu_address'));
      custForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        custResult.hidden = false; custResult.className = 'travel-result'; custResult.textContent = 'Saving…';
        const r = await fetch(`/admin/customer/${curCust.id}/update`, {
          method: 'POST', body: new URLSearchParams(new FormData(custForm)),
        });
        const d = await r.json();
        if (d.ok) location.reload();
        else { custResult.classList.add('err'); custResult.textContent = d.error || 'Error saving.'; }
      });
      gid('custDelBtn').addEventListener('click', () => {
        if (!curCust) return;
        askConfirm(`Delete customer ${curCust.name || curCust.email}? This removes their profile (past bookings stay).`,
          `/admin/customer/${curCust.id}/delete`, () => location.reload());
      });

      gid('custViewBookings').addEventListener('click', () => {
        if (!curCust) return;
        gid('cbName').textContent = curCust.name || curCust.email;
        const list = bookingsByEmail[(curCust.email || '').toLowerCase()] || [];
        cbList.innerHTML = list.length ? list.map((b) => {
          const svc = (servicesMap[b.service] && servicesMap[b.service].label) || b.service;
          const when = (b.date || 'TBD') + (b.time ? ' · ' + b.time : '');
          return `<div class="cb-row"><div class="cb-info"><strong>${esc(when)}</strong><span>${esc(svc)}</span></div>
            <div class="cb-right"><span class="cb-price">${money((b.price || 0) + (b.travel_fee || 0))}</span>
            <button type="button" class="btn btn-ghost btn-sm cb-edit" data-id="${b.id}">Edit</button></div></div>`;
        }).join('') : '<p class="empty-note">No bookings on file.</p>';
        cbModal.hidden = false;
      });
      cbList.addEventListener('click', (e) => {
        const b = e.target.closest('.cb-edit');
        if (b) openEdit(+b.dataset.id);
      });

      custModal.querySelectorAll('[data-cclose]').forEach((el) =>
        el.addEventListener('click', () => { custModal.hidden = true; }));
      cbModal.querySelectorAll('[data-bclose]').forEach((el) =>
        el.addEventListener('click', () => { cbModal.hidden = true; }));
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { custModal.hidden = true; cbModal.hidden = true; }
      });
    }

    renderCal();
  }

  const toggle = document.getElementById('navToggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    const close = () => { links.classList.remove('open'); toggle.classList.remove('active'); };
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      toggle.classList.toggle('active');
    });
    links.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  }
})();
