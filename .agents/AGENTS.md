# Project Rules for Antigravity Agent

Whenever you push modifications or updates to the GitHub repository, you MUST push them to both the `main` branch and the `gh-pages` branch to keep the GitHub Pages deployment in sync with the latest codebase.

Always run:
```bash
git push origin main
git push origin main:gh-pages
```
And make sure the local `gh-pages` pointer is updated as well:
```bash
git branch -f gh-pages main
```
