# Frequently Asked Questions

## Installation & Setup

### Does Garten have any dependencies?

**No.** Garten is a zero-dependency library. It uses only native browser APIs:

- Canvas 2D API for rendering
- `requestAnimationFrame` for animation
- `ResizeObserver` for responsive sizing (falls back to the window `resize` event where it is unavailable)
- Built-in `Math` for procedural generation

Dev dependencies (the `tsup` bundler, the `typescript` compiler, and test tooling such as `vitest`, `fast-check`, `jsdom`, Playwright, Stryker and `es-check`) are build- and test-time only and are not shipped to users.

### What browsers are supported?

Chrome 64+, Firefox 69+, Safari 12+, Edge 79+ (the bundles are compiled to these targets). Canvas 2D is required; `ResizeObserver` is used when present, otherwise Garten listens for window `resize` events, which do not see container-only size changes.

### Why isn't anything showing up?

Check these common issues:

1. **Container has no height** - The container needs an explicit height:
   ```css
   #garden { height: 400px; }
   ```

2. **Container selector is wrong** - Verify your selector matches an element:
   ```javascript
   // Make sure this element exists
   new Garten({ container: '#garden' });
   ```

3. **JavaScript error** - Check the browser console for errors.

4. **Canvas is behind content** - The canvas uses `z-index: -1`. Ensure your container has `position: relative` or the canvas may be hidden.

### Does Garten work on dark or colored pages?

Yes. The canvas background is transparent by default, so the garden draws
directly over whatever is behind it. If you want the canvas to paint its own
background, set the `background` option to any CSS color:

```javascript
new Garten({ container: '#garden', background: '#0b1020' });
```

If you use `fadeHeight`, set `fadeColor` to match your page background so the
fade blends correctly. `fadeColor` accepts hex, named, RGB and HSL colors; `'transparent'`
fades the plant tops out to transparent instead of to a color.

### Can I use Garten with React/Vue/Svelte?

Yes. Garten is framework-agnostic. Use a ref to get the container element:

```jsx
// React example
function Garden() {
  const containerRef = useRef(null);

  useEffect(() => {
    const garden = new Garten({ container: containerRef.current });
    return () => garden.destroy();
  }, []);

  return <div ref={containerRef} style={{ height: '400px' }} />;
}
```

---

## Configuration

### How do I make the plants smaller/shorter?

Use the `maxHeight` option (0-1 range, fraction of container height):

```javascript
new Garten({
  container: '#garden',
  maxHeight: 0.2  // Plants fill bottom 20% only
});
```

### Why don't plants fill the entire maxHeight?

Each plant category has natural height ranges to create realistic proportions:

| Category | Height Range |
|----------|--------------|
| Grass, Succulents | 3-10% |
| Ferns, Herbs | 6-14% |
| Bushes | 8-16% |
| Wildflowers | 8-18% |
| Daisies, Orchids | 10-20% |
| Simple flowers | 10-22% |
| Tulips | 12-22% |
| Roses | 12-25% |
| Lilies | 14-26% |
| Specialty (Sunflowers, etc.) | 12-28% |
| **Tall Flowers** (Hollyhocks, Foxgloves) | 30-50% |
| **Giant Grasses** (Bamboo, Miscanthus) | 40-70% |
| **Tropical** (Palms, Bird of Paradise) | 50-85% |
| **Climbers** (Wisteria, Clematis) | 50-90% |
| **Conifers** (Pine, Cypress, Juniper) | 55-100% |
| **Small Trees** (Birch, Willow, Cherry) | 60-100% |

A category is available only when `maxHeight` is at least the bottom of its
range. Heights are drawn from the category range capped at `maxHeight`, and
no plant's stem is drawn taller than it; flower heads, lavender spikes and
pampas plumes can rise somewhat above the line.

The `maxHeight` option controls both which plant categories appear and their
distribution. The percentages below are the expected share of tall-category
plants (tall flowers through small trees) from the category weights in
`src/plants/generator.ts`; any one garden varies around them:

- `maxHeight: 0.35` (default) — Ground-level plants plus tall flowers (unlocked at 0.30), ~6% tall plants
- `maxHeight: 0.5` — Adds giant grasses (0.40), climbers and tropical plants (0.50), ~23% tall plants
- `maxHeight: 0.7` — Adds conifers (0.55) and small trees (0.60), ~40% tall plants
- `maxHeight: 1.0` — Full "overgrown garden" with trees reaching the top, ~50% tall plants

As you increase `maxHeight`, the library automatically:
1. Unlocks taller plant categories
2. Increases the weight of tall categories (up to 4x at `maxHeight: 1.0`)
3. Above 0.5, biases plant heights toward the top of their range so some reach the top

This creates a dramatic difference between a tidy garden (`0.35`) and an overgrown forest (`1.0`).

### How do I change the colors?

Use the `colors` option:

```javascript
new Garten({
  container: '#garden',
  colors: {
    accent: '#FF6B6B',      // Primary flower color
    palette: 'warm',        // 'natural' | 'warm' | 'cool' | 'grayscale' | 'vibrant' | 'monotone'
    accentWeight: 0.5       // 50% of flowers use accent color
  }
});
```

### How do I speed up the animation?

Two approaches:

1. **Shorter duration** - Complete the animation faster:
   ```javascript
   new Garten({ container: '#garden', duration: 60 });  // 1 minute instead of 10
   ```

2. **Higher speed** - Play at 2x, 5x, etc.:
   ```javascript
   garden.setSpeed(5);  // 5x faster
   ```

### How do I get the same garden every time?

Use a fixed `seed`:

```javascript
new Garten({
  container: '#garden',
  seed: 12345  // Same seed = same garden
});
```

### How do I generate a different garden every time?

Don't provide a `seed` option - Garten uses a random seed by default:

