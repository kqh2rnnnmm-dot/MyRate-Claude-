/* MyRate 3.1: shared icons, accessible overlays and isolated navigation gestures. */
window.MyRateInterface = (() => {
  'use strict';
  const paths = {
    gear: '<path d="m9 3-.7 2.2-2 .9-2.1-.5-1.5 2.6 1.5 1.7-.2 2.2L2.5 14 4 16.6l2.2-.4 1.8 1.3.6 2.2h3l.8-2.2 2-.9 2.1.5 1.5-2.6-1.5-1.7.2-2.2 1.5-1.7-1.5-2.6-2.2.4-1.8-1.3L12 3Z" transform="translate(2 1)"/><circle cx="12" cy="12" r="3"/>',
    wish: '<path d="m12 3 2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.2l5.9-.9Z"/>',
    bookmark: '<path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z"/>',
    plan: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M7 2v4m10-4v4M3 10h18m-14 4h3m4 0h3m-10 3h3"/>',
    search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
    archive: '<rect x="3" y="3" width="18" height="5" rx="1.5"/><path d="M5 8v12h14V8m-10 4h6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    back: '<path d="m14 5-7 7 7 7"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    arrows: '<path d="m8 7 4-4 4 4m-4-4v18m-4-4 4 4 4-4"/>',
    check: '<path d="m5 12 4 4L19 6"/>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.more}</svg>`;
  function icons(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
  }

  function hold(element, action, delay = 520) {
    let timer, start, suppress = false;
    const cancel = () => { clearTimeout(timer); start = null; };
    element.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !e.isPrimary) return;
      suppress = false; start = { x: e.clientX, y: e.clientY };
      timer = setTimeout(() => { suppress = true; action(e); }, delay);
    });
    element.addEventListener('pointermove', e => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) cancel();
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => element.addEventListener(type, cancel));
    element.addEventListener('contextmenu', e => e.preventDefault());
    element.addEventListener('click', e => {
      if (suppress) { suppress = false; e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
  }

  // Movement claims a gesture before the long-press timer. A stationary hold opens a menu.
  // Screens change only at release; transient previews cannot destroy selection or a draft.
  function navigation(root, indicator, onSelect, onMenu, current) {
    const buttons = [...root.querySelectorAll('[data-screen]')];
    let drag = null, timer, suppress = false;
    const indexAt = x => Math.max(0, Math.min(buttons.length - 1,
      buttons.findIndex(b => x < b.getBoundingClientRect().right) < 0 ? buttons.length - 1 : buttons.findIndex(b => x < b.getBoundingClientRect().right)));
    const paint = (i, followX) => {
      const r = root.getBoundingClientRect(), b = buttons[i].getBoundingClientRect();
      indicator.style.width = `${b.width}px`;
      indicator.style.transform = `translateX(${followX === undefined ? b.left - r.left : Math.max(6, Math.min(r.width - b.width - 6, followX - r.left - b.width / 2))}px)`;
    };
    const sync = () => {
      const i = Math.max(0, buttons.findIndex(b => b.dataset.screen === current()));
      buttons.forEach((b, n) => { b.classList.toggle('active', i === n); b.setAttribute('aria-current', i === n ? 'page' : 'false'); });
      paint(i);
    };
    const finish = (e, cancelled = false) => {
      if (!drag || e.pointerId !== drag.id) return;
      clearTimeout(timer);
      const d = drag; drag = null;
      root.classList.remove('is-dragging', 'is-held');
      if (!d.menu && !cancelled) onSelect(d.moved ? buttons[indexAt(e.clientX)].dataset.screen : d.screen);
      suppress = true;
      sync();
    };
    root.addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-screen]');
      if (!b || e.button !== 0 || !e.isPrimary) return;
      suppress = false; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, screen: b.dataset.screen, moved: false, menu: false };
      root.setPointerCapture?.(e.pointerId);
      root.classList.add('is-held');
      timer = setTimeout(() => {
        if (!drag || drag.moved) return;
        drag.menu = true; root.classList.remove('is-held'); onMenu(b.dataset.screen);
      }, 520);
    });
    root.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId || drag.menu) return;
      if (Math.abs(e.clientY - drag.y) > 36 && !drag.moved) { finish(e, true); return; }
      if (Math.abs(e.clientX - drag.x) > 8) {
        drag.moved = true; clearTimeout(timer); root.classList.add('is-dragging');
      }
      if (drag.moved) { e.preventDefault(); paint(indexAt(e.clientX), e.clientX); }
    });
    root.addEventListener('pointerup', e => finish(e));
    root.addEventListener('pointercancel', e => finish(e, true));
    root.addEventListener('lostpointercapture', e => finish(e, true));
    root.addEventListener('contextmenu', e => e.preventDefault());
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-screen]');
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      if (suppress && e.detail !== 0) { suppress = false; return; }
      onSelect(b.dataset.screen); sync();
    });
    root.addEventListener('keydown', e => {
      const b = e.target.closest('[data-screen]');
      if (!b) return;
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); onMenu(b.dataset.screen); }
      if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault(); const i = (buttons.indexOf(b) + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[i].focus(); onSelect(buttons[i].dataset.screen); sync();
      }
    });
    if (window.ResizeObserver) new ResizeObserver(sync).observe(root);
    addEventListener('resize', sync);
    return { sync };
  }

  function focusLayer(layer, onClose) {
    const previous = document.activeElement;
    const siblings = [...document.body.children].filter(el => el !== layer && el.id !== 'helpPopover' && !['SCRIPT', 'STYLE'].includes(el.tagName));
    const inertBefore = siblings.map(el => el.inert);
    siblings.forEach(el => { el.inert = true; });
    document.body.classList.add('modal-open');
    const controls = () => [...layer.querySelectorAll('button:not(:disabled), input, select, textarea, [tabindex="0"]')].filter(el => el.getClientRects().length);
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') {
        const a = controls(), first = a[0], last = a[a.length - 1];
        if (!a.length) { e.preventDefault(); return; }
        if (e.shiftKey && (document.activeElement === first || !layer.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    layer.addEventListener('keydown', key);
    // Focus a button, not an input: opening a dialog must not summon the phone keyboard.
    layer.querySelector('button')?.focus({ preventScroll: true });
    return () => {
      layer.removeEventListener('keydown', key);
      siblings.forEach((el, i) => { el.inert = inertBefore[i]; });
      document.body.classList.remove('modal-open');
      if (previous?.isConnected && !previous.matches('input,textarea,select')) previous.focus({ preventScroll: true });
    };
  }
  return { icon, icons, hold, navigation, focusLayer };
})();
