/**
 * High-graphic GSAP scene templates for HyperFrames compositions.
 * Each scene is seekable via a paused GSAP timeline registered for producers.
 */

function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bgCss(background) {
  if (!background) return 'background:#0a0a0f;';
  if (background.type === 'image') {
    return `background:#0a0a0f url('${esc(background.value)}') center/cover no-repeat;`;
  }
  if (background.type === 'video') {
    return 'background:#000;';
  }
  if (background.type === 'gradient') {
    return `background:${background.value};`;
  }
  return `background:${background.value || '#0a0a0f'};`;
}

export function renderSceneHtml(scene, ctx) {
  const start = Number(ctx.globalStart || 0);
  const dur = Number(scene.duration || 4);
  const accent = scene.accentColor || ctx.accent || '#67e8f9';
  const id = esc(scene.id);

  switch (scene.template) {
    case 'bullet-explainer':
      return renderBullets(scene, { start, dur, accent, id });
    case 'screenshot-kenburns':
      return renderKenBurns(scene, { start, dur, accent, id });
    case 'quote':
      return renderQuote(scene, { start, dur, accent, id });
    case 'cta-outro':
      return renderCta(scene, { start, dur, accent, id });
    case 'legacy-overlays':
      return renderLegacyShell(scene, { start, dur, id });
    case 'title-card':
    default:
      return renderTitleCard(scene, { start, dur, accent, id });
  }
}

function renderTitleCard(scene, { start, dur, accent, id }) {
  return `
  <section id="${id}" class="scene scene-title" data-start="${start.toFixed(2)}" data-duration="${dur.toFixed(2)}" data-track-index="1"
    style="${bgCss(scene.background)}">
    <div class="orb" style="--accent:${esc(accent)}"></div>
    <h1 class="hf-title" data-anim="title">${esc(scene.title)}</h1>
    ${scene.subtitle ? `<p class="hf-subtitle" data-anim="sub">${esc(scene.subtitle)}</p>` : ''}
  </section>`;
}

function renderBullets(scene, { start, dur, accent, id }) {
  const bullets = (scene.bullets?.length ? scene.bullets : scene.layers?.map((l) => l.text).filter(Boolean) || ['Point one', 'Point two', 'Point three']).slice(0, 5);
  return `
  <section id="${id}" class="scene scene-bullets" data-start="${start.toFixed(2)}" data-duration="${dur.toFixed(2)}" data-track-index="1"
    style="${bgCss(scene.background)}">
    <h2 class="hf-heading" data-anim="title" style="--accent:${esc(accent)}">${esc(scene.title)}</h2>
    <ul class="hf-bullets">
      ${bullets.map((b, i) => `<li data-anim="bullet" data-i="${i}" style="--accent:${esc(accent)}">${esc(b)}</li>`).join('')}
    </ul>
  </section>`;
}

function renderKenBurns(scene, { start, dur, accent, id }) {
  const img = scene.imageUrl || scene.background?.type === 'image' ? (scene.imageUrl || scene.background.value) : null;
  return `
  <section id="${id}" class="scene scene-kenburns" data-start="${start.toFixed(2)}" data-duration="${dur.toFixed(2)}" data-track-index="1"
    style="background:#050508;">
    ${img ? `<img class="kb-img" data-anim="kb" src="${esc(img)}" alt="" />` : `<div class="kb-fallback" style="--accent:${esc(accent)}"></div>`}
    <div class="kb-veil"></div>
    <div class="kb-copy">
      <p class="kb-kicker" data-anim="kicker" style="color:${esc(accent)}">Visual</p>
      <h2 class="hf-heading" data-anim="title">${esc(scene.title)}</h2>
      ${scene.subtitle ? `<p class="hf-subtitle" data-anim="sub">${esc(scene.subtitle)}</p>` : ''}
    </div>
  </section>`;
}

