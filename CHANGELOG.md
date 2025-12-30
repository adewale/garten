# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-29

### Added

- Initial public release
- 147 plant types across 19 categories:
  - Simple flowers, tulips, daisies, wildflowers
  - Grasses, ferns, bushes
  - Roses, lilies, orchids
  - Succulents, herbs, specialty flowers
  - Tall flowers (hollyhocks, delphiniums, foxgloves)
  - Giant grasses (bamboo, miscanthus)
  - Climbers (wisteria, clematis)
  - Small trees (birch, willow, cherry blossom)
  - Tropical plants (palms, bird of paradise)
  - Conifers (pine, cypress, juniper)
- Playback controls: `play()`, `pause()`, `stop()`, `seek()`, `setSpeed()`
- 12 presets: default, demo, subtle, lush, forest, meadow, roseGarden, tropical, herbs, succulent, ambient, performance
- 11 themes: natural, sunset, ocean, grayscale, vibrant, sakura, lavender, autumn, midnight, tropical, zen
- `createConfig()` to combine presets and themes
- Seeded RNG for reproducible gardens
- `GrowthProgressPool` for zero-allocation rendering
- Event callbacks: `onStateChange`, `onProgress`, `onGenerationComplete`, `onComplete`
- Timing curves: linear, ease-in, ease-out, ease-in-out, custom exponent
- Reduced motion support (`respectReducedMotion` option)
- ESM, CJS, and IIFE (CDN) bundles
- Full TypeScript support with type exports
- Zero dependencies

[1.0.0]: https://github.com/adewale/garten/releases/tag/v1.0.0