```javascript
new Garten({
  container: '#garden'
  // No seed = random garden each time
});
```

Or explicitly generate a random seed:

```javascript
new Garten({
  container: '#garden',
  seed: Math.random() * 100000
});
```

To regenerate a new garden programmatically at runtime:

```javascript
garden.setOptions({ seed: Math.random() * 100000 });
// Or to regenerate with current options (same seed = same garden):
garden.regenerate();  // Regenerates plants with current options
```

### What does `timingCurve` do?

It controls how generations are paced over the duration. The curve is the
fraction of generations that have started at each point in the animation:

| Value | Effect |
|-------|--------|
| `'linear'` | Even pacing (default) |
| `'ease-out'` | Fast start: new generations arrive quickly at first, then slow down toward the end |
| `'ease-in'` | Slow start, speeding up toward the end |
| `'ease-in-out'` | Slow start and end, fast middle |
| `2.5` | Custom exponent `e`: >1 = ease-out of power `e`, <1 = ease-in of power `1/e` (clamped to 0.1-10) |

Before the fix in the Unreleased changelog entry, the named and numeric
curves paced the garden the opposite way (for example `'ease-out'` started
slowly). To approximate the old pacing, use the opposite curve.

---

## Performance

### Is Garten CPU-intensive?

No. Garten is optimized for low CPU usage:

- **30 FPS target** - Smooth enough for decoration, not wasteful
- **Pre-filtering** - Plants not yet growing are skipped
- **No physics simulation** - Pure mathematical animation
- **Efficient rendering** - Category-based dispatch, no per-frame allocations

### How do I reduce CPU usage further?

```javascript
new Garten({
  container: '#garden',
  targetFPS: 15,        // Lower frame rate
  density: 'sparse',    // Fewer plants
  maxPixelRatio: 1      // Lower resolution
});
```

### Does Garten work on mobile?

Yes. It respects `prefers-reduced-motion` by default (shows static completed garden). You can also reduce density and FPS for mobile:

```javascript
const isMobile = window.innerWidth < 768;
new Garten({
  container: '#garden',
  density: isMobile ? 'sparse' : 'normal',
  targetFPS: isMobile ? 20 : 30
});
```

---

## Animation & Playback

### How do I pause/resume the animation?

```javascript
garden.pause();
garden.play();
```

### How do I jump to a specific point?

```javascript
garden.seek(120);  // Jump to 2 minutes in
```

### How do I know when the animation completes?

Use the `onComplete` callback:

```javascript
new Garten({
  container: '#garden',
  events: {
    onComplete: () => console.log('Garden finished growing!')
  }
});
```

### How do I loop the animation?

```javascript
new Garten({
  container: '#garden',
  loop: true
});
```

### How do I show a fully-grown garden immediately?

Seek to the end:

```javascript
const duration = 600;  // Match the duration passed to constructor
const garden = new Garten({ container: '#garden', autoplay: false, duration });
garden.seek(duration);  // Jump to end
```

Or use reduced motion mode (shows static completed garden):

```javascript
new Garten({
  container: '#garden',
  respectReducedMotion: true  // Default is true
});
// User has prefers-reduced-motion: reduce → shows completed garden
```

---

## Styling & Layout

### Why is the canvas behind my content?

The canvas uses `z-index: -1` by default to sit behind page content. This is intentional for background decoration.

### How do I position the garden?

The garden fills its container. Control positioning via CSS on the container:

```css
/* Full page background */
#garden {
  position: fixed;
  inset: 0;
  z-index: -1;
}

/* Bottom section */
#garden {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 300px;
}
```

### Plants are obscuring my content. What can I do?

Several approaches:

1. **Reduce plant height**:
   ```javascript
   new Garten({ container: '#garden', maxHeight: 0.15 });  // Shorter plants
   ```

2. **Use the built-in fade effect**:
   ```javascript
   new Garten({
     container: '#garden',
     fadeHeight: 0.3,      // Top 30% (of container height) below the maxHeight line fades
     fadeColor: '#ffffff'  // Match your background (hex, named, RGB or HSL)
   });
   ```

3. **Reduce opacity**:
   ```javascript
   new Garten({ container: '#garden', opacity: 0.7 });  // Semi-transparent plants
   ```

4. **Add padding to your content**:
   ```css
   .content { padding-bottom: 200px; }
   ```

5. **Use a CSS gradient overlay** (if you need more control):
   ```css
   #garden::after {
     content: '';
     position: absolute;
     inset: 0;
     background: linear-gradient(to bottom, white 0%, transparent 50%);
     pointer-events: none;
   }
   ```

---

## Accessibility

### Does Garten respect reduced motion preferences?

Yes. By default, if a user has `prefers-reduced-motion: reduce` set, Garten displays a static fully-grown garden instead of animating.

Disable this with:
```javascript
new Garten({ container: '#garden', respectReducedMotion: false });
```

### Is the canvas accessible?

The canvas has `aria-hidden="true"` and `role="presentation"` since it's decorative. Screen readers will ignore it.

---

## Troubleshooting

### "Garten: Container not found"

Your selector doesn't match any element. Check:
- The element exists in the DOM
- The selector is correct (`#id`, `.class`, or element)
- The script runs after the DOM is ready

### "Garten: Could not create 2D canvas context"

The browser couldn't create a Canvas 2D context. This is rare but can happen if:
- Too many canvases exist
- GPU acceleration is disabled
- Browser is very old

### Plants look pixelated

Increase the pixel ratio limit:
```javascript
new Garten({ container: '#garden', maxPixelRatio: 3 });  // Default is 2
```

### Memory usage keeps growing

Call `destroy()` when removing the garden:
```javascript
garden.destroy();  // Cleans up canvas, observers, animation frame
```

---
