# TODO — 2026-03-05 — UI Redesign: Carbon & Citrine

## Goal
Redesign the DevHub UI with the "Carbon & Citrine" theme: deep carbon blacks (#08080A), electric chartreuse accent (#D4FF00), Bricolage Grotesque + DM Sans typography, subtle animations, and improved layouts across all pages.

## Plan

### Phase 1: Foundation (Theme + Fonts + CSS)
- [x] Update `src/app/layout.tsx` — replace Geist/Geist_Mono with Bricolage_Grotesque, DM_Sans, JetBrains_Mono from next/font/google
- [x] Update `src/app/globals.css` — replace all CSS variable values with Carbon & Citrine palette (both `:root` light and `.dark` dark modes)
- [x] Add `--font-display` CSS variable mapping in `@theme inline` block for Bricolage Grotesque
- [x] Add custom CSS keyframes: `fade-up` (page load stagger), `pulse-ring` (running status dot), and utility classes `.font-display`, `.animate-fade-up`, `.animate-pulse-ring`
- [x] Add subtle noise texture background via CSS pseudo-element on body (2% opacity SVG data URI)

### Phase 2: Layout Shell + Sidebar
- [x] Update `src/components/layout/sidebar-nav.tsx` — new sidebar design
- [x] Update `src/components/layout/app-shell.tsx` — adjust width, remove backdrop-blur on sidebar, keep mobile sheet

### Phase 3: Dashboard Page
- [x] Update `src/components/dashboard/dashboard.tsx`:
  - Add quick stats row (4 compact stat cards: Projects, Running, Ports, Updates)
  - Page title in `font-display` (Bricolage Grotesque)
  - Project cards: citrine glow border on hover, translateY(-1px) lift
  - Running status: pulsing green dot (pulse-ring animation)
  - Staggered fade-up animation on cards (CSS animation-delay via nth-child or inline style)
  - Improved card layout: project name + status dot, type badge, port in mono, action buttons

### Phase 4: Project Detail Page
- [x] Update `src/components/projects/project-detail.tsx`:
  - Back link (ghost button with arrow) at top
  - Page title in `font-display`
  - Tab bar: underline style (2px citrine bottom border for active, no background tabs)
  - Service cards: horizontal row layout (name, port mono, command mono muted, uptime, action)
  - Metadata row with badges and mono font for paths

### Phase 5: Stacks Page
- [x] Read and update `src/app/stacks/page.tsx` (and any stacks component)
  - Section title in `font-display`
  - Stack cards: running status dots per project, citrine left border when all running
  - Empty state: dashed border card with CTA
  - Delete action appears on hover (top-right, destructive ghost)

### Phase 6: Updates Page
- [x] Read and update `src/app/updates/page.tsx` (and any updates component)
  - Section title in `font-display`
  - Left project list: active item gets citrine left bar (same pattern as nav)
  - Badge count: citrine if >0, muted if 0
  - Package table: mono font for versions, amber badges for MAJOR
  - Upgrade notes section with checkbox list

### Phase 7: Settings Page
- [x] Read and update `src/app/settings/page.tsx`
  - Section titles in `font-display`
  - Stacked card sections with max-width 720px centered
  - Subtle top border accent: 1px gradient from citrine to transparent, 40% width, centered
  - Toggle alignment: label left, switch right (same line)
  - Input fields: darker inset bg, citrine focus ring
  - Workspace paths as mono inline pills

### Phase 8: Supporting Components
- [x] Update `src/components/services/service-card.tsx` — horizontal row style, mono font for ports/commands, status dot with pulse animation
- [x] Update `src/components/logs/log-viewer.tsx` — dark inset bg (#08080A) for terminal feel, mono font, service filter pills
- [x] Update `src/components/projects/preflight-panel.tsx` — consistent with new theme
- [x] Update `src/components/projects/env-panel.tsx` — consistent with new theme

### Phase 9: Verify & Polish
- [x] Run `npx tsc --noEmit` — no type errors
- [x] Run `npm run build` — builds successfully
- [x] Run `npm test` — all tests pass
- [ ] Visual review: check all 5 pages (dashboard, project detail, stacks, updates, settings) in dark mode
- [ ] Visual review: check light mode still works
- [ ] Check mobile responsive layout still works

## Verification
- `npx tsc --noEmit` -> no type errors
- `npm run build` -> builds successfully
- `npm test` -> all existing tests pass
- Manual: visit each page and confirm Carbon & Citrine theme is applied
- Manual: dark mode is default, light mode alternative works
- Manual: sidebar navigation works, active states correct
- Manual: cards have hover effects (citrine glow, lift)
- Manual: running status dots pulse
- Manual: staggered fade-up on page load
- Manual: mobile responsive works (sidebar drawer)

## Acceptance Criteria
- [ ] All 5 pages use the Carbon & Citrine color palette
- [ ] Bricolage Grotesque used for page/section headings, DM Sans for body, JetBrains Mono for code
- [ ] Cards have citrine glow hover effect
- [ ] Running services show pulsing green dot
- [ ] Page content has staggered fade-up entrance animation
- [ ] Sidebar uses new citrine accent styling
- [ ] Quick stats row on dashboard
- [ ] No regressions: all tests pass, build succeeds, typescript clean
- [ ] Dark mode default, light mode alternative functional
- [ ] Mobile responsive layout intact

## Risks / Unknowns
- Bricolage Grotesque / DM Sans / JetBrains Mono may not be available via next/font/google — verify at implementation time, have fallbacks ready
- shadcn/ui components use CSS variables — our overrides should cascade correctly, but tab/dialog components may need class adjustments
- Noise texture SVG data URI size — keep minimal (<500 bytes)
- Light mode palette needs testing — citrine (#D4FF00) won't have enough contrast on white, so we use darker citrine (#4A7A00) for light mode

## Design Reference
See `/frontend-design` output from this session for full design spec including:
- Complete color palette with hex values
- Typography scale
- ASCII mockups for all pages
- Component notes (card, button, badge, input, tab variants)
- Animation specifications
- Implementation notes
