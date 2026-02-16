# BlendLink Platform - PRD

## Latest: Touch Scroll Fix v7 (Feb 16, 2026)

### Approach: 5-layer defense against scroll blocking

1. **index.html HEAD script**: Patches `addEventListener` to force passive on ALL touch/pointer events
2. **index.html HEAD script**: Overrides `Event.prototype.preventDefault` to no-op for touchmove/touchstart
3. **index.html HEAD script**: MutationObserver prevents overflow:hidden on body/html
4. **index.html HEAD script**: Periodic scan forces `touch-action: pan-y` on any element with `touch-action: none`
5. **CSS (index.css)**: Universal `* { touch-action: pan-y pan-x pinch-zoom !important; }` rule

### Specific fixes:
- Register.jsx: `overflow-hidden` → `overflow-x-hidden overflow-y-auto` on main wrapper
- premium-design-system.css: `.bl-premium-bg` → `overflow-y: auto; overflow-x: hidden`
- MintedPhotos.jsx: `touchAction: 'none'` → `touchAction: 'pan-y'`
- index.css: Removed 550 lines of conflicting scroll-fix CSS, replaced with clean minimal set

---
*Last Updated: February 16, 2026*
