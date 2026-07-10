// src/input.js
export function createInput(canvas) {
  const down = new Set();
  let taps = 0, held = false, clicked = false, clickX = 0, clickY = 0;
  let mouseX = null, mouseY = null; // null until the mouse first moves — no aim before that

  canvas.addEventListener('mousemove', e => {
    mouseX = e.offsetX;
    mouseY = e.offsetY;
  });

  let dashPending = false;
  let pausePending = false;

  window.addEventListener('keydown', e => {
    // edge-triggered dash: latch only on the first press, key repeat must not re-fire
    if (e.code === 'Space' && !e.repeat) dashPending = true;
    // edge-triggered pause: Esc or P, same latch pattern as dash
    if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) pausePending = true;
    down.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());

  canvas.addEventListener('mousedown', e => {
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
        rotate: (down.has('KeyD') || down.has('ArrowRight') ? 1 : 0)
              - (down.has('KeyA') || down.has('ArrowLeft') ? 1 : 0),
        thrust: down.has('KeyW') || down.has('ArrowUp'),
        held, taps, clicked, clickX, clickY,
        aimX: mouseX, aimY: mouseY,
        key1: down.has('Digit1'), key2: down.has('Digit2'), key3: down.has('Digit3'),
        keyR: down.has('KeyR'),
        dashPressed: dashPending,
        pausePressed: pausePending,
      };
      taps = 0;
      clicked = false;
      dashPending = false;
      pausePending = false;
      return snap;
    },
  };
}
