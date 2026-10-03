---
name: trouvable-ui-polish
description: Review and improve UI components for premium visual quality, consistency, responsiveness, and interaction states.
---

# UI Polish Skill

## When to use

- When building or modifying user-facing components
- When reviewing visual quality of a page or feature
- When fixing layout, spacing, or responsive issues
- Before deploying visible changes to production

## Design system reference

### Typography scale
- Headings: `text-4xl`/`text-3xl`/`text-2xl`/`text-xl` with `font-bold` or `font-semibold`
- Body: `text-base` or `text-sm` with `text-gray-600` for secondary
- Labels: `text-xs` or `text-sm` with `uppercase tracking-wider` for badges/tags

### Color palette
Use the existing surface's palette: operator discipline CSS variables in `src/features/admin/shared/admin-shell.css`, canonical `src/lib/design/tokens.ts`, and `tailwind.config.mjs`. Public pages keep the styles of neighboring `src/features/public/` components. Do not replace these with a generic palette.

### Spacing rhythm
- Section padding: `py-16` or `py-20`
- Card padding: `p-6` or `p-8`
- Element gaps: `gap-4`, `gap-6`, `gap-8`
- Container: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`

## Steps

### 1. Visual hierarchy audit

- Clear heading hierarchy (h1 → h2 → h3)
- Primary action is visually prominent
- Secondary actions are visually subordinate
- Information density is appropriate (not too sparse, not overwhelming)
- White space is intentional and consistent

### 2. Interactive states check

Every interactive element must have:
- [ ] Default state
- [ ] Hover state (`hover:`)
- [ ] Focus state (`focus:ring-2 focus:ring-offset-2`)
- [ ] Active/pressed state where appropriate
- [ ] Disabled state if applicable (`opacity-50 cursor-not-allowed`)
- [ ] Loading state for async actions (spinner or skeleton)

### 3. Responsive audit

- [ ] Mobile (< 640px): single column, touch-friendly targets (min 44px)
- [ ] Tablet (640-1024px): adapted layout
- [ ] Desktop (> 1024px): full layout with proper max-width
- [ ] No horizontal overflow at any breakpoint
- [ ] Text remains readable at all sizes

### 4. Animation guidelines

- Use `transition-all duration-200` for micro-interactions
- Use `framer-motion` for entrance/exit animations
- `animate={undefined}` bug: NEVER pass undefined — always use explicit values
- Pattern: `initial={{ opacity: 0, y: 20 }}` + `animate={{ opacity: 1, y: 0 }}`
- Respect `prefers-reduced-motion`

### 5. Component quality

- Props are typed and documented where complex
- Default values are sensible
- Component handles empty/null/loading data gracefully
- No hardcoded pixel values — use Tailwind scale
- Consistent with existing `src/components/ui/` patterns

### 6. Output format

```markdown
## UI Review: [Component/Page]

### Visual Hierarchy: ✅/⚠️/❌
### Interactive States: ✅/⚠️/❌
### Responsive: ✅/⚠️/❌
### Animation: ✅/⚠️/❌
### Component Quality: ✅/⚠️/❌

### Issues Found:
1. [Issue + fix suggestion]

### Verdict: PREMIUM / ACCEPTABLE / NEEDS WORK
```

## References

- `src/components/ui/` — reusable primitives
- `src/features/public/` and `src/features/admin/` — product surface components
- `src/lib/design/tokens.ts` — canonical operator design tokens
- `src/app/globals.css` — global styles
- `tailwind.config.mjs` — Tailwind configuration
- `.github/agents/trouvable-frontend.agent.md` — Frontend specialist agent
