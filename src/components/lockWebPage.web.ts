import { Colors } from '@/constants/colors';

// The page itself stays put: dark behind the app (no white when the browser over-scrolls or bounces),
// and no sideways scroll when a decorative shape sticks out of the screen.
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    html, body { background-color: ${Colors.darkBg}; overscroll-behavior: none; overflow-x: hidden; }
    @supports (overflow: clip) { html, body { overflow-x: clip; } }
  `;
  document.head.appendChild(style);
}

export {};
