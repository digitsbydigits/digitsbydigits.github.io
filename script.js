// dot : puzzle transition
  const puzzle = (() => {
    const canvas = document.getElementById('puzzleCanvas');
    const ctx = canvas.getContext('2d');

    const TARGET_PIECE_PX = 130;
    const PIECE_FRACTION = 0.55;
    const GLYPHS = '01<>/{}#ABCDEF';
    const SHADES = ['#070c09', '#0a110d', '#0c150f', '#08100b'];

    let W = 0, H = 0, dpr = 1, cols = 0, rows = 0, pw = 0, ph = 0;
    let pieces = [];
    let anim = { mode: 'static', covered: true };
    let onDone = null;
    let rafId = 0;

    // dot : clamp value
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    // dot : ease out
    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
    // dot : ease in
    const easeInCubic = t => t * t * t;

    // dot : jigsaw edge
    function edgeTo(path, ax, ay, bx, by, s) {
      if (!s) { path.lineTo(bx, by); return; }
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      const ox = (dy / L) * s, oy = (-dx / L) * s;
      // dot : edge point
      const P = (t, h) => [ax + dx * t + ox * h * L, ay + dy * t + oy * h * L];
      path.lineTo(...P(0.40, 0));
      path.bezierCurveTo(...P(0.40, 0.08), ...P(0.30, 0.10), ...P(0.30, 0.22));
      path.bezierCurveTo(...P(0.30, 0.34), ...P(0.42, 0.34), ...P(0.50, 0.34));
      path.bezierCurveTo(...P(0.58, 0.34), ...P(0.70, 0.34), ...P(0.70, 0.22));
      path.bezierCurveTo(...P(0.70, 0.10), ...P(0.60, 0.08), ...P(0.60, 0));
      path.lineTo(bx, by);
    }

    // dot : build pieces
    function build() {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);

      cols = Math.max(3, Math.round(W / TARGET_PIECE_PX));
      rows = Math.max(2, Math.round(H / TARGET_PIECE_PX));
      pw = W / cols;
      ph = H / rows;

      const rightDir = [], bottomDir = [];
      for (let r = 0; r < rows; r++) {
        rightDir[r] = []; bottomDir[r] = [];
        for (let c = 0; c < cols; c++) {
          rightDir[r][c] = Math.random() < 0.5 ? 1 : -1;
          bottomDir[r][c] = Math.random() < 0.5 ? 1 : -1;
        }
      }

      pieces = [];
      const hx = pw / 2, hy = ph / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const top    = r > 0        ? -bottomDir[r - 1][c] : 0;
          const right  = c < cols - 1 ?  rightDir[r][c]      : 0;
          const bottom = r < rows - 1 ?  bottomDir[r][c]     : 0;
          const left   = c > 0        ? -rightDir[r][c - 1]  : 0;

          const path = new Path2D();
          path.moveTo(-hx, -hy);
          edgeTo(path, -hx, -hy,  hx, -hy, top);
          edgeTo(path,  hx, -hy,  hx,  hy, right);
          edgeTo(path,  hx,  hy, -hx,  hy, bottom);
          edgeTo(path, -hx,  hy, -hx, -hy, left);
          path.closePath();

          pieces.push({
            cx: (c + 0.5) * pw,
            cy: (r + 0.5) * ph,
            path,
            glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
            shade: SHADES[Math.floor(Math.random() * SHADES.length)],
            phase: Math.random() * Math.PI * 2,
            dx: 0, dy: 0, rot: 0, delay: 0
          });
        }
      }
      scramble();
      kick();
    }

    // dot : scatter pieces
    function scramble() {
      const fx = Math.random() * W, fy = Math.random() * H;
      let maxD = 1;
      for (const p of pieces) {
        p.d = Math.hypot(p.cx - fx, p.cy - fy) + Math.random() * 90;
        maxD = Math.max(maxD, p.d);
      }
      for (const p of pieces) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 140 + Math.random() * 320;
        p.dx = Math.cos(angle) * dist;
        p.dy = Math.sin(angle) * dist;
        p.rot = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 1.6);
        p.delay = (p.d / maxD) * (1 - PIECE_FRACTION);
      }
    }

    // dot : draw frame
    function frame(now) {
      rafId = 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      let el = 0;
      if (anim.mode !== 'static') el = clamp((now - anim.start) / anim.dur, 0, 1);

      const glyphSize = Math.round(Math.min(pw, ph) * 0.3);

      for (const p of pieces) {
        let e;
        if (anim.mode === 'static') {
          e = anim.covered ? 1 : 0;
        } else {
          const t = clamp((el - p.delay) / PIECE_FRACTION, 0, 1);
          e = anim.mode === 'assemble' ? easeOutCubic(t) : 1 - easeInCubic(t);
        }
        if (e <= 0.001) continue;

        const off = 1 - e;
        const moving = off > 0.01;

        ctx.save();
        ctx.translate(p.cx + p.dx * off, p.cy + p.dy * off);
        ctx.rotate(p.rot * off);
        ctx.globalAlpha = Math.min(1, e * 2);

        ctx.fillStyle = p.shade;
        ctx.fill(p.path);

        ctx.lineWidth = 1.5;
        if (moving) {
          ctx.strokeStyle = 'rgba(90, 255, 160, 0.95)';
          ctx.shadowColor = 'rgba(0, 255, 81, 0.8)';
          ctx.shadowBlur = 14;
        } else {
          ctx.strokeStyle = `rgba(0, 255, 81, ${0.2 + 0.12 * Math.sin(now / 500 + p.phase)})`;
        }
        ctx.stroke(p.path);
        ctx.shadowBlur = 0;

        ctx.font = `700 ${glyphSize}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(0, 255, 81, ${0.08 + 0.1 * e})`;
        ctx.fillText(p.glyph, 0, 0);

        ctx.restore();
      }

      if (anim.mode !== 'static' && el >= 1) {
        const wasAssemble = anim.mode === 'assemble';
        anim = { mode: 'static', covered: wasAssemble };
        const cb = onDone;
        onDone = null;
        if (cb) cb();
      }

      if (anim.mode !== 'static' || anim.covered) kick();
    }

    // dot : start loop
    function kick() {
      if (!rafId) rafId = requestAnimationFrame(frame);
    }

    // dot : assemble pieces
    function assemble(ms, cb) {
      scramble();
      anim = { mode: 'assemble', start: performance.now(), dur: ms };
      onDone = cb || null;
      kick();
    }

    // dot : disassemble pieces
    function disassemble(ms, cb) {
      scramble();
      anim = { mode: 'disassemble', start: performance.now(), dur: ms };
      onDone = cb || null;
      kick();
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 150);
    });

    build();

    return { assemble, disassemble };
  })();

  const playlist = [
    'NLHxTUYrq20',
    'W0NAFO6EY2Q',
    'j1CM0vmpDC4',
    '0Mi1LlQniZc',
    'WxDmDzyzjU8',
    'XLbVYnnqgT0'
  ];

  const VIDEO_DURATION_MS = 15000;
  const ASSEMBLE_MS = 1000;
  const DISASSEMBLE_MS = 1100;
  const CONTROLS_FADE_MS = 3500;
  const LOAD_TIMEOUT_MS = 10000;
  const MIRROR_SYNC_MS = 1000;
  const MIRROR_MAX_DRIFT_S = 0.1;

  let currentVideoIndex = 0;
  let currentStart = 0;
  let player, mirror;
  let mirrorReady = false;
  const headerMirror = document.getElementById('headerMirror');
  let phase = 'loading';
  let loadStartedAt = performance.now();
  let holdTimer, cycleTimer, loadTimeout;

  // dot : random start
  function getRandomStartTime() {
    return Math.floor(Math.random() * 60) + 1;
  }

  currentStart = getRandomStartTime();

  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  // dot : player options
  function makePlayerVars() {
    return {
      'autoplay': 1,
      'controls': 0,
      'mute': 1,
      'loop': 1,
      'playlist': playlist[currentVideoIndex],
      'playsinline': 1,
      'rel': 0,
      'modestbranding': 1,
      'iv_load_policy': 3,
      'disablekb': 1,
      'fs': 0,
      'start': currentStart,
      'origin': window.location.origin || 'http://localhost'
    };
  }

  // dot : create players
  function onYouTubeIframeAPIReady() {
    loadStartedAt = performance.now();

    player = new YT.Player('player', {
      videoId: playlist[currentVideoIndex],
      host: 'https://www.youtube-nocookie.com',
      playerVars: makePlayerVars(),
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange,
        'onError': onPlayerError
      }
    });

    mirror = new YT.Player('mirrorPlayer', {
      videoId: playlist[currentVideoIndex],
      host: 'https://www.youtube-nocookie.com',
      playerVars: makePlayerVars(),
      events: {
        'onReady': (e) => { e.target.mute(); e.target.playVideo(); mirrorReady = true; }
      }
    });

    armLoadTimeout();
    setInterval(syncMirror, MIRROR_SYNC_MS);
  }

  // dot : sync mirror
  function syncMirror() {
    if (!mirrorReady || !player || phase === 'loading' || phase === 'covering') return;
    try {
      const main = player.getCurrentTime();
      if (Math.abs(main - mirror.getCurrentTime()) > MIRROR_MAX_DRIFT_S) {
        mirror.seekTo(main, true);
      }
    } catch (err) {}
  }

  // dot : player ready
  function onPlayerReady(event) {
    event.target.mute();
    event.target.playVideo();
  }

  // dot : state change
  function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING && phase === 'loading') {
      clearTimeout(loadTimeout);
      const loadMs = Math.round(performance.now() - loadStartedAt);
      phase = 'holding';
      holdTimer = setTimeout(reveal, CONTROLS_FADE_MS);
      if (mirrorReady) {
        try { mirror.seekTo(player.getCurrentTime(), true); } catch (err) {}
      }
    }
  }

  // dot : player error
  function onPlayerError() {
    if (phase === 'loading' || phase === 'holding') {
      clearTimeout(loadTimeout);
      clearTimeout(holdTimer);
      currentVideoIndex = (currentVideoIndex + 1) % playlist.length;
      loadVideo();
    }
  }

  // dot : load timeout
  function armLoadTimeout() {
    clearTimeout(loadTimeout);
    loadTimeout = setTimeout(() => {
      if (phase === 'loading') {
        phase = 'holding';
        holdTimer = setTimeout(reveal, CONTROLS_FADE_MS);
      }
    }, LOAD_TIMEOUT_MS);
  }

  // dot : load video
  function loadVideo() {
    phase = 'loading';
    loadStartedAt = performance.now();
    currentStart = getRandomStartTime();
    const request = { videoId: playlist[currentVideoIndex], startSeconds: currentStart };
    player.loadVideoById(request);
    if (mirrorReady) mirror.loadVideoById(request);
    armLoadTimeout();
  }

  // dot : reveal video
  function reveal() {
    phase = 'revealing';
    headerMirror.classList.add('visible');
    puzzle.disassemble(DISASSEMBLE_MS, () => { phase = 'showing'; });
    cycleTimer = setTimeout(nextVideo, VIDEO_DURATION_MS);
  }

  // dot : next video
  function nextVideo() {
    phase = 'covering';
    headerMirror.classList.remove('visible');
    currentVideoIndex = (currentVideoIndex + 1) % playlist.length;
    puzzle.assemble(ASSEMBLE_MS, loadVideo);
  }

  // dot : intro animation
  (function runIntro() {
    const TYPE_START_MS = 200;
    const LETTER_MS = 85;
    const HOLD_MS = 350;
    const MOVE_MS = 900;
    const TEXT_FADE_MS = 300;
    const INTRO_MS = 5000;
    const MOVE_EASE = 'cubic-bezier(0.85, 0, 0.15, 1)';

    const overlay = document.getElementById('introOverlay');
    const h1 = document.querySelector('.header-overlay h1');

    h1.style.visibility = 'hidden';

    // dot : start intro
    function start() {
      window.scrollTo(0, 0);
      const target = h1.getBoundingClientRect();

      const clone = document.createElement('div');
      clone.className = 'intro-title';
      clone.setAttribute('aria-hidden', 'true');
      const letters = [...h1.textContent.trim()].map(ch => {
        const span = document.createElement('span');
        span.className = 'intro-letter';
        span.textContent = ch;
        clone.appendChild(span);
        return span;
      });
      const caret = document.createElement('span');
      caret.className = 'intro-caret';
      clone.appendChild(caret);
      document.body.appendChild(clone);

      const big = clone.getBoundingClientRect();
      const endScale = target.width / big.width;
      const startX = window.innerWidth / 2 - big.width / 2;
      const startY = window.innerHeight / 2 - big.height / 2;
      const endX = target.left + target.width / 2 - big.width / 2;
      const endY = target.top + target.height / 2 - big.height / 2;

      const from = `translate(${startX}px, ${startY}px) scale(1)`;
      const to = `translate(${endX}px, ${endY}px) scale(${endScale})`;

      letters.forEach((el, i) => {
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          delay: TYPE_START_MS + i * LETTER_MS,
          duration: 40,
          fill: 'forwards'
        });
      });

      const typeMs = letters.length * LETTER_MS;
      const holdEnd = TYPE_START_MS + typeMs + HOLD_MS;
      caret.animate(
        [{ transform: 'translateX(0)' }, { transform: `translateX(${big.width}px)` }],
        { delay: TYPE_START_MS, duration: typeMs, easing: `steps(${letters.length}, jump-start)`, fill: 'both' }
      );
      const t0 = TYPE_START_MS / holdEnd;
      caret.animate([
        { opacity: 0, offset: 0 },
        { opacity: 0, offset: t0 },
        { opacity: 1, offset: t0 + 0.001 },
        { opacity: 1, offset: (holdEnd - 120) / holdEnd },
        { opacity: 0, offset: 1 }
      ], { duration: holdEnd, fill: 'forwards' });

      const moveStart = holdEnd;
      const total = moveStart + MOVE_MS;
      const move = clone.animate([
        { transform: from, offset: 0 },
        { transform: from, offset: moveStart / total, easing: MOVE_EASE },
        { transform: to, offset: 1 }
      ], { duration: total, fill: 'forwards' });

      const fade = overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: INTRO_MS,
        easing: 'ease-in-out',
        fill: 'forwards'
      });

      move.onfinish = () => {
        h1.style.visibility = 'visible';
        const out = clone.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: TEXT_FADE_MS,
          fill: 'forwards'
        });
        out.onfinish = () => clone.remove();
      };

      fade.onfinish = () => {
        overlay.remove();
        document.body.classList.add('intro-done');
      };
    }

    Promise.race([
      document.fonts.load('700 1rem "JetBrains Mono"'),
      new Promise(resolve => setTimeout(resolve, 1500))
    ]).then(start, start);

    setTimeout(() => {
      h1.style.visibility = 'visible';
      if (overlay.isConnected) overlay.remove();
      document.body.classList.add('intro-done');
    }, 3000);
  })();

  // dot : menu scrolling
  (function () {
    const btn = document.querySelector('.menu-btn');
    const sideNav = document.getElementById('sideNav');
    const header = document.querySelector('.header-overlay');
    const footer = document.querySelector('footer');
    const sections = [...document.querySelectorAll('main .showcase')];
    const GAP_PX = 24;
    const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

    // dot : pad section
    function padLastSection() {
      const last = sections[sections.length - 1];
      if (!last) return;
      const title = last.querySelector('.showcase-title') || last;
      const titleOffset = title.getBoundingClientRect().top - last.getBoundingClientRect().top;
      const needed = window.innerHeight - header.offsetHeight - GAP_PX - footer.offsetHeight + titleOffset;
      last.style.minHeight = Math.max(0, Math.round(needed)) + 'px';
    }

    // dot : scroll section
    function scrollToSection(section, smooth) {
      const title = section.querySelector('.showcase-title') || section;
      const top = title.getBoundingClientRect().top + window.scrollY - header.offsetHeight - GAP_PX;
      window.scrollTo({ top: Math.max(0, top), behavior: smooth && !REDUCED.matches ? 'smooth' : 'auto' });
    }

    padLastSection();
    window.addEventListener('resize', padLastSection);
    window.addEventListener('load', padLastSection);

    document.querySelectorAll('.nav-link[href^="#"]').forEach(link => {
      link.addEventListener('click', event => {
        const section = document.querySelector(link.getAttribute('href'));
        if (!section) return;
        event.preventDefault();
        btn.classList.remove('active');
        sideNav.classList.remove('active');
        scrollToSection(section, true);
        history.replaceState(null, '', link.getAttribute('href'));
      });
    });

    window.addEventListener('load', () => {
      const target = location.hash && document.querySelector(location.hash);
      if (target && target.classList.contains('showcase')) scrollToSection(target, false);
    });
  })();

  // dot : scroll effects
  (function scrollFx() {
    const root = document.documentElement;
    const strips = [...document.querySelectorAll('.scroll-markers')];
    const timecode = document.getElementById('smTimecode');
    const sectionLabel = document.getElementById('smSection');
    const footer = document.querySelector('footer');
    const focusEl = document.querySelector('.video-row') || document.getElementById('creative-media');
    const sections = ['creative-media', 'mobile-projects', 'websites']
      .map(id => document.getElementById(id));
    const NAMES = ['CREATIVE MEDIA', 'MOBILE PROJECTS', 'WEBSITES'];

    const TICKS = 31;
    const MAJOR_EVERY = 10;
    const MAX_SCALE = 2.6;
    const SIGMA = 0.07;
    const RUNTIME_S = 120;
    const FPS = 24;
    const FADE_DISTANCE = 0.6;

    const GREEN = [0, 255, 81], BLUE = [45, 136, 247], PURPLE = [148, 0, 254];
    const COLORS = [GREEN, BLUE, GREEN, PURPLE];

    // dot : clamp value
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    // dot : interpolate value
    const lerp = (a, b, t) => a + (b - a) * t;
    // dot : pad number
    const pad = (n, l = 2) => String(n).padStart(l, '0');

    const ticks = [];
    const labels = strips.map(strip => ({
      strip,
      track: strip.querySelector('.sm-track'),
      label: strip.querySelector('.sm-label')
    }));

    labels.forEach(({ track }) => {
      for (let i = 0; i < TICKS; i++) {
        const pos = i / (TICKS - 1);
        const el = document.createElement('span');
        el.className = 'sm-tick' + (i % MAJOR_EVERY === 0 ? ' major' : '');
        el.style.top = (pos * 100) + '%';
        el.addEventListener('click', () => {
          const max = root.scrollHeight - window.innerHeight;
          window.scrollTo({ top: pos * max, behavior: 'smooth' });
        });
        track.appendChild(el);
        ticks.push({ el, pos, filled: false });
      }
    });

    // dot : colour lookup
    function colorAt(y) {
      const centres = sections.map(sec => {
        const r = sec.getBoundingClientRect();
        return r.top + window.scrollY + r.height / 2;
      });
      const stops = [0, ...centres];
      if (y <= stops[0]) return COLORS[0];
      for (let i = 1; i < stops.length; i++) {
        if (y <= stops[i]) {
          const t = (y - stops[i - 1]) / (stops[i] - stops[i - 1]);
          return COLORS[i - 1].map((c, k) => lerp(c, COLORS[i][k], t));
        }
      }
      return COLORS[COLORS.length - 1];
    }

    // dot : current section
    function currentSection() {
      const cy = window.innerHeight / 2;
      if (footer.getBoundingClientRect().top <= window.innerHeight * 0.85) return 'END CREDITS';
      let name = 'OPENING';
      sections.forEach((sec, i) => {
        if (sec.getBoundingClientRect().top <= cy) name = NAMES[i];
      });
      return name;
    }

    // dot : update effects
    function update() {
      const y = window.scrollY;
      const max = Math.max(1, root.scrollHeight - window.innerHeight);
      const total = clamp(y / max);

      root.style.setProperty('--scroll-p', clamp(y / (window.innerHeight * FADE_DISTANCE)).toFixed(3));

      const vh = window.innerHeight;
      const cm = focusEl.getBoundingClientRect();
      const focusIn = clamp((vh * 0.75 - cm.top) / (vh * 0.45));
      const focusOut = clamp((cm.bottom - vh * 0.45) / (vh * 0.45));
      root.style.setProperty('--focus', Math.min(focusIn, focusOut).toFixed(3));

      const c = colorAt(y + window.innerHeight / 2).map(Math.round);
      const rgb = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

      for (const t of ticks) {
        const w = Math.exp(-Math.pow((t.pos - total) / SIGMA, 2));
        t.el.style.setProperty('--s', (1 + (MAX_SCALE - 1) * w).toFixed(3));
        t.el.style.opacity = (0.5 + 0.5 * w).toFixed(2);
        const filled = t.pos <= total + 0.0001;
        if (filled !== t.filled) {
          t.filled = filled;
          t.el.classList.toggle('filled', filled);
        }
      }

      const frames = Math.round(total * RUNTIME_S * FPS);
      const secs = Math.floor(frames / FPS);
      const tc = `00:${pad(Math.floor(secs / 60))}:${pad(secs % 60)}:${pad(frames % FPS)}`;
      if (timecode.textContent !== tc) timecode.textContent = tc;
      const name = currentSection();
      if (sectionLabel.textContent !== name) sectionLabel.textContent = name;

      labels.forEach(({ strip, track, label }) => {
        strip.style.setProperty('--mk-color', rgb);
        if (getComputedStyle(label).display === 'none') return;
        const h = track.clientHeight, half = label.offsetHeight / 2;
        label.style.top = clamp(total * h, half, Math.max(half, h - half)) + 'px';
      });
    }

    let queued = false;
    // dot : scroll handler
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; update(); });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('load', update);
    update();
  })();