function renderQuote(scene, { start, dur, accent, id }) {
  const quote = scene.subtitle || scene.layers?.[0]?.text || scene.title;
  return `
  <section id="${id}" class="scene scene-quote" data-start="${start.toFixed(2)}" data-duration="${dur.toFixed(2)}" data-track-index="1"
    style="${bgCss(scene.background)}">
    <div class="quote-mark" style="color:${esc(accent)}">“</div>
    <blockquote class="hf-quote" data-anim="title">${esc(quote)}</blockquote>
    <p class="hf-subtitle" data-anim="sub">${esc(scene.title)}</p>
  </section>`;
}

function renderCta(scene, { start, dur, accent, id }) {
  return `
  <section id="${id}" class="scene scene-cta" data-start="${start.toFixed(2)}" data-duration="${dur.toFixed(2)}" data-track-index="1"
    style="${bgCss(scene.background)}">
    <p class="kb-kicker" data-anim="kicker" style="color:${esc(accent)}">Next step</p>
    <h2 class="hf-title cta-title" data-anim="title">${esc(scene.title)}</h2>
    <div class="cta-pill" data-anim="pill" style="background:${esc(accent)};color:#041016;">
      ${esc(scene.subtitle || 'Get started')}
    </div>
  </section>`;
}

function renderLegacyShell(scene, { start, dur, id }) {
  return `
  <section id="${id}" class="scene scene-legacy" data-start="${start.toFixed(2)}" data-duration="${dur.toFixed(2)}" data-track-index="1"
    style="${bgCss(scene.background)};pointer-events:none;">
  </section>`;
}

export function sceneStyles() {
  return `
    .orb {
      position: absolute;
      width: 520px; height: 520px;
      left: 58%; top: 10%;
      border-radius: 50%;
      background: radial-gradient(circle, color-mix(in srgb, var(--accent) 45%, transparent), transparent 70%);
      filter: blur(8px);
      opacity: 0.85;
    }
    .hf-title {
      position: absolute;
      left: 8%; right: 8%;
      top: 42%;
      margin: 0;
      font-size: 92px;
      font-weight: 800;
      letter-spacing: -2px;
      line-height: 1.05;
      opacity: 0;
    }
    .cta-title { font-size: 78px; top: 38%; text-align: center; left: 10%; right: 10%; }
    .hf-subtitle {
      position: absolute;
      left: 8%; right: 20%;
      top: 62%;
      margin: 0;
      font-size: 28px;
      font-weight: 500;
      color: rgba(255,255,255,0.78);
      opacity: 0;
      font-family: 'Inter', sans-serif;
    }
    .hf-heading {
      position: absolute;
      left: 8%; right: 8%;
      top: 14%;
      margin: 0;
      font-size: 56px;
      font-weight: 800;
      opacity: 0;
      border-left: 6px solid var(--accent, #67e8f9);
      padding-left: 18px;
    }
    .hf-bullets {
      position: absolute;
      left: 8%;
      top: 32%;
      list-style: none;
      margin: 0; padding: 0;
      display: flex;
      flex-direction: column;
      gap: 18px;
      width: min(900px, 80%);
    }
    .hf-bullets li {
      opacity: 0;
      font-size: 32px;
      font-weight: 600;
      padding: 16px 22px;
      border-radius: 14px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-left: 4px solid var(--accent, #67e8f9);
      font-family: 'Space Grotesk', 'Inter', sans-serif;
    }
    .scene-kenburns .kb-img, .scene-kenburns .kb-fallback {
      position: absolute; inset: -8%;
      width: 116%; height: 116%;
      object-fit: cover;
      opacity: 0;
    }
    .kb-fallback {
      background: radial-gradient(circle at 40% 40%, var(--accent, #67e8f9), #0a0a0f 70%);
    }
    .kb-veil {
      position: absolute; inset: 0;
      background: linear-gradient(90deg, rgba(5,5,8,0.92) 0%, rgba(5,5,8,0.45) 55%, rgba(5,5,8,0.2) 100%);
    }
    .kb-copy { position: absolute; left: 7%; right: 35%; top: 28%; }
    .kb-kicker {
      font-size: 18px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-weight: 700;
      opacity: 0;
      margin: 0 0 12px;
    }
    .kb-copy .hf-heading {
      position: relative; top: auto; left: auto; right: auto;
      border-left: none; padding-left: 0; font-size: 64px;
    }
    .kb-copy .hf-subtitle {
      position: relative; top: auto; left: auto; right: auto; margin-top: 16px;
    }
    .scene-quote .quote-mark {
      position: absolute; left: 8%; top: 18%;
      font-size: 180px; line-height: 1; opacity: 0.35; font-family: Georgia, serif;
    }
    .hf-quote {
      position: absolute;
      left: 12%; right: 12%; top: 36%;
      margin: 0;
      font-size: 48px;
      font-weight: 700;
      line-height: 1.25;
      opacity: 0;
    }
    .scene-quote .hf-subtitle { top: 72%; font-size: 22px; letter-spacing: 0.08em; text-transform: uppercase; }
    .cta-pill {
      position: absolute;
      left: 50%;
      top: 62%;
      transform: translate(-50%, -50%) scale(0.9);
      padding: 18px 36px;
      border-radius: 999px;
      font-size: 24px;
      font-weight: 800;
      opacity: 0;
      font-family: 'Inter', sans-serif;
    }
  `;
}

