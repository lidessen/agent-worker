(() => {
  const data = window.AGENT_EVOLUTION_DATA;
  if (!data) {
    throw new Error('AGENT_EVOLUTION_DATA is required before agent-evolution.js');
  }

  const tweakDefaults = window.__AGENT_EVOLUTION_TWEAK_DEFAULTS__ || {
    transition: 'morph',
    txStyle: 'terminal',
    theme: 'light',
  };

  const {
    TX,
    GEN3_STEPS,
    GEN4_EVENTS,
    GEN4_L2,
    GEN4_SESSION,
    GEN4_ASIDE,
    GEN5_PARTITIONS,
    GEN5_STEP_TO_KEY,
  } = data;

  function lineEl(line) {
    const el = document.createElement('div');
    el.className = 'tx__line ' + (line.cls || '');

    const role = document.createElement('div');
    role.className = 'role';
    role.textContent = line.role || '';

    const body = document.createElement('div');
    body.className = 'body' + (line.bodyClass ? ' ' + line.bodyClass : '');
    body.textContent = line.body || '';

    el.appendChild(role);
    el.appendChild(body);
    return el;
  }

  function renderList(container, lines) {
    container.innerHTML = '';
    lines.forEach((line, index) => {
      const el = lineEl(line);
      container.appendChild(el);
      setTimeout(() => el.classList.add('in'), 40 + index * 40);
    });
  }

  function renderPartitions(container, partitions) {
    container.innerHTML = '';

    partitions.forEach((partition, partitionIndex) => {
      const section = document.createElement('div');
      section.className = 'partition' + (partition.compacted ? ' compacted' : '');

      const head = document.createElement('div');
      head.className = 'partition__head';
      head.textContent = partition.head;
      section.appendChild(head);

      partition.lines.forEach((line) => {
        section.appendChild(lineEl(line));
      });

      container.appendChild(section);

      [...section.querySelectorAll('.tx__line')].forEach((el, lineIndex) => {
        setTimeout(() => el.classList.add('in'), 60 + partitionIndex * 40 + lineIndex * 25);
      });
    });
  }

  function buildLayerHead(tagText, subtagText) {
    const head = document.createElement('div');
    head.className = 'layer-head';

    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = tagText;

    const subtag = document.createElement('span');
    subtag.className = 'subtag';
    subtag.textContent = subtagText;

    head.appendChild(tag);
    head.appendChild(subtag);
    return head;
  }

  function renderGen4(container, step) {
    container.innerHTML = '';

    if (step >= 3) {
      const l2 = document.createElement('div');
      l2.className = 'split__layer l1';
      l2.style.background = 'oklch(0.70 0.08 30 / 0.04)';
      l2.appendChild(buildLayerHead('L2', '更高层摘要 · 只在真的需要时再加'));

      GEN4_L2.forEach((entry) => {
        const row = lineEl({ ...entry, bodyClass: 'italic' });
        l2.appendChild(row);
      });

      const l2Tag = l2.querySelector('.tag');
      l2Tag.style.background = 'oklch(0.70 0.08 30 / 0.15)';
      l2Tag.style.borderColor = 'oklch(0.70 0.08 30 / 0.4)';

      container.appendChild(l2);
    }

    const l1 = document.createElement('div');
    l1.className = 'split__layer l1';
    l1.appendChild(buildLayerHead('L1', '项目脉络 · 每次 run 留一行'));

    const eventCount = step === 0 ? 2 : step === 1 ? 4 : GEN4_EVENTS.length;
    GEN4_EVENTS.slice(0, eventCount).forEach((entry) => {
      l1.appendChild(lineEl({
        role: `${entry.t} · ${entry.role}`,
        cls: entry.cls,
        body: entry.body,
      }));
    });
    container.appendChild(l1);

    if (step >= 2) {
      const connector = document.createElement('div');
      connector.className = 'layer-conn';

      const up = document.createElement('span');
      up.textContent = '↑ 一次 run 结束后,往上折成一条事件';
      const down = document.createElement('span');
      down.textContent = '↓ 展开 t04,就是一次完整 L0';

      connector.appendChild(up);
      connector.appendChild(down);
      container.appendChild(connector);

      const l0 = document.createElement('div');
      l0.className = 'split__layer l0';
      l0.appendChild(buildLayerHead('L0', '具体任务 · 跟今天的对话一样'));

      const session = document.createElement('div');
      session.className = 'l0-session';
      GEN4_SESSION.forEach((line) => {
        session.appendChild(lineEl(line));
      });
      l0.appendChild(session);

      const aside = document.createElement('div');
      aside.className = 'l0-aside';

      const asideTag = document.createElement('span');
      asideTag.className = 'aside-tag';
      asideTag.textContent = GEN4_ASIDE.tag;

      const asideBody = document.createElement('span');
      asideBody.className = 'aside-body';
      asideBody.textContent = GEN4_ASIDE.body;

      aside.appendChild(asideTag);
      aside.appendChild(asideBody);
      l0.appendChild(aside);

      container.appendChild(l0);
    }

    [...container.querySelectorAll('.tx__line, .layer-conn, .l0-aside')].forEach((el, index) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(4px)';
      el.style.transition = 'opacity 240ms var(--ease-out), transform 240ms var(--ease-out)';
      setTimeout(() => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      }, 40 + index * 14);
    });
  }

  const ERA1_MAP = [0, 0, 1];
  const ERA2_MAP = [0, 0, 1, 1];
  const ERA3_MAP = [0, 1, 1, 2, 3, 3];
  const ERA4_MAP = [0, 1, 2, 2, 2, 3];
  const ERA5_MAP = [0, 1, 2, 3, 4, 5];

  function renderGen5(container, step) {
    container.innerHTML = '';
    const activeKey = GEN5_STEP_TO_KEY[step] || GEN5_STEP_TO_KEY[0];

    GEN5_PARTITIONS.forEach((partition, partitionIndex) => {
      const section = document.createElement('div');
      const isActive = partition.key === activeKey;
      section.className = 'partition' + (isActive ? ' partition--active' : ' partition--dim');

      const head = document.createElement('div');
      head.className = 'partition__head';
      head.textContent = partition.head;
      section.appendChild(head);

      partition.lines.forEach((line) => {
        section.appendChild(lineEl(line));
      });

      container.appendChild(section);

      [...section.querySelectorAll('.tx__line')].forEach((el, lineIndex) => {
        setTimeout(() => el.classList.add('in'), 40 + partitionIndex * 30 + lineIndex * 20);
      });
    });
  }

  function renderEra(era, step) {
    if (era === 1) {
      const dataStep = ERA1_MAP[step] ?? 1;
      renderList(document.getElementById('tx-1-body'), TX[1][dataStep] || TX[1][1]);
      return;
    }

    if (era === 2) {
      const dataStep = ERA2_MAP[step] ?? 1;
      renderList(document.getElementById('tx-2-body'), TX[2][dataStep] || TX[2][1]);
      return;
    }

    if (era === 3) {
      const dataStep = ERA3_MAP[step] ?? 3;
      renderPartitions(document.getElementById('tx-3-body'), GEN3_STEPS[dataStep] || GEN3_STEPS[3]);
      return;
    }

    if (era === 4) {
      const dataStep = ERA4_MAP[step] ?? 3;
      renderGen4(document.getElementById('tx-4-body'), dataStep);
      return;
    }

    if (era === 5) {
      const dataStep = ERA5_MAP[step] ?? 0;
      renderGen5(document.getElementById('tx-5-body'), dataStep);
    }
  }

  const eraState = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  function setStep(era, step) {
    const total = Number(document.querySelector(`.slide[data-era="${era}"]`)?.dataset.steps || 0);
    const nextStep = Math.max(0, Math.min(total - 1, step));
    eraState[era] = nextStep;

    const host = document.querySelector(`.step-host[data-host="${era}"]`);
    host?.querySelectorAll('.substep').forEach((substep) => {
      substep.classList.toggle('active', Number(substep.dataset.step) === nextStep);
    });

    const rail = document.querySelector(`.step-rail[data-rail="${era}"]`);
    rail?.querySelectorAll('.tick').forEach((tick) => {
      const tickStep = Number(tick.dataset.step);
      tick.classList.toggle('active', tickStep === nextStep);
      tick.classList.toggle('done', tickStep < nextStep);
    });

    renderEra(era, nextStep);
  }

  document.querySelectorAll('.step-rail').forEach((rail) => {
    const era = Number(rail.dataset.rail);
    rail.querySelectorAll('.tick').forEach((tick) => {
      tick.addEventListener('click', () => setStep(era, Number(tick.dataset.step)));
    });
  });

  [1, 2, 3, 4, 5].forEach((era) => setStep(era, 0));

  const deck = document.getElementById('deck');
  const slides = [...document.querySelectorAll('.slide')];
  const dots = [...document.querySelectorAll('.nav-dot')];
  const chapterNum = document.getElementById('chapter-num');
  let currentIdx = 0;

  function currentEra() {
    const slide = slides[currentIdx];
    return slide?.dataset.era ? Number(slide.dataset.era) : null;
  }

  function updateChrome(idx) {
    currentIdx = idx;
    dots.forEach((dot, dotIdx) => dot.classList.toggle('active', dotIdx === idx));
    chapterNum.textContent = String(idx).padStart(2, '0');

    try {
      localStorage.setItem('agent-evo-scene', String(idx));
    } catch {}
  }

  const sceneObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.55) {
        const idx = slides.indexOf(entry.target);
        if (idx >= 0 && idx !== currentIdx) {
          updateChrome(idx);
        }
      }
    });
  }, { root: deck, threshold: [0.55, 0.7] });

  slides.forEach((slide) => sceneObserver.observe(slide));

  function goToSlide(idx) {
    const target = Math.max(0, Math.min(slides.length - 1, idx));
    slides[target].scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  dots.forEach((dot) => {
    dot.addEventListener('click', () => goToSlide(Number(dot.dataset.idx)));
  });

  window.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON') {
      return;
    }

    const era = currentEra();
    const forward = ['ArrowDown', 'ArrowRight', ' ', 'PageDown'].includes(event.key);
    const back = ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(event.key);

    if (!forward && !back) {
      return;
    }

    if (era) {
      const total = Number(document.querySelector(`.slide[data-era="${era}"]`)?.dataset.steps || 0);
      const step = eraState[era];

      if (forward && step < total - 1) {
        event.preventDefault();
        setStep(era, step + 1);
        return;
      }

      if (back && step > 0) {
        event.preventDefault();
        setStep(era, step - 1);
        return;
      }
    }

    if (forward) {
      event.preventDefault();
      goToSlide(currentIdx + 1);
    }

    if (back) {
      event.preventDefault();
      goToSlide(currentIdx - 1);
    }
  });

  document.querySelectorAll('.era__right').forEach((panel) => {
    panel.addEventListener('click', (event) => {
      if (event.target.closest('.step-rail') || event.target.closest('.tweaks')) {
        return;
      }

      const slide = panel.closest('.slide');
      const era = Number(slide?.dataset.era);
      const total = Number(slide?.dataset.steps || 0);
      const step = eraState[era];

      const rect = panel.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      const goBack = event.shiftKey || ratio < 0.22;

      if (goBack) {
        if (step > 0) {
          setStep(era, step - 1);
        } else {
          goToSlide(currentIdx - 1);
        }
        return;
      }

      if (step < total - 1) {
        setStep(era, step + 1);
      } else {
        goToSlide(currentIdx + 1);
      }
    });
  });

  try {
    const last = Number(localStorage.getItem('agent-evo-scene') || 0);
    if (last > 0 && last < slides.length) {
      slides[last].scrollIntoView({ behavior: 'instant', block: 'start' });
      updateChrome(last);
    }
  } catch {}

  const tweaksEl = document.getElementById('tweaks');
  const currentTweaks = { ...tweakDefaults };

  function applyTweaks(tweaks) {
    document.body.dataset.transition = tweaks.transition;
    document.body.dataset.txStyle = tweaks.txStyle;
    document.documentElement.dataset.theme = tweaks.theme;

    document.querySelectorAll('.seg').forEach((seg) => {
      const key = seg.dataset.tweak;
      const mapKey = key === 'tx-style' ? 'txStyle' : key;

      seg.querySelectorAll('button').forEach((button) => {
        button.classList.toggle('active', button.dataset.v === tweaks[mapKey]);
      });
    });
  }

  applyTweaks(currentTweaks);

  document.querySelectorAll('.seg').forEach((seg) => {
    seg.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) {
        return;
      }

      const key = seg.dataset.tweak;
      const mapKey = key === 'tx-style' ? 'txStyle' : key;
      currentTweaks[mapKey] = button.dataset.v;
      applyTweaks(currentTweaks);

      try {
        window.parent.postMessage({
          type: '__edit_mode_set_keys',
          edits: { [mapKey]: button.dataset.v },
        }, '*');
      } catch {}
    });
  });

  document.getElementById('tweaks-close')?.addEventListener('click', () => {
    tweaksEl?.classList.remove('open');
  });

  window.addEventListener('message', (event) => {
    if (event.data?.type === '__activate_edit_mode') {
      tweaksEl?.classList.add('open');
    }

    if (event.data?.type === '__deactivate_edit_mode') {
      tweaksEl?.classList.remove('open');
    }
  });

  try {
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
  } catch {}
})();
