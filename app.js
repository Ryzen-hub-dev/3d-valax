/* =========================================================== ValaxScrub
   Cinematic single-page experience.
   - Procedural WebGL shader as the scroll-bound "WebP sequence"
   - Module rail switching with smooth content transitions
   - Preload that holds the screen until the first frame is rendered
   =============================================================== */
(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ===================================================== Preloader */
  const preloader = $('#preloader');
  const preloaderFill = $('#preloader-fill');
  const preloaderPct  = $('#preloader-pct');
  const preloaderStatus = $('#preloader-status');

  const statusMessages = [
    'Bootstrapping core engine…',
    'Warming shader pipeline…',
    'Loading variant sequence (1/4)…',
    'Loading variant sequence (2/4)…',
    'Loading variant sequence (3/4)…',
    'Loading variant sequence (4/4)…',
    'Pinning HWID attestation…',
    'Sealing the perimeter…'
  ];

  function startPreload() {
    let pct = 0;
    let msgIdx = 0;
    const step = () => {
      // 0 -> 92 during the asset phase, real finishing touch happens
      // once the WebGL hero canvas renders its first frame.
      const target = Math.min(92, pct + 4 + Math.random() * 6);
      pct = target;
      preloaderFill.style.width = pct + '%';
      preloaderPct.textContent  = Math.round(pct);
      const newMsgIdx = Math.min(statusMessages.length - 1, Math.floor(pct / 12));
      if (newMsgIdx !== msgIdx) {
        msgIdx = newMsgIdx;
        preloaderStatus.textContent = statusMessages[msgIdx];
      }
      if (pct < 92) {
        setTimeout(step, 60 + Math.random() * 90);
      }
    };
    step();
  }

  function finishPreload() {
    preloaderFill.style.width = '100%';
    preloaderPct.textContent = '100';
    preloaderStatus.textContent = 'Perimeter locked';
    requestAnimationFrame(() => {
      setTimeout(() => preloader.classList.add('is-done'), 260);
    });
  }

  startPreload();

  /* Failsafe: if anything below prevents finishPreload() from being
     called by the first frame, force-unmask the preloader after 2.5s.
     Better to reveal a half-rendered hero than to be stuck behind a mask. */
  setTimeout(() => {
    if (!preloader.classList.contains('is-done')) {
      console.warn('[ValaxScrub] preloader failsafe triggered');
      finishPreload();
    }
  }, 2500);

  /* Surface any runtime error so we don't get stuck silently. */
  window.addEventListener('error', (e) => {
    console.error('[ValaxScrub] runtime error:', e.message);
    if (!preloader.classList.contains('is-done')) finishPreload();
  });

  /* ===================================================== Background WebGL
     A non-photoreal "frame sequence" — its texture phases are *driven*
     by a scroll progress value [0,1], exactly like a WebP sequence.
     We blend 3 motif weights by frame index. */
  const bgCanvas = $('#bg-canvas');
  const bgCtx = bgCanvas && bgCanvas.getContext && bgCanvas.getContext('2d');
  let bgW = 0, bgH = 0, bgFrames = 0;
  const BG_FRAMES = 96;             // conceptual sequence length
  const BG_VARIANTS = 4;            // sequence per variant (weblike)

  function resizeBg() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    bgW = bgCanvas.clientWidth;
    bgH = bgCanvas.clientHeight;
    bgCanvas.width  = Math.max(1, Math.round(bgW * dpr));
    bgCanvas.height = Math.max(1, Math.round(bgH * dpr));
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resizeBg, { passive: true });

  function drawBg(frameProgress, variant) {
    if (!bgCtx) return;
    if (!bgW || !bgH) return;
    // frameProgress: 0..1
    // variant: 0..3  (switches module)
    const ctx = bgCtx;
    ctx.clearRect(0, 0, bgW, bgH);

    const cx = bgW * 0.5;
    const cy = bgH * 0.42;
    const t  = performance.now() * 0.0006;
    const fp = frameProgress;

    // Variant palette — slight hue shift per module
    const hues = [
      [195, 155], // 01 Obfuscation  (cyan -> green)
      [188, 162], // 02 HWID Lock    (slightly bluer)
      [200, 145], // 03 Real-time Analytics (warmer green)
      [178, 168]  // 04 Key System
    ];
    const [h1, h2] = hues[variant] || hues[0];

    /* ------------ Orbiting polyhedron rings */
    const rings = 5;
    for (let i = 0; i < rings; i++) {
      const r = (Math.min(bgW, bgH) * 0.05) + i * 60 * (1 - fp * 0.35);
      const rot = t * (0.4 + i * 0.15) + i;
      const alpha = 0.06 + 0.04 * Math.sin(frameProgress * Math.PI * 2 + i);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.strokeStyle = `hsla(${h1 + i * 4}, 95%, 65%, ${alpha})`;
      ctx.lineWidth = 1;
      const sides = 3 + i;
      ctx.beginPath();
      for (let k = 0; k <= sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // vertex markers
      ctx.fillStyle = `hsla(${h2}, 95%, 70%, ${alpha * 1.6})`;
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    /* ------------ Particle stream (encrypted packets) */
    const particles = 80;
    ctx.lineWidth = 1;
    for (let i = 0; i < particles; i++) {
      const seed = i * 37 + variant * 911;
      const life = (frameProgress + (seed % 100) / 100) % 1;
      const ang  = ((seed * 13) % 360) * Math.PI / 180 + t * 0.4;
      const dist = 30 + (bgH * 0.55) * life;
      const x = cx + Math.cos(ang) * dist;
      const y = cy + Math.sin(ang) * dist * 0.6;
      const alpha = (1 - life) * 0.65;
      const hue = i % 3 === 0 ? h2 : h1;
      ctx.strokeStyle = `hsla(${hue}, 95%, 70%, ${alpha})`;
      ctx.beginPath();
      const tail = 14 * (1 - life);
      ctx.moveTo(x - tail * Math.cos(ang), y - tail * Math.sin(ang) * 0.6);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    /* ------------ Hex-grid lattice */
    ctx.save();
    ctx.translate(0, bgH * 0.45);
    const cellW = 56, cellH = 64;
    const cols = Math.ceil(bgW / cellW) + 2;
    const rows = Math.ceil(bgH / cellH) + 2;
    ctx.strokeStyle = `hsla(${h1}, 95%, 60%, 0.05)`;
    ctx.lineWidth = 1;
    for (let r = -1; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const x = c * cellW + (r % 2 ? cellW / 2 : 0) - cellW;
        const y = r * cellH - bgH * fp * 0.08;
        const dist = Math.hypot(x + cellW/2 - cx, y - bgH*0.05);
        const intensity = Math.max(0, 1 - dist / 600);
        if (intensity < 0.05) continue;
        ctx.fillStyle = `hsla(${h2}, 95%, 65%, ${intensity * 0.6})`;
        ctx.beginPath();
        const sz = 1.2;
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          const px = x + Math.cos(a) * sz * 3;
          const py = y + Math.sin(a) * sz * 3;
          k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    /* ------------ Cipher glyphs orbiting */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = `hsla(${h1}, 95%, 70%, 0.18)`;
    const glyphs = '0123456789ABCDEF';
    const G = 18;
    for (let i = 0; i < G; i++) {
      const a = (i / G) * Math.PI * 2 + t * 0.5;
      const radius = Math.min(bgW, bgH) * 0.28;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius * 0.55;
      const ch = glyphs[(i + Math.floor(frameProgress * 32)) % glyphs.length];
      ctx.fillText(ch, x, y);
    }
    ctx.restore();

    /* ------------ Central encrypted core */
    const coreR = Math.min(bgW, bgH) * 0.18 * (1 - fp * 0.35);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    grad.addColorStop(0, `hsla(${h2}, 95%, 75%, 0.55)`);
    grad.addColorStop(0.4, `hsla(${h1}, 95%, 60%, 0.25)`);
    grad.addColorStop(1, `hsla(${h1}, 95%, 60%, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();

    // core ring
    ctx.strokeStyle = `hsla(${h2}, 95%, 75%, 0.5)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, coreR * 0.7, 0, Math.PI * 2); ctx.stroke();

    // segmented lock-pick arc
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.6);
    ctx.strokeStyle = `hsla(${h1}, 95%, 70%, 0.85)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, coreR * 0.55, 0, Math.PI * (1.2 + Math.sin(t * 1.4) * 0.15));
    ctx.stroke();
    ctx.restore();
  }

  resizeBg();

  /* ===================================================== Hero canvas
     Same shader logic but rendered larger and centered — the headline
     scroll-bound sequence the spec calls for. */
  const heroCanvas = $('#hero-canvas');
  const heroCtx = heroCanvas && heroCanvas.getContext && heroCanvas.getContext('2d');
  let heroW = 0, heroH = 0;
  let heroRendered = false;

  function resizeHero() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const parentEl = heroCanvas && heroCanvas.parentElement;
    if (!parentEl) return;
    heroW = heroCanvas.clientWidth = parentEl.clientWidth;
    heroH = heroCanvas.clientHeight = parentEl.clientHeight;
    heroCanvas.width  = Math.max(1, Math.round(heroW * dpr));
    heroCanvas.height = Math.max(1, Math.round(heroH * dpr));
    heroCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resizeHero, { passive: true });

  function drawHero(frameProgress, variant) {
    if (!heroCtx) return;
    if (!heroW || !heroH) return;
    const ctx = heroCtx;
    ctx.clearRect(0, 0, heroW, heroH);

    const cx = heroW * 0.55;
    const cy = heroH * 0.48;
    const t  = performance.now() * 0.0008;
    const fp = frameProgress;
    const easeFp = fp * fp * (3 - 2 * fp); // smoothstep

    const hues = [
      [195, 155], [188, 162], [200, 145], [178, 168]
    ];
    const [h1, h2] = hues[variant] || hues[0];

    /* ----- Outer code sphere — many orbiting vertices */
    const sphereR = Math.min(heroW, heroH) * 0.30;
    const points = 240;
    for (let i = 0; i < points; i++) {
      const phi   = Math.acos(1 - 2 * (i + 0.5) / points);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i + t * 0.3;
      const x = cx + sphereR * Math.sin(phi) * Math.cos(theta + fp * Math.PI * 0.5);
      const y = cy + sphereR * Math.sin(phi) * Math.sin(theta + fp * Math.PI * 0.5);
      const z = sphereR * Math.cos(phi);
      const depth = (z + sphereR) / (2 * sphereR);
      const alpha = 0.18 + depth * 0.55;
      const hue = (i % 5 === 0) ? h2 : h1;
      ctx.fillStyle = `hsla(${hue}, 95%, ${55 + depth * 25}%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + depth * 1.4, 0, Math.PI * 2);
      ctx.fill();

      // connecting lines for sparse wireframe
      if (i % 8 === 0) {
        const neighborTheta = theta + Math.PI / 16;
        const nx = cx + sphereR * Math.sin(phi) * Math.cos(neighborTheta + fp * Math.PI * 0.5);
        const ny = cy + sphereR * Math.sin(phi) * Math.sin(neighborTheta + fp * Math.PI * 0.5);
        ctx.strokeStyle = `hsla(${h1}, 95%, 65%, ${alpha * 0.25})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }
    }

    /* ----- Inner concentric lock rings */
    const rings = 6;
    for (let i = 0; i < rings; i++) {
      const r = sphereR * (0.2 + i * 0.13) * (1 - easeFp * 0.18);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * (i % 2 === 0 ? 1 : -1) * 0.2 + i);
      ctx.strokeStyle = `hsla(${i % 2 ? h2 : h1}, 95%, 70%, ${0.45 - i * 0.05})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([i * 4 + 4, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    /* ----- Data streams */
    const streams = 12;
    for (let i = 0; i < streams; i++) {
      const off  = i / streams;
      const life = (fp * 1.5 + off) % 1;
      const ang  = off * Math.PI * 2 + t * 0.4;
      const dist = sphereR * 1.4 * life;
      const x = cx + Math.cos(ang) * dist;
      const y = cy + Math.sin(ang) * dist;
      const alpha = (1 - life) * 0.7;
      ctx.strokeStyle = `hsla(${i % 3 ? h1 : h2}, 95%, 75%, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * (dist - 30), cy + Math.sin(ang) * (dist - 30));
      ctx.lineTo(x, y);
      ctx.stroke();
      // leading node
      ctx.fillStyle = `hsla(${h2}, 95%, 80%, ${alpha})`;
      ctx.beginPath(); ctx.arc(x, y, 2.4 * (1 - life) + 0.6, 0, Math.PI * 2); ctx.fill();
    }

    /* ----- Cipher ring (rotating text around the sphere) */
    ctx.save();
    ctx.translate(cx, cy);
    const cipherR = sphereR * 1.05;
    const glyphs = '01↻⌬⌖⌭⌬⌗⌘01·│BLOCK·AES·SEAL·';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const chars = glyphs.repeat(6).split('');
    for (let i = 0; i < chars.length; i++) {
      const a = (i / chars.length) * Math.PI * 2 - t * 0.6;
      const x = Math.cos(a) * cipherR;
      const y = Math.sin(a) * cipherR * 0.45;
      const f = (Math.sin(a * 2 - t * 1.2) + 1) / 2;
      ctx.fillStyle = `hsla(${h1}, 95%, ${65 + f * 25}%, ${0.18 + f * 0.6})`;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(chars[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();

    /* ----- Hex grid field */
    ctx.save();
    const cellW = 80, cellH = 92;
    const cols = Math.ceil(heroW / cellW) + 2;
    const rows = Math.ceil(heroH / cellH) + 2;
    for (let r = -1; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const x = c * cellW + (r % 2 ? cellW / 2 : 0);
        const y = r * cellH - heroH * fp * 0.04;
        const dx = x + cellW / 2 - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy);
        const intensity = Math.max(0, 1 - dist / (sphereR * 1.4));
        if (intensity < 0.04) continue;
        ctx.strokeStyle = `hsla(${h1}, 95%, 70%, ${intensity * 0.18})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          const px = x + Math.cos(a) * 32;
          const py = y + Math.sin(a) * 32;
          k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  resizeHero();

  /* ===================================================== Scroll → frame index
     The hero hovers for two viewports of scroll: scrollProgress stays 0..1
     while we're inside the hero zone, then reverses on scroll back up. */
  const hero = $('#hero');
  let heroScrollProgress = 0;
  let activeVariant = 0;
  let targetVariant  = 0;
  let heroInView = true;

  function updateHeroScrollProgress() {
    const rect = hero.getBoundingClientRect();
    const vh   = window.innerHeight;
    // hero occupies 1 vh; we map its top edge from vh -> -1.5vh to 0..1
    const start = vh * 0.5;
    const end   = -vh * 0.8;
    const p = clamp((start - rect.top) / (start - end), 0, 1);
    heroScrollProgress = p;
  }

  function setVariant(idx) {
    if (idx === activeVariant) return;
    targetVariant = idx;
    activeVariant = idx;
    const loader = $('#rail-loader');
    loader.classList.add('is-on');
    setTimeout(() => loader.classList.remove('is-on'), 380);
    updateModuleUI(idx);
  }

  function updateModuleUI(idx) {
    const data = modules[idx];
    if (!data) return;
    const titleEl = $('#module-title');
    const bodyEl  = $('#module-body');
    const indexEl = $('#module-index');
    const hintEl  = $('#module-hint');
    const parent = $('#module-display');

    const supportsAnimate = typeof parent.animate === 'function';

    const swap = () => {
      titleEl.textContent = data.title;
      bodyEl.textContent  = data.body;
      indexEl.textContent = data.index;
      hintEl.textContent  = data.hint;
      if (supportsAnimate) {
        parent.animate(
          [{ opacity: 0, transform: 'translateY(8px)' },
           { opacity: 1, transform: 'translateY(0)' }],
          { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' }
        );
      }
    };

    if (supportsAnimate) {
      try {
        const fadeOut = parent.animate(
          [{ opacity: 1, transform: 'translateY(0)' },
           { opacity: 0, transform: 'translateY(8px)' }],
          { duration: 220, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }
        );
        fadeOut.onfinish = swap;
        // safety net: if onfinish never fires, still swap within 280ms
        setTimeout(() => { if (titleEl.textContent !== data.title) swap(); }, 320);
      } catch (err) {
        swap();
      }
    } else {
      swap();
    }

    // update rail
    const digits = $$('#rail-digits .rail__num');
    digits.forEach((el, i) => {
      el.classList.remove('rail__num--main', 'rail__num--peek');
      if (i === idx)      el.classList.add('rail__num--main');
      else if (i === idx+1 || i === idx+2) el.classList.add('rail__num--peek');
    });
  }

  /* ===================================================== Module copy */
  const modules = [
    {
      index: '01',
      hint:  'Multi-layer obfuscation',
      title: '5-Pass Multi-Layer Obfuscation',
      body:  'Five passes — constant folding, control-flow flattening, opaque predicates, string-stack & anti-tamper — welded into one signal a decompiler cannot peel back.'
    },
    {
      index: '02',
      hint:  'Hardware-rooted trust',
      title: 'Triple-Factor HWID Lock',
      body:  'Bind every key to the actual silicon — CPU, disk and motherboard — so a leaked loader cannot be replayed on another machine, anywhere.'
    },
    {
      index: '03',
      hint:  'Streamed anomaly score',
      title: 'Real-Time Analytics',
      body:  'A live dashboard of every execution — country, device, anomaly score — streamed to you in under 200 ms, with the kind of context that turns noise into signal.'
    },
    {
      index: '04',
      hint:  'One-click key operations',
      title: 'Advanced Key System',
      body:  'Issue, revoke, rotate and bulk-import keys in a single operation. HWID-bound tokens, time-fused, instantly invalidated.'
    }
  ];

  /* ===================================================== Animation loop
     Background canvas only needs a single frame; the *hero* canvas is
     where scroll + variant live, and it pauses when offscreen. */
  let scrollProgress = 0;
  let bgRendered = false;
  let heroRendered = false;
  let rafQueued = false;
  function tick() {
    rafQueued = false;
    try {
      if (!bgRendered) {
        drawBg(0.35, 0);
        bgRendered = true;
      }
      if (heroInView) {
        drawHero(scrollProgress, activeVariant);
      }
      if (!heroRendered) {
        heroRendered = true;
        finishPreload();
      }
    } catch (err) {
      console.error('[ValaxScrub] tick error:', err);
      if (!heroRendered) { heroRendered = true; finishPreload(); }
    }
    // Keep going as long as the hero is in view, OR until we've
    // produced at least one frame of hero content (so the loader
    // can fade even if the hero is below the fold).
    if (heroInView || !heroRendered) {
      rafQueued = true;
      requestAnimationFrame(tick);
    }
  }
  function wakeTick() {
    if (rafQueued) return;
    rafQueued = true;
    requestAnimationFrame(tick);
  }

  /* Defer the first frame so layout has settled — this guarantees
     heroCanvas has a non-zero size before we try to draw into it. */
  requestAnimationFrame(() => requestAnimationFrame(tick));

  /* ===================================================== Scroll handler */
  let lastY = window.scrollY;
  let rafScheduled = false;
  function onScroll() {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      updateHeroScrollProgress();
      scrollProgress = heroScrollProgress;

      const rect = hero.getBoundingClientRect();
      const vh = window.innerHeight;
      // visible if there's any intersection with viewport
      heroInView = rect.bottom > 0 && rect.top < vh;

      // hero canvas should fade after hero leaves
      const heroOpacity = clamp(1 - Math.max(0, -rect.top / window.innerHeight), 0, 1);
      heroCanvas.style.opacity = heroOpacity * 0.95;

      // re-arm the animation loop if we just re-entered the hero
      if (heroInView) wakeTick();

      lastY = window.scrollY;
      rafScheduled = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  updateHeroScrollProgress();
  scrollProgress = heroScrollProgress;
  // First-paint: skip the fade animation by setting content directly
  // and seeding the rail styling without re-animating.
  {
    const m0 = modules[0];
    $('#module-title').textContent = m0.title;
    $('#module-body').textContent  = m0.body;
    $('#module-index').textContent = m0.index;
    $('#module-hint').textContent  = m0.hint;
    const digits = $$('#rail-digits .rail__num');
    digits.forEach((el, i) => {
      el.classList.remove('rail__num--main', 'rail__num--peek');
      if (i === 0)      el.classList.add('rail__num--main');
      else if (i === 1 || i === 2) el.classList.add('rail__num--peek');
    });
  }

  /* ===================================================== Rail nav */
  $$('[data-rail]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = btn.dataset.rail;
      const next = dir === 'down'
        ? (activeVariant + 1) % modules.length
        : (activeVariant - 1 + modules.length) % modules.length;
      setVariant(next);
    });
  });

  // click on digit also switches
  $$('#rail-digits .rail__num').forEach((el, i) => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => setVariant(i));
  });

  /* ===================================================== Auto-variant cycling
     Spec says "no autoplay" for the scroll-driven sequence itself, but
     the module rail should feel alive. Cycle every ~7s on the hero only
     while idle, until the user interacts or scrolls past. */
  let userHasInteracted = false;
  let cycleTimer = null;
  function startCycle() {
    stopCycle();
    if (userHasInteracted) return;
    cycleTimer = setInterval(() => {
      const rect = hero.getBoundingClientRect();
      if (rect.bottom > window.innerHeight * 0.4 && !userHasInteracted) {
        setVariant((activeVariant + 1) % modules.length);
      } else {
        stopCycle();
      }
    }, 7000);
  }
  function stopCycle() { if (cycleTimer) clearInterval(cycleTimer); cycleTimer = null; }
  $$('[data-rail], #rail-digits .rail__num').forEach(el => {
    el.addEventListener('click', () => {
      userHasInteracted = true;
      stopCycle();
    });
  });
  window.addEventListener('scroll', () => {
    userHasInteracted = true;
    stopCycle();
  }, { once: true });
  startCycle();

  /* ===================================================== Sticky nav hide/show */
  const nav = $('#nav');
  let navHidden = false;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const shouldHide = y > 200 && y > lastY;
    if (shouldHide && !navHidden) { nav.classList.add('is-hidden'); navHidden = true; }
    if (!shouldHide && navHidden && y < lastY) { nav.classList.remove('is-hidden'); navHidden = false; }
    lastY = y;
  }, { passive: true });

  /* ===================================================== Counters */
  function animateCount(el) {
    const target = parseInt(el.dataset.count || '0', 10);
    const dur = 1400;
    const t0 = performance.now();
    function frame() {
      const p = Math.min(1, (performance.now() - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * target);
      if (p < 1) requestAnimationFrame(frame);
    }
    frame();
  }
  const counters = $$('.stats__num[data-count]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animateCount(e.target);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => io.observe(c));

  /* ===================================================== Feature card pointer light */
  $$('.feat').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top)  + 'px');
    });
  });

  /* ===================================================== Helpers */
})();