export function sceneScripts() {
  return `
    (function () {
      window.__timelines = window.__timelines || {};
      const root = document.getElementById('root');
      const compositionId = root?.getAttribute('data-composition-id') || 'motionforge';

      function revealStatic() {
        if (root) root.setAttribute('data-no-timeline', 'true');
        document.querySelectorAll('.scene').forEach((s) => {
          s.classList.add('is-static-preview');
          s.style.opacity = '1';
        });
        document.querySelectorAll('[data-anim]').forEach((el) => {
          el.style.opacity = '1';
          el.style.transform = 'none';
        });
      }

      if (typeof gsap === 'undefined') {
        revealStatic();
        return;
      }

      const scenes = Array.from(document.querySelectorAll('.scene'));
      const master = gsap.timeline({ paused: true });

      scenes.forEach((scene) => {
        const start = parseFloat(scene.getAttribute('data-start') || '0');
        const dur = parseFloat(scene.getAttribute('data-duration') || '4');
        const local = gsap.timeline();

        // Keep scene visible for its window; animate children for polish
        local.set(scene, { opacity: 1 }, 0);
        local.fromTo(scene, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power1.out' }, 0);
        local.to(scene, { opacity: 0, duration: 0.25, ease: 'power1.in' }, Math.max(0.5, dur - 0.25));

        const title = scene.querySelector('[data-anim="title"]');
        const sub = scene.querySelector('[data-anim="sub"]');
        const kicker = scene.querySelector('[data-anim="kicker"]');
        const pill = scene.querySelector('[data-anim="pill"]');
        const kb = scene.querySelector('[data-anim="kb"], .kb-fallback');
        const bullets = scene.querySelectorAll('[data-anim="bullet"]');

        if (kb) {
          local.fromTo(kb, { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1.18, duration: dur, ease: 'none' }, 0);
        }
        if (kicker) {
          local.fromTo(kicker, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45 }, 0.15);
        }
        if (title) {
          local.fromTo(title, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.2);
        }
        if (sub) {
          local.fromTo(sub, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, 0.45);
        }
        bullets.forEach((el, i) => {
          local.fromTo(el, { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.45, ease: 'power2.out' }, 0.35 + i * 0.18);
        });
        if (pill) {
          local.fromTo(pill, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.55);
        }

        master.add(local, start);
      });

      window.__timelines[compositionId] = master;
      window.__hfTimeline = master;
      window.__hfSeek = (t) => master.seek(t);

      // Ensure first frame isn't stuck at opacity 0 before the player seeks
      try { master.seek(0.35); } catch (e) {}
    })();
  `;
}
