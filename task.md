# Football Manager UI Redesign — Task List

## Phase 1: Global Matte Layout & Foundation
- [x] 1.0 Audit existing codebase (admin.html, admin.css, app.js)
- [x] 1.1 Design tokens & matte palette in css/admin.css
- [x] 1.2 Shell layout reconstruction (.admin-layout, .admin-sidebar, .admin-main)
- [x] 1.3 Compact sidebar & topbar ribbon styling
- [x] 1.4 Mobile responsive navigation (slide-out drawer + bottom tabs)
- [x] 1.5 Admin login screen styling

## Phase 2: KPI Strip, Action Bars & Dense Data Tables
- [x] 2.0 Data table styles (table-wrap, th, td, hover, badges)
- [x] 2.1 Matte button system (btn-primary, btn-secondary, btn-ghost, btn-danger, etc.)
- [x] 2.2 Pill filter bar styles
- [x] 2.3 Form controls (form-control, form-label, inputs, selects)
- [ ] 2.4 Fix duplicate sidebar toggle at line 4573 in app.js
- [ ] 2.5 Enhance KPI strip with status-dot animation and tactical layout
- [ ] 2.6 Add section-header action bar pattern (section title + count chip + action buttons)
- [ ] 2.7 Orb/background ambient for login page polish

## Phase 3: Domain Views Styling (A, B, C, D)
- [ ] 3.1 Domain A (Academy): institution cards, program rows, batch list, student roster table
- [ ] 3.2 Domain B (Blueprint): subject tiles, question bank dense rows, word type tags
- [ ] 3.3 Domain C (Challenges): exam cards with status indicators, results table, recalibration panels
- [ ] 3.4 Domain D (Desk): audit log table, settings panels, recycle bin, data health cards

## Phase 4: Modals, Polish & Verification
- [ ] 4.1 Modal dialog matte styling improvements (wider forms, better spacing)
- [ ] 4.2 Toast notifications styling
- [ ] 4.3 Remove duplicate sidebar toggle handler (app.js:4573)
- [ ] 4.4 Regression test audit
- [ ] 4.5 Git commit
