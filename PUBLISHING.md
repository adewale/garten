# Publishing to GitHub and NPM

## 1. GitHub Setup

```bash
# Initialize git repo (if not already)
git init

# Create initial commit
git add .
git commit -m "Initial commit: Garten v1.0.0

Animated canvas garden library with 101 plant types.
Zero dependencies, TypeScript, ESM/CJS/IIFE builds."

# Create GitHub repo (using gh CLI)
gh repo create garten --public --description "Animated canvas garden that grows over time"

# Or create manually at https://github.com/new

# Push to GitHub
git branch -M main
git remote add origin git@github.com:AdeOshineye/garten.git
git push -u origin main
```

## 2. NPM Setup

```bash
# Login to npm (one-time)
npm login

# Build the project
npm run build

# Dry run to see what will be published
npm publish --dry-run

# Publish to npm
npm publish
```

## 3. Pre-publish Checklist

- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` passes
- [ ] `npm view garten` returns 404 (name available)
- [ ] `npm publish --dry-run` shows expected files
- [ ] LICENSE file exists
- [ ] README.md is complete
- [ ] package.json has correct version, repository, homepage

## 4. After Publishing

```bash
# Verify it's live
npm view garten

# Test CDN (wait a few minutes for propagation)
curl -I https://unpkg.com/garten/dist/index.global.js
```

## 5. Version Updates

For future releases:

```bash
# Patch (1.0.0 -> 1.0.1)
npm version patch

# Minor (1.0.0 -> 1.1.0)
npm version minor

# Major (1.0.0 -> 2.0.0)
npm version major

# Then push and publish
git push --follow-tags
npm publish
```

## 6. Unpublishing (Emergency Only)

```bash
# Within 72 hours of publish
npm unpublish garten@1.0.0

# Remove entire package (not recommended)
npm unpublish garten --force
```
