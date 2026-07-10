// src/input.js
export function createInput(canvas) {
  const down = new Set();
  let taps = 0, held = false, clicked = false, clickX = 0, clickY = 0;
  let mouseX = null, mouseY = null; // null until the mouse first moves — no aim before that

  canvas.addEventListener('mousemove', e => {
    mouseX = e.offsetX;
    mouseY = e.offsetY;
  });

  let pausePending = false, rocketPending = false, legendPending = false, enterPending = false, escPending = false;
  let typed = []; // printable chars + 'Backspace' captured this frame (name field)

  window.addEventListener('keydown', e => {
    // edge-triggered pause: Esc or P, latch only on the first press
    if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) pausePending = true;
    // edge-triggered Escape only — used to blur the focused name field without
    // consuming 'P' (which is a printable char that must append to the name).
    if (e.code === 'Escape' && !e.repeat) escPending = true;
    // edge-triggered legend toggle: L, latch on first press (held L can't strobe)
    if (e.code === 'KeyL' && !e.repeat) legendPending = true;
    // edge-triggered Enter (menu start / name-field blur)
    if (e.code === 'Enter' && !e.repeat) enterPending = true;
    // Text capture for the pilot-name field: single printable chars (letters,
    // digits, space, dash all have key.length === 1) plus Backspace. The consumer
    // (main.js) only reads this while the field is focused and filters characters.
    if (e.key === 'Backspace' || (e.key && e.key.length === 1)) typed.push(e.key);
    down.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());

  canvas.addEventListener('mousedown', e => {
    // Right button (2): edge-triggered rocket launch. Context menu is already
    // suppressed below; don't touch left-button/held state.
    if (e.button === 2) { rocketPending = true; return; }
    if (e.button !== 0) return;
    taps += 1;
    held = true;
    clicked = true;
    clickX = e.offsetX;
    clickY = e.offsetY;
    mouseX = e.offsetX;
    mouseY = e.offsetY;
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) held = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  return {
    poll() {
      const snap = {
        thrust: down.has('KeyW') || down.has('ArrowUp'),
        reverse: down.has('KeyS') || down.has('ArrowDown'),
        strafeLeft: down.has('KeyA') || down.has('ArrowLeft'),   // lateral strafe, mirrors thrust/reverse
        strafeRight: down.has('KeyD') || down.has('ArrowRight'),
        boosting: down.has('ShiftLeft') || down.has('ShiftRight'), // continuous while Shift is held
        held, taps, clicked, clickX, clickY,
        aimX: mouseX, aimY: mouseY,
        key1: down.has('Digit1'), key2: down.has('Digit2'), key3: down.has('Digit3'),
        keyR: down.has('KeyR'),
        pausePressed: pausePending,
        rocketPressed: rocketPending,
        legendPressed: legendPending,
        enterPressed: enterPending,
        escPressed: escPending,
        typed,
      };
      taps = 0;
      clicked = false;
      pausePending = false;
      rocketPending = false;
      legendPending = false;
      enterPending = false;
      escPending = false;
      typed = []; // snap.typed keeps the old array reference
      return snap;
    },
  };
}
