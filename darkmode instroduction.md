# Task

Create a complete dark mode theme for the existing Crumb dashboard UI.

The current UI already exists in light mode. Do NOT redesign the layout or change component structure.

Only create a dark mode variant while preserving:

- Layout
- Navigation structure
- Card hierarchy
- Spacing
- Typography
- Existing functionality

The final result should feel like a premium SaaS product similar to:

- Linear
- Vercel
- Raycast
- Stripe Dashboard
- Shopify Dark Mode

---

# Brand

Product:

Crumb
by BoliFlow

Tagline:

From Recipe to Profit

---

# Design Goals

The dark mode should feel:

- Professional
- Modern
- Warm
- Food-industry friendly
- Easy on the eyes for long usage

Avoid:

- Pure black backgrounds
- Harsh contrast
- Neon colors
- Gaming-style UI

---

# Color Palette

## Background

Primary Background

```css
#0B0F14
```

Secondary Background

```css
#111827
```

Sidebar

```css
#0F172A
```

Card Background

```css
#111827
```

Elevated Card

```css
#172033
```

Border

```css
#1F2937
```

---

# Text Colors

Primary Text

```css
#F9FAFB
```

Secondary Text

```css
#94A3B8
```

Muted Text

```css
#64748B
```

---

# Brand Accent

Primary Orange

```css
#F97316
```

Hover Orange

```css
#FB923C
```

Orange Glow

```css
rgba(249,115,22,0.15)
```

---

# Success

```css
#22C55E
```

Success Background

```css
rgba(34,197,94,0.15)
```

---

# Warning

```css
#F59E0B
```

Warning Background

```css
rgba(245,158,11,0.15)
```

---

# Danger

```css
#EF4444
```

Danger Background

```css
rgba(239,68,68,0.15)
```

---

# Sidebar

Current sidebar should remain.

Dark Mode:

Background:

```css
#0F172A
```

Border:

```css
#1E293B
```

Active menu item:

```css
background: rgba(249,115,22,0.12);
color: #F97316;
```

Icons should inherit active color.

Hover state:

```css
background: rgba(255,255,255,0.04);
```

---

# Dashboard Cards

Maintain the current card layout.

Use:

```css
background: #111827;
border: 1px solid #1F2937;
```

Border radius:

```css
24px
```

Subtle shadow:

```css
0 4px 20px rgba(0,0,0,.25)
```

---

# KPI Cards

## Revenue

Background:

```css
linear-gradient(
135deg,
rgba(249,115,22,.18),
rgba(249,115,22,.08)
)
```

Border:

```css
rgba(249,115,22,.3)
```

---

## Profit

Background:

```css
linear-gradient(
135deg,
rgba(34,197,94,.18),
rgba(34,197,94,.08)
)
```

Border:

```css
rgba(34,197,94,.3)
```

---

## Products Ready

Neutral dark card.

---

## Low Stock

Background:

```css
linear-gradient(
135deg,
rgba(245,158,11,.18),
rgba(245,158,11,.08)
)
```

---

# Recent Sales Card

Keep current structure.

Dark card:

```css
background: #111827;
```

Sale rows:

```css
background: #0F172A;
border: 1px solid #1F2937;
```

Hover:

```css
background: #172033;
```

---

# Production Card

Keep existing statuses.

## Planned

```css
background: rgba(148,163,184,.15);
color: #CBD5E1;
```

## In Progress

```css
background: rgba(249,115,22,.15);
color: #F97316;
```

## Completed

```css
background: rgba(34,197,94,.15);
color: #22C55E;
```

---

# Low Stock Alert Section

Background:

```css
rgba(245,158,11,.08)
```

Border:

```css
rgba(245,158,11,.20)
```

Ingredient tags:

```css
background: rgba(255,255,255,.04);
border: 1px solid #1F2937;
```

---

# Buttons

## Primary

```css
background: #F97316;
color: white;
```

Hover:

```css
background: #FB923C;
```

Shadow:

```css
0 8px 20px rgba(249,115,22,.25)
```

---

## Secondary

```css
background: #172033;
color: #E2E8F0;
border: 1px solid #1F2937;
```

---

# Tables

Avoid bright table grids.

Rows:

```css
border-bottom: 1px solid #1F2937;
```

Hover:

```css
background: rgba(255,255,255,.03);
```

---

# Charts

Revenue:

```css
#F97316
```

Profit:

```css
#22C55E
```

Low Stock:

```css
#F59E0B
```

Grid Lines:

```css
#1F2937
```

---

# Dark Mode Toggle

Add theme switcher.

Requirements:

- Persist theme using localStorage
- Default to system preference
- Smooth transition
- Toggle icon:
  - Sun for light mode
  - Moon for dark mode

---

# Mobile Requirements

Dark mode must support:

- Mobile phones
- Tablets
- Desktop

Sidebar:

Desktop:
- Fixed sidebar

Mobile:
- Drawer menu

Bottom navigation should remain fully usable in dark mode.

---

# Deliverables

Create:

1. Tailwind dark theme configuration
2. CSS variables
3. Theme provider
4. Dark mode toggle
5. Updated dashboard components
6. Responsive implementation
7. Accessible color contrast
8. Smooth theme transitions

Do not redesign the application.

Only transform the existing Crumb light UI into a premium SaaS dark mode experience.