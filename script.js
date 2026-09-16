(() => {
  'use strict';

  const body = document.body;
  const launchButton = document.getElementById('launchButton');
  const countdownNumberEl = document.getElementById('countdownNumber');
  const revealMessage = document.getElementById('revealMessage');
  const canvas = document.getElementById('fireworksCanvas');
  const ctx = canvas.getContext('2d');

  const NEON_COLORS = ['#2e6ff2', '#29d8e0', '#17d68f', '#f7941d', '#e6394f', '#ffffff'];

  // ---------------------------------------------------------------------
  // Audio: everything synthesized via Web Audio API — no external files.
  // ---------------------------------------------------------------------
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playWhoosh() {
    const ac = getAudioCtx();
    const now = ac.currentTime;
    const duration = 0.9;

    const bufferSize = ac.sampleRate * duration;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ac.createBufferSource();
    noise.buffer = buffer;

    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(2500, now + duration);
    filter.Q.value = 0.8;

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.4, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter).connect(gain).connect(ac.destination);
    noise.start(now);
    noise.stop(now + duration);
  }

  // ---------------------------------------------------------------------
  // Fireworks: canvas particle system (rockets rise -> explode -> fade)
  // ---------------------------------------------------------------------
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let particles = [];
  let rockets = [];
  let animHandle = null;

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------------------------------------------------------------------
  // Keep the launch button anchored to the empty track between the two
  // trains in the background artwork, regardless of viewport aspect ratio
  // (the image is shown with object-fit: contain, so it may be letterboxed).
  // ---------------------------------------------------------------------
  const BG_IMAGE_ASPECT = 3016 / 1590;
  const BUTTON_X_PCT = 0.5;   // horizontal center of the image
  const BUTTON_Y_PCT = 0.72;  // vertical position within the image, between the trains

  function positionLaunchButton() {
    const stage = document.getElementById('stage');
    const containerW = stage.clientWidth;
    const containerH = stage.clientHeight;
    const containerAspect = containerW / containerH;

    let renderW, renderH, offsetX, offsetY;
    if (containerAspect > BG_IMAGE_ASPECT) {
      // Container relatively wider than the image -> letterboxed left/right
      renderH = containerH;
      renderW = renderH * BG_IMAGE_ASPECT;
      offsetX = (containerW - renderW) / 2;
      offsetY = 0;
    } else {
      // Container relatively taller than the image -> letterboxed top/bottom
      renderW = containerW;
      renderH = renderW / BG_IMAGE_ASPECT;
      offsetX = 0;
      offsetY = (containerH - renderH) / 2;
    }

    launchButton.style.left = (offsetX + renderW * BUTTON_X_PCT) + 'px';
    launchButton.style.top = (offsetY + renderH * BUTTON_Y_PCT) + 'px';
  }

  window.addEventListener('resize', () => {
    resizeCanvas();
    positionLaunchButton();
  });
  resizeCanvas();
  positionLaunchButton();

  function randomColor() {
    return NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
  }

  function spawnRocket(targetX, targetY, color, opts = {}) {
    const startX = targetX + (Math.random() * 60 - 30);
    rockets.push({
      x: startX,
      y: window.innerHeight + 10,
      targetY,
      vx: (targetX - startX) * 0.02,
      vy: -(9 + Math.random() * 3),
      color: color || randomColor(),
      trail: [],
      power: opts.power || 1,
      count: opts.count || 80,
      crackle: !!opts.crackle,
    });
  }

  function explode(x, y, color, count = 70, power = 1, opts = {}) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
      const speed = (2 + Math.random() * 4.5) * power;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.006 + Math.random() * 0.01,
        color,
        size: 1.5 + Math.random() * 2.6,
        crackle: opts.crackle && Math.random() < 0.35,
        crackled: false,
      });
    }
  }

  // Secondary "crackle" pop: a subset of particles burst again mid-flight,
  // giving the classic layered chrysanthemum firework look.
  function updateCrackles() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.crackle && !p.crackled && p.life < 0.55) {
        p.crackled = true;
        explode(p.x, p.y, p.color, 10, 0.4, {});
      }
    }
  }

  function fireworkBurst(x, y, opts = {}) {
    const color = opts.color || randomColor();
    spawnRocket(x, y, color, opts);
  }

  function grandFinale() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const points = [
      [w * 0.12, h * 0.32], [w * 0.32, h * 0.2], [w * 0.5, h * 0.28],
      [w * 0.68, h * 0.2], [w * 0.88, h * 0.32],
      [w * 0.22, h * 0.5], [w * 0.5, h * 0.42], [w * 0.78, h * 0.5],
    ];

    // Wave 1: opening salvo
    points.forEach((p, i) => {
      setTimeout(() => fireworkBurst(p[0], p[1], { color: randomColor(), power: 1.1, count: 110 }), i * 130);
    });

    // Wave 2: bigger, with crackle effect
    setTimeout(() => {
      points.forEach((p, i) => {
        setTimeout(() => fireworkBurst(
          p[0] + (Math.random() * 120 - 60),
          p[1] + (Math.random() * 40 - 20),
          { color: randomColor(), power: 1.3, count: 140, crackle: true }
        ), i * 110);
      });
    }, 900);

    // Wave 3: grand climax — biggest, densest, full-width
    setTimeout(() => {
      const climaxPoints = [
        [w * 0.5, h * 0.18], [w * 0.25, h * 0.35], [w * 0.75, h * 0.35],
        [w * 0.4, h * 0.5], [w * 0.6, h * 0.5],
      ];
      climaxPoints.forEach((p, i) => {
        setTimeout(() => fireworkBurst(p[0], p[1], { color: randomColor(), power: 1.6, count: 170, crackle: true }), i * 90);
      });
      playWhoosh();
    }, 1900);
  }

  function updateAndDraw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Rockets
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.trail.push({ x: r.x, y: r.y });
      if (r.trail.length > 8) r.trail.shift();
      r.x += r.vx;
      r.y += r.vy;
      r.vy += 0.05; // slight gravity slows ascent

      ctx.beginPath();
      r.trail.forEach((t, idx) => {
        ctx.globalAlpha = idx / r.trail.length;
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      if (r.y <= r.targetY || r.vy >= 0) {
        explode(r.x, r.y, r.color, r.count, r.power, { crackle: r.crackle });
        rockets.splice(i, 1);
      }
    }

    // Particles
    updateCrackles();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.045; // gravity
      p.vx *= 0.985;
      p.life -= p.decay;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      // subtle glow core for the grand-finale sparkle
      ctx.globalAlpha = Math.max(p.life, 0) * 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    animHandle = requestAnimationFrame(updateAndDraw);
  }
  updateAndDraw();

  // ---------------------------------------------------------------------
  // Countdown / state flow
  // ---------------------------------------------------------------------
  const COUNTDOWN_START = 5;
  const STEP_MS = 1100;

  function setState(state) {
    body.className = 'state-' + state;
  }

  function runCountdownStep(n) {
    countdownNumberEl.textContent = String(n);
    countdownNumberEl.classList.remove('pop');
    // Force reflow to restart animation
    void countdownNumberEl.offsetWidth;
    countdownNumberEl.classList.add('pop');

    const w = window.innerWidth;
    const h = window.innerHeight;
    fireworkBurst(
      w * (0.25 + Math.random() * 0.5),
      h * (0.25 + Math.random() * 0.25)
    );

    if (n > 1) {
      setTimeout(() => runCountdownStep(n - 1), STEP_MS);
    } else {
      setTimeout(runFinale, STEP_MS);
    }
  }

  function runFinale() {
    setState('finale');
    playWhoosh();
    grandFinale();

    // Grand finale plays out across ~3 staggered waves (see grandFinale) —
    // hold on the fireworks before fading to black and revealing the message.
    // The music keeps playing on through the reveal screen — it's only
    // stopped by the hidden hold-to-reset gesture (see resetToLaunch).
    setTimeout(() => {
      setState('reveal');
    }, 4800);
  }

  // ---------------------------------------------------------------------
  // Countdown music bed
  // ---------------------------------------------------------------------
  const countdownMusic = document.getElementById('countdownMusic');
  const MUSIC_VOLUME = 0.55;
  let musicFadeHandle = null;

  const MUSIC_START_TIME = 4.25; // seconds into the track to start from

  function playMusic() {
    clearInterval(musicFadeHandle);
    countdownMusic.currentTime = MUSIC_START_TIME;
    countdownMusic.volume = MUSIC_VOLUME;
    countdownMusic.play().catch((err) => {
      console.error('Countdown music failed to play:', err);
    });
  }

  function fadeOutMusic(durationMs) {
    clearInterval(musicFadeHandle);
    const steps = 20;
    const stepMs = durationMs / steps;
    const startVolume = countdownMusic.volume;
    let step = 0;
    musicFadeHandle = setInterval(() => {
      step++;
      countdownMusic.volume = Math.max(startVolume * (1 - step / steps), 0);
      if (step >= steps) {
        clearInterval(musicFadeHandle);
        countdownMusic.pause();
      }
    }, stepMs);
  }

  function stopMusic() {
    clearInterval(musicFadeHandle);
    countdownMusic.pause();
    countdownMusic.currentTime = MUSIC_START_TIME;
  }

  function beginLaunchSequence() {
    if (body.classList.contains('state-launch') === false) return;
    getAudioCtx(); // unlock audio on user gesture

    launchButton.classList.add('is-launching');
    playMusic();

    setTimeout(() => {
      setState('countdown');
      runCountdownStep(COUNTDOWN_START);
    }, 500);
  }

  launchButton.addEventListener('click', beginLaunchSequence);

  // ---------------------------------------------------------------------
  // Hidden rehearsal reset: press and hold the reveal message for 2s
  // ---------------------------------------------------------------------
  let holdTimer = null;

  function resetToLaunch() {
    launchButton.classList.remove('is-launching');
    stopMusic();
    particles = [];
    rockets = [];
    countdownNumberEl.textContent = '';
    countdownNumberEl.classList.remove('pop');
    setState('launch');
  }

  function startHold() {
    holdTimer = setTimeout(resetToLaunch, 2000);
  }
  function cancelHold() {
    clearTimeout(holdTimer);
  }

  revealMessage.addEventListener('pointerdown', startHold);
  revealMessage.addEventListener('pointerup', cancelHold);
  revealMessage.addEventListener('pointerleave', cancelHold);
})();
