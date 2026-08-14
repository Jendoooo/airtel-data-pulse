# Data Pulse design system

Data Pulse is a calm, local-first analytics product. It should feel like a precise utility, not a router admin clone or a generic card dashboard.

## Visual direction

- White and cool-grey canvas with graphite typography.
- Airtel red or MTN gold is used only for active navigation, primary actions, and chart emphasis.
- Data is the visual focus: one dominant usage chart, compact summaries, readable tables, and quiet network diagnostics.
- Avoid gradients, glass effects, decorative orbs, device illustrations, floating objects, and continuous motion.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--surface` | `#ffffff` | Primary panels |
| `--canvas` | `#f5f6f8` | Page background |
| `--ink` | `#171a21` | Primary text |
| `--muted` | `#667085` | Supporting text |
| `--line` | `#e5e7eb` | Dividers and borders |
| `--accent` | `#e21b2d` | Airtel active state |
| `--success` | `#08704d` | Healthy/local status |
| `--radius-sm` | `8px` | Controls |
| `--radius-md` | `12px` | Panels |
| `--shadow-panel` | `0 1px 2px rgba(16, 24, 40, .04)` | Subtle elevation only |

## Typography and spacing

- Use the system sans-serif stack. Do not download a webfont at runtime.
- Page titles: 28-34px, tight tracking, 700-800 weight.
- Section titles: 17-20px, 700 weight.
- Body: 13-15px, 1.5-1.65 line height.
- Use an 8px spacing rhythm. Keep desktop content under 1240px wide.

## Components

- Navigation is a simple segmented row with clear active state and no raised pill shadow.
- Panels use a one-pixel border and little or no shadow.
- Buttons and filters must be at least 40px tall; focus states remain visible.
- Tables keep labels left aligned and numeric values right aligned.
- Empty states explain what source data is needed.
- Motion is limited to direct feedback such as the refresh icon while a user-requested sync is running.

## Responsive behaviour

- At narrow widths, navigation scrolls horizontally instead of wrapping labels into cramped rows.
- Summary metrics become a two-column grid, then a single column where needed.
- Tables may scroll horizontally; controls stay at least 40px tall.
- Do not hide essential usage, renewal, or privacy information on mobile-sized layouts.
