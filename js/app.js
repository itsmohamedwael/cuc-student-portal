/* CUC Student Portal */
(() => {
  'use strict';
  const D = window.ACADEMIC_DATA;
  if (!D) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = motionPreference.matches;
  motionPreference.addEventListener('change', (e) => {
    reduce = e.matches;
    if (reduce) document.getAnimations().forEach((a) => a.cancel());
  });
  const EASE = 'cubic-bezier(.16,1,.3,1)';
  const anim = (el, kf, o = {}) => {
    if (!el || reduce || !el.animate) return Promise.resolve();
    return el.animate(kf, { duration: o.d || 700, delay: o.delay || 0, easing: o.e || EASE, fill: 'both' }).finished.catch(() => {});
  };

  const KEY_USER = 'cucsp_user', KEY_THEME = 'cucsp_theme', KEY_EXAM = 'cucsp_exam_view';
  const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  const JS_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const EXAM_WINDOW = [new Date(2026, 10, 6, 0, 0), new Date(2026, 10, 14, 23, 59)];

  const state = { user: null, view: 'home', day: null, examView: true, openSubject: null };

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt12 = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`; };
  const ampm = (t) => (Number(t.split(':')[0]) >= 12 ? 'PM' : 'AM');
  const fmtRange = (s, e) => (ampm(s) === ampm(e) ? `${fmt12(s)} – ${fmt12(e)} ${ampm(e)}` : `${fmt12(s)} ${ampm(s)} – ${fmt12(e)} ${ampm(e)}`);
  const mins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const hallInfo = (r) => {
    if (r === 'Not listed') return 'Check with the exams office';
    if (!r || r === 'ONLINE') return 'Online session';
    const m = /B(\d)-(\d)/.exec(r);
    return m ? `Building ${m[1]} · Floor ${m[2]}` : r;
  };
  const roomText = (r) => (!r || r === 'ONLINE' ? 'Online' : r);
  const inWindow = (d = new Date()) => d >= EXAM_WINDOW[0] && d <= EXAM_WINDOW[1];
  const examViewOn = () => inWindow() && state.examView;

  function toAsciiDigits(str) {
    return String(str || '')
      .replace(/[٠۰]/g, '0')
      .replace(/[١۱]/g, '1')
      .replace(/[٢۲]/g, '2')
      .replace(/[٣۳]/g, '3')
      .replace(/[٤۴]/g, '4')
      .replace(/[٥۵]/g, '5')
      .replace(/[٦۶]/g, '6')
      .replace(/[٧۷]/g, '7')
      .replace(/[٨۸]/g, '8')
      .replace(/[٩۹]/g, '9');
  }

  function normalizeArabic(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآء]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\s\-_]+/g, ' ')
      .trim();
  }

  /* Smart Arabic compound-name splitter (preserves عبد الملك, نور الدين, لي لي, ربيع الانوار, سيف الله, etc.) */
  const COMPOUND_PREFIXES = new Set(['عبد', 'ابو', 'ام', 'ابن', 'بنت', 'ذو']);
  const COMPOUND_SUFFIXES = new Set(['الدين', 'الله', 'الرحمن', 'الاسلام', 'الانوار', 'الحق', 'الفاروق', 'المسيح', 'الزهراء', 'الهدي']);

  function takeNameUnit(words, idx) {
    if (idx >= words.length) return ['', idx];
    const w0 = words[idx];
    const w1 = words[idx + 1];
    if (w1) {
      const n0 = normalizeArabic(w0);
      const n1 = normalizeArabic(w1);
      if (COMPOUND_PREFIXES.has(n0) || COMPOUND_SUFFIXES.has(n1) || w0 === w1) {
        return [`${w0} ${w1}`, idx + 2];
      }
    }
    return [w0, idx + 1];
  }

  function givenName(fullName) {
    const clean = String(fullName || '').trim().replace(/\s+/g, ' ');
    if (!clean) return '';
    return takeNameUnit(clean.split(' '), 0)[0];
  }

  function shortName(fullName) {
    const clean = String(fullName || '').trim().replace(/\s+/g, ' ');
    if (!clean) return '';
    const words = clean.split(' ');
    const [first, nextIdx] = takeNameUnit(words, 0);
    const [second] = takeNameUnit(words, nextIdx);
    return second ? `${first} ${second}` : first;
  }

  const sessionsFor = (g) => D.weekly_sessions.filter((s) => s.group === g);

  function examsFor(g) {
    const id = Number(state.user.id);
    const now = new Date();
    return D.subjects.map((s) => {
      const [dd, mm, yy] = s.exam_date.split('/').map(Number);
      const start = new Date(yy, mm - 1, dd, 10, 0);
      const end = new Date(yy, mm - 1, dd, 11, 0);
      const rawHalls = D.exam_seating
        .filter((e) => e.group_number === g && e.course_code === s.code)
        .map((a, idx) => {
          const fromId = Number(a.from_student);
          const toId = Number(a.to_student);
          const exactMatch = a.from_student === 'All' || (id >= fromId && id <= toId);
          return {
            ...a,
            hallNum: idx + 1,
            label: `Hall ${idx + 1}`,
            isMine: exactMatch,
            isFallback: false
          };
        });

      let myHall = rawHalls.find((h) => h.isMine) || null;
      if (!myHall && rawHalls.length) {
        let best = rawHalls[0], bestDist = Infinity;
        for (const h of rawHalls) {
          const f = Number(h.from_student), t = Number(h.to_student);
          const dist = id < f ? f - id : id > t ? id - t : 0;
          if (dist < bestDist) { bestDist = dist; best = h; }
        }
        myHall = best;
        myHall.isMine = true;
        myHall.isFallback = true;
      }

      // Always lock the student's assigned hall in the primary (first) slot so its position never shifts across rows
      const orderedHalls = myHall
        ? [myHall, ...rawHalls.filter((h) => h !== myHall)]
        : rawHalls;

      return {
        ...s,
        start,
        end,
        isPast: now >= end,
        isLive: now >= start && now < end,
        hall: myHall ? myHall.hall : 'Not listed',
        seats: rawHalls.length > 1 && myHall ? `Seat range ${myHall.from_student} – ${myHall.to_student}` : '',
        allHalls: orderedHalls,
        myHall
      };
    }).sort((a, b) => a.start - b.start);
  }

  const dateParts = (d) => ({
    day: d.getDate(),
    mon: MONTHS[d.getMonth()],
    wd: JS_DAY[d.getDay()]
  });

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function lines(root) {
    $$('.ln > span', root).forEach((s) => { s.style.animation = 'none'; void s.offsetWidth; s.style.animation = ''; });
  }

  function reveal(el) {
    el.classList.add('in');
  }
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } }), { threshold: 0.08, rootMargin: '0px 0px -24px 0px' })
    : null;
  function watch(root) {
    $$('[data-reveal]', root).forEach((el, i) => {
      if (!el.style.getPropertyValue('--i')) el.style.setProperty('--i', Math.min(i, 10));
      if (io) io.observe(el); else reveal(el);
    });
  }

  /* ---------- theme ---------- */
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(KEY_THEME, t); } catch (e) {}
    const m = $('meta[name="theme-color"]');
    if (m) m.content = t === 'dark' ? '#0C0C0C' : '#F7F7F5';
  }
  $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  }));

  /* ---------- renderers ---------- */
  function sessionRow(s, nowMin) {
    const live = nowMin != null && nowMin >= mins(s.start_time) && nowMin < mins(s.end_time);
    const who = [s.instructor, ...(s.assistants || [])].filter(Boolean).join(', ');
    return `<li class="row${live ? ' now' : ''}" data-reveal>
      <div class="r-time"><b>${fmt12(s.start_time)}</b><span>to ${fmt12(s.end_time)} ${ampm(s.end_time)}</span></div>
      <div class="r-main"><h3>${esc(s.course_title)}</h3><p><span class="tag">${esc(s.session_type)}</span>${esc(who)}</p></div>
      <div class="r-room">${esc(roomText(s.room))}<small>${s.room === 'ONLINE' ? '' : esc(hallInfo(s.room))}</small></div>
    </li>`;
  }

  function examRow(e, detailed, nextCode) {
    const p = dateParts(e.start);
    const isNext = e.code === nextCode;
    const statusBadge = e.isLive
      ? '<span class="r-status">Now</span>'
      : isNext
        ? '<span class="r-status">Next</span>'
        : e.isPast
          ? '<span class="r-status">Done</span>'
          : '';

    const hallsHtml = (e.allHalls && e.allHalls.length > 0)
      ? `<div class="r-halls">
          ${e.allHalls.map((h) => {
            const countText = h.num_students ? `${h.label} · ${h.num_students} std` : h.label;
            const pillText = h.isMine ? (h.isFallback ? 'Nearest Hall' : 'Your Hall') : 'Other Hall';
            const cls = h.isMine
              ? `hall-badge my-hall${h.isFallback ? ' verify-hall' : ''}`
              : 'hall-badge other-hall';
            return `<div class="${cls}">
              <div class="hb-head">
                <span class="hb-pill">${pillText}</span>
                <span class="hb-count">${esc(countText)}</span>
              </div>
              <div class="hb-hall">${esc(h.hall)}</div>
              ${detailed ? `<div class="hb-sub">${esc(hallInfo(h.hall))}</div>` : ''}
              <div class="hb-range">${esc(h.from_student)} – ${esc(h.to_student)}</div>
              ${h.isMine && h.isFallback ? '<div class="hb-note">ID outside printed range · confirm with proctor</div>' : ''}
            </div>`;
          }).join('')}
        </div>`
      : `<div class="r-room">${esc(e.hall)}<small>${esc(hallInfo(e.hall))}</small></div>`;

    const rowCls = `row exam-row${e.isPast ? ' past' : ''}${isNext ? ' up-next' : ''}`;
    return `<li class="${rowCls}" data-reveal>
      <div class="r-date"><b>${p.day} ${p.mon}</b><span>${p.wd}, 10:00 AM</span>${statusBadge}</div>
      <div class="r-main">
        <h3>${esc(e.name)}</h3>
        <p>${esc(e.code)}${detailed ? ' · 1 hour · Group 9' : ''}</p>
        ${detailed ? `<span class="ar" lang="ar">${esc(e.arabic_name)}</span>` : ''}
      </div>
      ${hallsHtml}
    </li>`;
  }

  function nextClass(g) {
    const now = new Date();
    const list = sessionsFor(g);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (let off = 0; off < 7; off++) {
      const dayName = JS_DAY[(now.getDay() + off) % 7];
      const ds = list.filter((s) => s.day === dayName).sort((a, b) => mins(a.start_time) - mins(b.start_time));
      for (const s of ds) {
        if (off === 0 && nowMin >= mins(s.end_time)) continue;
        const live = off === 0 && nowMin >= mins(s.start_time);
        return { s, off, live, dayName };
      }
    }
    return null;
  }

  function greeting() {
    const h = new Date().getHours();
    return h < 5 ? 'Still up,' : h < 12 ? 'Good morning,' : h < 18 ? 'Good afternoon,' : 'Good evening,';
  }

  function countdownText(start, end) {
    const now = new Date();
    if (now >= end) return 'Finished';
    if (now >= start) return 'In progress';
    let m = Math.round((start - now) / 60000);
    const d = Math.floor(m / 1440); m -= d * 1440;
    const h = Math.floor(m / 60); m -= h * 60;
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
  }

  function nextExam(g) {
    const now = new Date();
    return examsFor(g).find((e) => e.end > now) || null;
  }

  function renderHome() {
    const u = state.user, g = u.group;
    const root = $('#v-home');
    let hero = '', body = '';

    const allEx = examsFor(g);
    const ne = examViewOn() ? (allEx.find((e) => !e.isPast) || null) : null;
    if (ne) {
      const p = dateParts(ne.start);
      const subHallInfo = ne.myHall && ne.myHall.isFallback
        ? `${hallInfo(ne.hall)} · Confirm with proctor`
        : hallInfo(ne.hall);
      hero = `<article class="hero" data-reveal>
        <p class="kicker"><i class="dot live"></i>${ne.isLive ? 'Exam in progress' : 'Next exam'}</p>
        <h2 class="hero-title">${esc(ne.name)}</h2>
        <p class="hero-ar" lang="ar">${esc(ne.arabic_name)}</p>
        <div class="hero-grid">
          <div><span class="lbl">${ne.myHall && ne.myHall.isFallback ? 'Nearest hall' : 'Your hall'}</span><strong class="room" id="heroRoom">${esc(ne.hall)}</strong><span>${esc(subHallInfo)}</span></div>
          <div><span class="lbl">When</span><strong>${p.wd.slice(0, 3)} ${p.day} ${p.mon}</strong><span>10:00 – 11:00 AM</span></div>
          <div><span class="lbl">${ne.isLive ? 'Status' : 'Starts in'}</span><strong id="countdown">${countdownText(ne.start, ne.end)}</strong><span>${esc(ne.code)}</span></div>
        </div></article>`;
      body = `<div class="sec-head"><h2>The exam week</h2><a href="#/exams">All details</a></div>
        <ul class="rows">${allEx.map((e) => examRow(e, false, ne.code)).join('')}</ul>`;
    } else {
      const nc = nextClass(g);
      const now = new Date();
      if (nc) {
        const s = nc.s;
        const kick = nc.live ? 'Happening now' : nc.off === 0 ? 'Up next today' : nc.off === 1 ? 'Tomorrow' : `Next class · ${nc.dayName}`;
        hero = `<article class="hero" data-reveal>
          <p class="kicker"><i class="dot${nc.live ? ' live' : ''}"></i>${kick}</p>
          <h2 class="hero-title">${esc(s.course_title)}</h2>
          <p class="hero-ar" lang="ar">${esc(s.course_arabic)}</p>
          <div class="hero-grid">
            <div><span class="lbl">Room</span><strong class="room" id="heroRoom">${esc(roomText(s.room))}</strong><span>${esc(hallInfo(s.room))}</span></div>
            <div><span class="lbl">Time</span><strong>${fmtRange(s.start_time, s.end_time)}</strong><span>${esc(s.day)}</span></div>
            <div><span class="lbl">${esc(s.session_type)}</span><strong>${esc(s.course_code)}</strong><span>${esc(s.instructor || '')}</span></div>
          </div></article>`;
      } else {
        hero = `<article class="hero quiet" data-reveal><p class="kicker">Nothing scheduled</p><h2 class="hero-title">No upcoming classes for your group.</h2></article>`;
      }
      const dayName = JS_DAY[now.getDay()];
      const today = sessionsFor(g).filter((s) => s.day === dayName).sort((a, b) => mins(a.start_time) - mins(b.start_time));
      const nowMin = now.getHours() * 60 + now.getMinutes();
      body = `<div class="sec-head"><h2>Today, ${dayName}</h2><a href="#/week">Full week</a></div>` +
        (today.length ? `<ul class="rows">${today.map((s) => sessionRow(s, nowMin)).join('')}</ul>`
          : `<p class="empty">${dayName === 'Friday' ? 'Friday is a day off.' : 'No classes today.'} Enjoy it.</p>`);
    }

    const gName = givenName(u.name);
    const headingHtml = gName
      ? `<h1 class="h1"><span class="ln"><span>${greeting()}</span></span><span class="ln"><span><em class="name" dir="rtl" lang="ar">${esc(gName)}</em></span></span></h1>`
      : `<h1 class="h1"><span class="ln"><span>${greeting().replace(/,$/, '.')}</span></span></h1>`;

    root.innerHTML = `
      <p class="kicker" data-reveal>Group ${g}${gName ? '' : ` · ID ${esc(u.id)}`}</p>
      ${headingHtml}
      ${hero}${body}`;
  }

  function renderWeek() {
    const g = state.user.group, list = sessionsFor(g);
    const root = $('#v-week');
    const todayName = JS_DAY[new Date().getDay()];
    if (!state.day) state.day = DAYS.includes(todayName) && list.some((s) => s.day === todayName) ? todayName : (DAYS.find((d) => list.some((s) => s.day === d)) || DAYS[0]);
    root.innerHTML = `
      <p class="kicker" data-reveal>Group ${g} · Regular timetable</p>
      <h1 class="h1"><span class="ln"><span>Your</span></span><span class="ln"><span><em>week.</em></span></span></h1>
      ${examViewOn() ? '<p class="lead">Classes are paused during the midterm exams and resume on Sunday, 15 November.</p>' : ''}
      <div class="seg" id="seg" role="tablist"><i class="seg-thumb" id="segThumb"></i>
        ${DAYS.map((d) => `<button type="button" role="tab" data-day="${d}" class="${list.some((s) => s.day === d) ? '' : 'free'}">${d.slice(0, 3)}</button>`).join('')}
      </div>
      <ul class="rows week-list" id="weekList" role="tabpanel" aria-label="Daily classes"></ul>`;
    $$('#seg button').forEach((b) => b.addEventListener('click', () => { state.day = b.dataset.day; paintDay(true); }));
    $('#seg').addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const index = DAYS.indexOf(state.day);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? DAYS.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + DAYS.length) % DAYS.length;
      state.day = DAYS[next];
      paintDay(true);
      $('#seg button.on').focus({ preventScroll: true });
    });
    paintDay(false);
  }

  function paintDay(animate) {
    const g = state.user.group;
    const list = sessionsFor(g).filter((s) => s.day === state.day).sort((a, b) => mins(a.start_time) - mins(b.start_time));
    $$('#seg button').forEach((b) => { const on = b.dataset.day === state.day; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    positionDayThumb();
    $('#seg button.on').scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    const ul = $('#weekList');
    ul.innerHTML = list.length ? list.map((s) => sessionRow(s, null)).join('') : `<li class="empty">No classes on ${state.day}.</li>`;
    if (animate) {
      $$('li', ul).forEach((li, i) => { reveal(li); anim(li, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { d: 400, delay: i * 40 }); });
    } else watch(ul);
  }

  function renderExams() {
    const u = state.user, g = u.group, ex = examsFor(g);
    const ne = ex.find((e) => !e.isPast);
    const metaLabel = u.name
      ? `<span dir="rtl" lang="ar">${esc(u.name)}</span> · Student ID ${esc(u.id)} · Group ${g}`
      : `Student ID ${esc(u.id)} · Group ${g}`;
    $('#v-exams').innerHTML = `
      <p class="kicker" data-reveal>Group ${g} · Midterms</p>
      <h1 class="h1"><span class="ln"><span>Exam</span></span><span class="ln"><span><em>halls.</em></span></span></h1>
      <p class="lead">Seven exams, one hour each, all starting at 10:00 AM. Your assigned hall is always highlighted first, alongside the other Group 9 hall.</p>
      <div class="actions"><button class="btn solid" id="btnIcs" type="button">Add to calendar</button><button class="btn" id="btnPrint" type="button">Print slip</button></div>
      <ul class="rows exam-list">${ex.map((e) => examRow(e, true, ne ? ne.code : null)).join('')}</ul>
      <p class="exam-meta">${metaLabel}</p>`;
    $('#btnIcs').addEventListener('click', downloadIcs);
    $('#btnPrint').addEventListener('click', () => window.print());
  }

  function renderSubjects() {
    const g = state.user.group, list = sessionsFor(g), ex = examsFor(g);
    const subs = D.subjects.filter((s) => list.some((x) => x.course_code === s.code));
    $('#v-subjects').innerHTML = `
      <p class="kicker" data-reveal>Group ${g} · First term</p>
      <h1 class="h1"><span class="ln"><span>Your</span></span><span class="ln"><span><em>subjects.</em></span></span></h1>
      <div class="subject-list">${subs.map((s) => {
        const sess = list.filter((x) => x.course_code === s.code).sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || mins(a.start_time) - mins(b.start_time));
        const e = ex.find((x) => x.code === s.code);
        return `<div class="acc${state.openSubject === s.code ? ' open' : ''}" id="sub-${s.code}" data-reveal>
          <button class="acc-h" type="button" aria-expanded="${state.openSubject === s.code}">
            <span class="code">${esc(s.code)}</span>
            <div><h3>${esc(s.name)}</h3><span class="ar" lang="ar">${esc(s.arabic_name)}</span></div>
            <span class="plus"></span>
          </button>
          <div class="acc-b"><div><div class="acc-in">
            <p class="desc">${esc(s.description)}</p>
            ${sess.map((x) => `<div class="mini"><span>${esc(x.day)}</span><div>${fmtRange(x.start_time, x.end_time)} · ${esc(x.session_type)}${x.instructor ? ' · ' + esc(x.instructor) : ''}</div><b>${esc(roomText(x.room))}</b></div>`).join('')}
            ${e ? `<div class="mini"><span>Midterm</span><div>${dateParts(e.start).wd}, ${dateParts(e.start).day} ${dateParts(e.start).mon} · 10:00 AM</div><div class="sub-halls">${(e.allHalls || []).map((h) => `<span class="sh-badge${h.isMine ? ' my' : ' other'}">${h.isMine ? `<span class="sh-pill">${h.isFallback ? 'Nearest hall' : 'Your hall'}</span>` : `<span>${esc(h.label)}</span>`}<b>${esc(h.hall)}</b><span>${esc(h.from_student)} – ${esc(h.to_student)}</span></span>`).join('')}</div></div>` : ''}
          </div></div></div>
        </div>`;
      }).join('')}</div>`;
    $$('#v-subjects .acc-h').forEach((h) => h.addEventListener('click', () => {
      const a = h.parentElement, open = !a.classList.contains('open');
      $$('#v-subjects .acc').forEach((x) => { x.classList.remove('open'); $('.acc-h', x).setAttribute('aria-expanded', 'false'); });
      state.openSubject = null;
      if (open) { a.classList.add('open'); h.setAttribute('aria-expanded', 'true'); state.openSubject = a.id.slice(4); }
    }));
  }

  const NOTICES = [
    { d: '7–14 Nov', t: 'Group 9 Midterm exams in progress', p: 'All seven Group 9 midterm exams start at 10:00 AM and run for one hour. Check your assigned hall for each subject before heading to Building 2.', a: ['exams', 'Open my exam halls'] },
    { d: 'Fri, 6 Nov', t: 'Official dual-hall seating verified', p: 'Each exam splits Group 9 across two Building 2 halls by Student ID range. Your assigned hall is pinned in the first column on every exam row.' },
    { d: 'Fri, 6 Nov', t: 'Classes resume on Sunday, 15 November', p: 'After Engineering Drawing (MEC111) on Saturday, 14 November, the portal automatically switches back to your regular weekly timetable.' },
    { d: 'Thu, 5 Nov', t: 'Complete Group 9 student roster active', p: 'Sign in with your 11-digit CUC Student ID to view your verified name, weekly classes, and exact midterm hall assignments.' }
  ];
  function renderUpdates() {
    $('#v-updates').innerHTML = `
      <p class="kicker" data-reveal>Latest</p>
      <h1 class="h1"><span class="ln"><span>Recent</span></span><span class="ln"><span><em>updates.</em></span></span></h1>
      <div class="notice-list">${NOTICES.map((n) => `<article class="note" data-reveal><time>${esc(n.d)}</time><div><h3>${esc(n.t)}</h3><p>${esc(n.p)}</p>${n.a ? `<a class="link" href="#/${n.a[0]}">${esc(n.a[1])}</a>` : ''}</div></article>`).join('')}</div>`;
  }

  const RENDER = { home: renderHome, week: renderWeek, exams: renderExams, subjects: renderSubjects, updates: renderUpdates };

  /* ---------- calendar export ---------- */
  function downloadIcs() {
    const pad2 = (n) => String(n).padStart(2, '0');
    const localCal = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
    const utcStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const tzBlock = [
      'BEGIN:VTIMEZONE',
      'TZID:Africa/Cairo',
      'BEGIN:STANDARD',
      'DTSTART:20261030T000000',
      'TZOFFSETFROM:+0300',
      'TZOFFSETTO:+0200',
      'TZNAME:EET',
      'END:STANDARD',
      'END:VTIMEZONE'
    ].join('\r\n');
    const ev = examsFor(state.user.group).map((e) => [
      'BEGIN:VEVENT',
      `UID:${e.code}-${state.user.id}@cucportal`,
      `DTSTAMP:${utcStamp(new Date())}`,
      `DTSTART;TZID=Africa/Cairo:${localCal(e.start)}`,
      `DTEND;TZID=Africa/Cairo:${localCal(e.end)}`,
      `SUMMARY:Midterm - ${e.name}`,
      `LOCATION:Hall ${e.hall} (${hallInfo(e.hall)})`,
      `DESCRIPTION:${e.code} · Group ${state.user.group}${e.seats ? ' · ' + e.seats : ''}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT1H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Exam in one hour',
      'END:VALARM',
      'END:VEVENT'
    ].join('\r\n'));
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CUC Student Portal//EN', 'CALSCALE:GREGORIAN', tzBlock, ...ev, 'END:VCALENDAR'].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cuc-midterm-exams.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Your 7 exams are ready for your calendar');
  }

  /* ---------- views / nav ---------- */
  function moveInk(name) {
    const ink = $('#navInk'), a = $(`#nav a[data-view="${name}"]`);
    $$('#nav a, .menu-links a').forEach((l) => {
      const on = l.dataset.view === name;
      l.classList.toggle('on', on);
      if (on) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current');
    });
    if (a && ink && a.offsetWidth) {
      const padding = parseFloat(getComputedStyle(a).paddingLeft);
      ink.style.width = a.offsetWidth - padding * 2 + 'px';
      ink.style.transform = `translateX(${a.offsetLeft + padding}px)`;
    }
  }

  function show(name, first) {
    if (!RENDER[name]) name = 'home';
    state.view = name;
    $$('.view').forEach((v) => { v.hidden = v.dataset.name !== name; });
    const v = $(`#v-${name}`);
    RENDER[name]();
    moveInk(name);
    window.scrollTo({ top: 0, behavior: 'instant' });
    watch(v);
    lines(v);
    if (!first) anim(v, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { d: 300 });
  }

  function route() {
    const h = (location.hash.replace(/^#\/?/, '') || 'home');
    if (state.user) show(h);
  }
  window.addEventListener('hashchange', () => { closeMenu(); route(); });

  /* ---------- mobile menu ---------- */
  const burger = $('#btnBurger');
  function openMenu() {
    togglePop(false);
    document.body.classList.add('menu-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    $('#menu').inert = false;
    $('#menu').setAttribute('aria-hidden', 'false');
    $('#stage').inert = $('#foot').inert = $('.skip-link').inert = true;
    $('#top > .wordmark').inert = true;
    burger.focus({ preventScroll: true });
  }
  function closeMenu() {
    const wasOpen = document.body.classList.contains('menu-open');
    document.body.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    $('#stage').inert = $('#foot').inert = $('.skip-link').inert = false;
    $('#top > .wordmark').inert = false;
    if (wasOpen) burger.focus({ preventScroll: true });
    $('#menu').inert = true;
    $('#menu').setAttribute('aria-hidden', 'true');
  }
  burger.addEventListener('click', () => (document.body.classList.contains('menu-open') ? closeMenu() : openMenu()));
  $$('#menu .menu-links a').forEach((a) => a.addEventListener('click', () => { if (a.dataset.view === state.view) closeMenu(); }));
  $('#menuSearch').addEventListener('click', () => { closeMenu(); openPalette(); });
  $('#menuOut').addEventListener('click', () => { closeMenu(); signOut(); });
  function positionDayThumb() {
    const on = $('#seg button.on'), th = $('#segThumb');
    if (on && th) {
      th.style.width = on.offsetWidth + 'px';
      th.style.transform = `translateX(${on.offsetLeft}px)`;
    }
  }
  addEventListener('resize', () => { if (innerWidth > 1180) closeMenu(); moveInk(state.view); positionDayThumb(); });
  document.fonts.ready.then(() => { moveInk(state.view); positionDayThumb(); });
  $('.skip-link').addEventListener('click', (e) => { e.preventDefault(); $('#stage').focus(); });

  /* ---------- profile popover ---------- */
  const btnMe = $('#btnMe'), pop = $('#mePop');
  function togglePop(force) {
    const open = force != null ? force : pop.hidden;
    pop.hidden = !open;
    btnMe.setAttribute('aria-expanded', open);
  }
  btnMe.addEventListener('click', (e) => { e.stopPropagation(); togglePop(); });
  document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target)) togglePop(false); });
  $('#btnOut').addEventListener('click', () => { togglePop(false); signOut(); });
  $('#examSwitch').addEventListener('click', () => {
    state.examView = !state.examView;
    try { localStorage.setItem(KEY_EXAM, state.examView ? '1' : '0'); } catch (e) {}
    syncExamSwitch();
    show(state.view, true);
  });
  function syncExamSwitch() {
    const sw = $('#examSwitch');
    sw.hidden = !inWindow();
    sw.setAttribute('aria-checked', state.examView);
    $('#navBadge').hidden = !inWindow();
  }

  /* ---------- search ---------- */
  const pal = $('#palette'), palIn = $('#palInput'), palList = $('#palList');
  let palItems = [], palSel = 0, palReturnFocus;
  function openPalette() {
    closeMenu();
    togglePop(false);
    palReturnFocus = document.activeElement;
    pal.inert = false;
    pal.classList.add('open');
    pal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('pal-open');
    palIn.value = '';
    paintPal('');
    $('#app').inert = true;
    Promise.all(pal.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))).then(() => {
      if (pal.classList.contains('open')) palIn.focus({ preventScroll: true });
    });
  }
  function closePalette() {
    const wasOpen = pal.classList.contains('open');
    pal.classList.remove('open');
    document.body.classList.remove('pal-open');
    $('#app').inert = false;
    if (wasOpen && palReturnFocus?.isConnected) palReturnFocus.focus({ preventScroll: true });
    pal.inert = true;
    pal.setAttribute('aria-hidden', 'true');
  }
  function paintPal(q) {
    const g = state.user.group; q = q.trim().toLowerCase();
    const sess = sessionsFor(g), ex = examsFor(g);
    const items = [];
    D.subjects.forEach((s) => items.push({ t: s.name, s: s.code, k: `${s.name} ${s.code} ${s.arabic_name}`, go: () => { state.openSubject = s.code; location.hash = '#/subjects'; if (state.view === 'subjects') show('subjects'); } }));
    ex.forEach((e) => items.push({ t: `${e.name} exam`, s: `${dateParts(e.start).day} ${dateParts(e.start).mon} · ${e.hall}`, k: `exam midterm ${e.name} ${e.code} ${e.hall}`, go: () => (location.hash = '#/exams') }));
    [...new Set(sess.map((x) => x.room))].forEach((r) => items.push({ t: roomText(r), s: hallInfo(r), k: `room hall ${r} ${hallInfo(r)}`, go: () => (location.hash = '#/week') }));
    palItems = (q ? items.filter((i) => i.k.toLowerCase().includes(q)) : items).slice(0, 8);
    palSel = 0;
    palList.innerHTML = palItems.length ? palItems.map((i, n) => `<li class="${n ? '' : 'sel'}" data-n="${n}"><b>${esc(i.t)}</b><small>${esc(i.s)}</small></li>`).join('') : '<li class="none">Nothing matches that.</li>';
  }
  function pickPal(n) { const it = palItems[n]; if (it) { closePalette(); it.go(); } }
  palIn.addEventListener('input', () => paintPal(palIn.value));
  palList.addEventListener('click', (e) => { const li = e.target.closest('li[data-n]'); if (li) pickPal(+li.dataset.n); });
  palIn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      palSel = (palSel + (e.key === 'ArrowDown' ? 1 : -1) + palItems.length) % Math.max(1, palItems.length);
      $$('#palList li').forEach((li, i) => li.classList.toggle('sel', i === palSel));
      $('#palList li.sel')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    } else if (e.key === 'Enter') { e.preventDefault(); pickPal(palSel); }
  });
  pal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closePalette(); });
  $('#btnSearch').addEventListener('click', openPalette);
  addEventListener('keydown', (e) => {
    if (!state.user) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); pal.classList.contains('open') ? closePalette() : openPalette(); }
    if (e.key === 'Escape') { closePalette(); closeMenu(); togglePop(false); }
    if (e.key === 'Tab') {
      const inPalette = pal.classList.contains('open');
      const inMenu = document.body.classList.contains('menu-open');
      if (!inPalette && !inMenu) return;
      const controls = inPalette ? $$('input,button', pal) : [burger, ...$$('a,button', $('#menu'))];
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- auth ---------- */
  const gate = $('#gate'), form = $('#gateForm'), input = $('#gateInput'), err = $('#gateError'), gateGo = $('#gateGo');
  let gateTimer;

  function makeUser(id, s) {
    return {
      user: {
        id: s.id || id,
        name: s.name || '',
        group: s.group || 9,
        g9: Boolean(s.g9)
      }
    };
  }

  /* Repairs common missing-zero or transposed-zero typos in CUC Student IDs */
  function candidateIds(digits) {
    const out = [digits];
    const add = (v) => { if (v && v !== digits && !out.includes(v)) out.push(v); };
    if (/^260301\d{4}$/.test(digits)) {
      add('2603010' + digits.slice(6));
      if (digits[6] === '1') add('26030110' + digits.slice(7));
    }
    if (/^260301\d{3}$/.test(digits)) add('26030100' + digits.slice(6));
    if (/^26031[01]\d{4}$/.test(digits)) add('260301' + digits.slice(5));
    if (/^26301[01]\d{4}$/.test(digits)) add('260301' + digits.slice(5));
    if (/^260301000\d{3}$/.test(digits)) add('26030100' + digits.slice(9));
    if (/^25030[12]0\d{4}$/.test(digits)) add(digits.slice(0, 6) + digits.slice(7));
    if (/^25030[12]\d{3}$/.test(digits)) add(digits.slice(0, 6) + '0' + digits.slice(6));
    return out;
  }

  function isValidCucIdFormat(id) {
    return /^260301(?:0\d{4}|10\d{3})$/.test(id) || /^2[3-5]030[12]\d{4}$/.test(id);
  }

  function lookup(raw) {
    if (!raw && raw !== 0) return null;
    const sRaw = String(raw).trim();
    if (!sRaw) return null;

    const ascii = toAsciiDigits(sRaw)
      .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')
      .replace(/@cuc\.edu\.eg$/i, '')
      .trim();

    const entries = Object.entries(D.students);
    const g9Entries = entries.filter(([, s]) => s.g9);

    // 1. Numeric ID / short-suffix lookup
    if (/^[\d\s\-]+$/.test(ascii)) {
      const digits = ascii.replace(/\D/g, '');
      if (!digits) return { error: 'Enter your 11-digit Student ID to continue.' };

      const candidates = candidateIds(digits);
      for (const cand of candidates) {
        if (D.students[cand]) return makeUser(cand, D.students[cand]);
      }

      // Short suffix convenience (2 to 5 digits) — check confirmed Group 9 roster first
      if (digits.length >= 2 && digits.length <= 5) {
        const g9Hits = g9Entries.filter(([k]) => k.endsWith(digits));
        if (g9Hits.length === 1) {
          const [k, s] = g9Hits[0];
          return makeUser(k, s);
        }
        if (g9Hits.length > 1) {
          return { error: `Multiple Group 9 IDs end with "${digits}". Please enter your full 11-digit Student ID.` };
        }
        if (digits.length >= 3) {
          const allHits = entries.filter(([k]) => k.endsWith(digits));
          if (allHits.length === 1) {
            const [k, s] = allHits[0];
            return makeUser(k, s);
          }
          if (allHits.length > 1) {
            return { error: `Multiple Student IDs end with "${digits}". Please enter your full 11-digit Student ID.` };
          }
        }
        return { error: `No Group 9 student matches "${digits}". Enter your full 11-digit Student ID.` };
      }

      // Valid full CUC ID not yet in the name directory (e.g. late registration IDs in exam brackets)
      const canonical = candidates.find(isValidCucIdFormat);
      if (canonical) {
        return { user: { id: canonical, name: '', group: 9, g9: false } };
      }

      return { error: 'Check your 11-digit CUC Student ID (for example, 26030100058) and try again.' };
    }

    // 2. Arabic full/multi-part name lookup (only succeeds when unambiguous)
    const normInput = normalizeArabic(sRaw);
    const inputWords = normInput.split(' ').filter(Boolean);
    if (inputWords.length >= 2 || normInput.length >= 6) {
      const matchName = ([, s]) => {
        const normName = normalizeArabic(s.name);
        if (normName === normInput || normName.startsWith(normInput + ' ') || normName.includes(' ' + normInput)) return true;
        return inputWords.length >= 2 && inputWords.every((w) => normName.split(' ').includes(w));
      };
      const g9NameHits = g9Entries.filter(matchName);
      if (g9NameHits.length === 1) return makeUser(g9NameHits[0][0], g9NameHits[0][1]);
      if (g9NameHits.length > 1) return { error: 'Multiple Group 9 students share that name. Please enter your 11-digit Student ID.' };

      const allNameHits = entries.filter(matchName);
      if (allNameHits.length === 1) return makeUser(allNameHits[0][0], allNameHits[0][1]);
      if (allNameHits.length > 1) return { error: 'Multiple students share that name. Please enter your 11-digit Student ID.' };
    } else if (/[\u0600-\u06FFa-zA-Z]/.test(sRaw)) {
      return { error: 'Please enter your 11-digit Student ID (or your full Arabic name).' };
    }

    return { error: 'Check your 11-digit Student ID and try again.' };
  }

  function showGateError(message) {
    err.textContent = message;
    input.setAttribute('aria-invalid', 'true');
    input.focus({ preventScroll: true });
    const f = $('.field', form);
    if (f) { f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); }
  }

  function handleLogin() {
    const raw = input.value.trim();
    if (!raw) {
      showGateError('Enter your student ID to continue.');
      return;
    }
    const res = lookup(raw);
    if (!res || !res.user) {
      showGateError((res && res.error) || 'Check your Student ID and try again.');
      return;
    }
    err.textContent = '';
    input.setAttribute('aria-invalid', 'false');
    try { localStorage.setItem(KEY_USER, res.user.id); } catch (x) {}
    enter(res.user, true);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleLogin();
  });

  if (gateGo) {
    gateGo.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogin();
    });
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLogin();
    }
  });

  input.addEventListener('input', () => {
    err.textContent = '';
    input.setAttribute('aria-invalid', 'false');
  });

  function enter(u, animateGate) {
    state.user = u;
    state.day = null;
    state.openSubject = null;
    try { state.examView = localStorage.getItem(KEY_EXAM) !== '0'; } catch (e) { state.examView = true; }

    const hasName = Boolean(u.name && u.name.trim());
    const initial = hasName ? u.name.trim().charAt(0) : '#';
    ['meAvatar', 'menuAvatar'].forEach((id) => {
      const el = $('#' + id);
      el.textContent = initial;
      el.classList.toggle('id-fallback', !hasName);
    });

    const meName = $('#meName'), popName = $('#popName'), menuName = $('#menuName');
    meName.textContent = hasName ? shortName(u.name) : `ID ${u.id}`;
    popName.textContent = hasName ? u.name : `Student ID ${u.id}`;
    menuName.textContent = hasName ? u.name : `Student ID ${u.id}`;
    [meName, popName, menuName].forEach((el) => el.classList.toggle('id-fallback', !hasName));

    $('#meGroup').textContent = `Group ${u.group}`;
    $('#popMeta').textContent = `ID ${u.id} · Group ${u.group}`;
    $('#menuMeta').textContent = `ID ${u.id} · Group ${u.group}`;
    syncExamSwitch();
    document.body.classList.remove('is-gate');
    $('#app').hidden = false;
    if (!location.hash || location.hash === '#') history.replaceState(null, '', '#/home');
    route();
    if (animateGate) {
      gate.classList.add('leave');
      gateTimer = setTimeout(() => { gate.hidden = true; $('#stage').focus({ preventScroll: true }); }, reduce ? 0 : 350);
    } else gate.hidden = true;
  }

  function signOut() {
    clearTimeout(gateTimer);
    closePalette();
    closeMenu();
    togglePop(false);
    err.textContent = '';
    input.setAttribute('aria-invalid', 'false');
    try { localStorage.removeItem(KEY_USER); } catch (e) {}
    state.user = null;
    history.replaceState(null, '', location.pathname);
    $('#app').hidden = true;
    document.body.classList.add('is-gate');
    gate.hidden = false;
    void gate.offsetWidth;
    gate.classList.remove('leave');
    input.value = '';
    window.scrollTo(0, 0);
    lines(gate);
    setTimeout(() => input.focus(), 400);
  }

  const top = $('#top');
  addEventListener('scroll', () => top.classList.toggle('stuck', scrollY > 8), { passive: true });

  /* ---------- live countdown ---------- */
  let lastNextCode = null;
  setInterval(() => {
    if (!state.user) return;
    const e = nextExam(state.user.group);
    const code = e ? e.code : null;
    if (lastNextCode !== null && code !== lastNextCode && (state.view === 'home' || state.view === 'exams')) {
      lastNextCode = code;
      show(state.view, true);
      return;
    }
    lastNextCode = code;
    const c = $('#countdown');
    if (c && e && state.view === 'home') {
      c.textContent = countdownText(e.start, e.end);
    }
  }, 20000);

  /* ---------- boot ---------- */
  lines(gate);
  let saved = null;
  try { saved = localStorage.getItem(KEY_USER); } catch (e) {}
  const bootRes = saved ? lookup(saved) : null;
  if (bootRes && bootRes.user) {
    try { localStorage.setItem(KEY_USER, bootRes.user.id); } catch (e) {}
    enter(bootRes.user, false);
  } else {
    if (saved) { try { localStorage.removeItem(KEY_USER); } catch (e) {} }
    setTimeout(() => input.focus(), 700);
  }
})();
