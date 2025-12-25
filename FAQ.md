# Frequently Asked Questions

## Installation & Setup

### Does Garten have any dependencies?

**No.** Garten is a zero-dependency library. It uses only native browser APIs:

- Canvas 2D API for rendering
- `requestAnimationFrame` for animation
- `ResizeObserver` for responsive sizing
- Built-in `Math` for procedural generation

The only dev dependencies are `tsup` (bundler) and `typescript` (compiler), which are not shipped to users.

### What browsers are supported?

Chrome 64+, Firefox 69+, Safari 12+, Edge 79+. Any browser with Canvas 2D and ResizeObserver support.

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
| Flowers, Tulips | 10-22% |
| Roses | 12-25% |
| Lilies | 14-26% |
| Specialty (Sunflowers, etc.) | 12-28% |
| **Tall Flowers** (Hollyhocks, Foxgloves) | 30-50% |
| **Giant Grasses** (Bamboo, Miscanthus) | 40-70% |
| **Tropical** (Palms, Bird of Paradise) | 50-85% |
| **Climbers** (Wisteria, Clematis) | 50-90% |
| **Conifers** (Pine, Cypress, Juniper) | 55-100% |
| **Small Trees** (Birch, Willow, Cherry) | 60-100% |

The `maxHeight` option controls both which plant categories appear and their distribution:

- `maxHeight: 0.35` (default) — Only ground-level plants (grass through specialty flowers)
- `maxHeight: 0.5` — Adds tall flowers and giant grasses (moderate boost)
- `maxHeight: 0.7` — Adds climbers and tropical plants (tall plants become ~35% of garden)
- `maxHeight: 1.0` — Full "overgrown garden" with trees reaching the top (~50% tall plants)

As you increase `maxHeight`, the library automatically:
1. Unlocks taller plant categories
2. Increases the proportion of tall plants in the garden
3. Biases plant heights toward their maximum to ensure some reach the top

This creates a dramatic difference between a tidy garden (`0.35`) and an overgrown forest (`1.0`).

### How do I change the colors?

Use the `colors` option:

```javascript
new Garten({
  container: '#garden',
  colors: {
    accent: '#FF6B6B',      // Primary flower color
    palette: 'warm',        // 'natural' | 'warm' | 'cool' | 'vibrant' | 'monochrome'
    accentWeight: 0.5       // 50% of flowers use accent color
  }
});
```

### How do I speed up the animation?

Two approaches:

1. **Shorter duration** - Complete the animation faster:
   ```javascript
   new Garten({ duration: 60 });  // 1 minute instead of 10
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
// Or simply:
garden.regenerate();  // Uses a new random seed internally
```

### What does `timingCurve` do?

It controls how generations are paced over the duration:

| Value | Effect |
|-------|--------|
| `'linear'` | Even pacing (default) |
| `'ease-out'` | Rapid early growth, slowing toward end |
| `'ease-in'` | Slow start, rapid growth toward end |
| `'ease-in-out'` | Slow start and end, fast middle |
| `2.5` | Custom exponent (>1 = ease-out, <1 = ease-in) |

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
const garden = new Garten({ container: '#garden', autoplay: false });
garden.seek(garden.options.duration);  // Jump to end
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
   new Garten({ maxHeight: 0.15 });  // Shorter plants
   ```

2. **Use the built-in fade effect**:
   ```javascript
   new Garten({
     container: '#garden',
     fadeHeight: 0.3,      // Fade out over 30% of container height
     fadeColor: '#ffffff'  // Match your background color
   });
   ```

3. **Reduce opacity**:
   ```javascript
   new Garten({ opacity: 0.7 });  // Semi-transparent plants
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
new Garten({ respectReducedMotion: false });
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

### "Garten: Could not get 2D context"

The browser couldn't create a Canvas 2D context. This is rare but can happen if:
- Too many canvases exist
- GPU acceleration is disabled
- Browser is very old

### Plants look pixelated

Increase the pixel ratio limit:
```javascript
new Garten({ maxPixelRatio: 3 });  // Default is 2
```

### Memory usage keeps growing

Call `destroy()` when removing the garden:
```javascript
garden.destroy();  // Cleans up canvas, observers, animation frame
```

---
