# Design Guidelines

Brand reference extracted from <https://www.tauron.pl/dla-domu> on 2026-11-25 (desktop viewport, 1280 px).
Machine-readable tokens live in [`assets/design-tokens.json`](../assets/design-tokens.json); this document explains how to apply them.

> ⚠️ The TAURON logo, icon font and brand identity are trademarks of TAURON Polska Energia. Verify usage rights before shipping anything beyond internal course prototypes.

## Assets

| Asset | Path | Notes |
|---|---|---|
| Homepage screenshot | [`../assets/homepage.png`](../assets/homepage.png) | Full-page, 1280×4477, no cookie overlay. Visual reference for Manual QA. |
| Logo | [`../assets/logo.webp`](../assets/logo.webp) | 383×383 WebP; white symbol + wordmark on a magenta square. |
| Favicon | [`../assets/favicon.ico`](../assets/favicon.ico) | 16/32/48 px ICO. |
| Design tokens | [`../assets/design-tokens.json`](../assets/design-tokens.json) | Colors, type, spacing, radii, shadows, components. |
| Fonts | [`../assets/fonts/`](../assets/fonts/) | Titillium Web + TAURON icon font; see Typography. |

## Colors

| Token | Hex | Usage |
|---|---|---|
| `brand.primary` | `#E2007A` | TAURON magenta: hero backgrounds, primary buttons, active nav item, text links, icons. |
| `brand.accent` | `#73DADF` | Turquoise: highlighted card borders, section dividers, decorative circles. |
| `brand.accentAlt` | `#6AE2E5` | Slightly brighter turquoise variant used on borders. |
| `brand.warning` | `#FFEB7C` | Yellow alert bar at the top of the page. |
| `background.default` | `#FFFFFF` | Page, cards, header, footer. |
| `background.light` | `#FAFAFA` | Subtle surfaces (most common non-white background). |
| `background.accentLight` | `#DCF3F4` | Pale turquoise band behind product tabs. |
| `background.accentLighter` | `#D0F5F6` | Alternative pale turquoise surface. |
| `text.primary` | `#000000` | Headings and body copy. |
| `text.secondary` | `#272727` | Navigation, utility links, eyebrow labels. |
| `text.muted` | `#555555` | Secondary/helper copy. |
| `text.disabled` | `#ABABAB` | Disabled/placeholder text, large faded headings. |
| `text.onBrand` | `#FFFFFF` | Text on magenta. |
| `border.default` | `#B7B7B7` | Inputs, dividers. |
| `border.light` | `#DADADA` | Hairline separators. |

Error and success colors were not visible on the page. Define them in an ADR before use; do not reuse magenta for errors, because it is the brand color.

Contrast: white on `#E2007A` ≈ 4.6:1 (passes WCAG AA for normal text). Magenta text on white also passes AA. Turquoise `#73DADF` fails as a text color on white; use it only for borders and decoration.

## Typography

- **Family:** `"Titillium Web", Arial, sans-serif` for everything (headings, body, buttons).
- **Icons:** `icon-font`, TAURON's proprietary glyph font, used through `icon-*` classes on the site.

### Locally downloaded font files

All files are under `assets/fonts/`. The site served several files under wrong extensions; they were renamed to their real format:

| Weight / style | File | Format |
|---|---|---|
| 200 ExtraLight | `titillium-web/titilliumweb-extralight-webfont.woff2` | WOFF2 |
| 200 ExtraLight Italic | `titillium-web/titilliumweb-extralightitalic-webfont.woff` | WOFF |
| 300 Light | `titillium-web/titilliumweb-light-webfont.eot` | EOT (legacy IE only) ⚠️ |
| 300 Light Italic | `titillium-web/titilliumweb-lightitalic-webfont.woff2` | WOFF2 |
| 400 Regular | `titillium-web/titilliumweb-regular-webfont.woff2` | WOFF2 |
| 400 Italic | `titillium-web/titilliumweb-italic-webfont.eot` | EOT (legacy IE only) ⚠️ |
| 600 SemiBold | `titillium-web/titilliumweb-semibold-webfont.woff` | WOFF |
| 600 SemiBold Italic | `titillium-web/titilliumweb-semibolditalic-webfont.ttf` | TTF |
| 700 Bold | `titillium-web/titilliumweb-bold-webfont.woff2` | WOFF2 |
| 700 Bold Italic | `titillium-web/titilliumweb-bolditalic-webfont.woff2` | WOFF2 |
| 900 Black | `titillium-web/titilliumweb-black-webfont.woff2` | WOFF2 |
| Icons | `icon-font/icon-font.woff2` | WOFF2 |

Modern browsers cannot use the EOT files (Light 300, Italic 400). Titillium Web is published under the SIL Open Font License on Google Fonts, so take those weights, or the whole family, from there if needed. The icon font is TAURON-proprietary; verify the license before using or redistributing it.

```css
@font-face {
  font-family: "Titillium Web";
  src: url("/assets/fonts/titillium-web/titilliumweb-regular-webfont.woff2") format("woff2");
  font-weight: 400; font-style: normal; font-display: swap;
}
@font-face {
  font-family: "Titillium Web";
  src: url("/assets/fonts/titillium-web/titilliumweb-semibold-webfont.woff") format("woff");
  font-weight: 600; font-style: normal; font-display: swap;
}
@font-face {
  font-family: "Titillium Web";
  src: url("/assets/fonts/titillium-web/titilliumweb-bold-webfont.woff2") format("woff2");
  font-weight: 700; font-style: normal; font-display: swap;
}
```

### Weights

The site mostly uses **400** (body) and **600** (headings, buttons, nav, emphasis). **700** appears in a few large numbers and strong labels.

### Type scale

| Style | Size / weight / line-height | Usage |
|---|---|---|
| Display | 40px / 700 / 1 | Big numbers, promo figures |
| Section title (h2) | 32px / 600 / 1.2 | "Tylko w TAURONIE", "Na skróty" |
| Hero title (h1) | 26px / 600 / 1 | Hero slider heading, white on magenta |
| Main nav | 22px / 600 | "Oferta", "Obsługa klienta" |
| Tab / CTA | 20px / 400–600 | Product tabs, hero CTA button |
| Card title | 18px / 600 / 1.2 | Tile headings |
| Body large | 18px / 400 / 1.4 | Lead text |
| Body | 16px / 400 / 1.4 | Default copy, footer links, top links |
| Caption / eyebrow | 14px / 400 / 1.4 | Small labels above titles ("Usługi dla domu") |

## Spacing

The base unit is **4 px**. Common values are 4, 8, 12, 16, 20, 24, 32, 40 and 56 px. Cards use about 20 px of inner padding and 20–24 px gutters. Sections are separated by 40–56 px.

## Border radius

| Token | Value | Usage |
|---|---|---|
| `sm` | 4px | Buttons (primary, inverse CTA) |
| `md` | 5px | Inputs, small chips |
| `lg` | 20px | Cards and tiles, the dominant shape |
| `xl` | 40px | Floating tab bar under the hero |
| `full` | 250px | Large decorative circle (offer highlight) |
| `circle` | 50% | Icon badges, chat FAB, avatar circles |

Cards that join with a neighbor use half radii (`20px 20px 0 0` / `0 0 20px 20px`).

## Shadows

| Token | Value | Usage |
|---|---|---|
| `card` | `0 10px 24px rgba(33,33,33,.10)` | Default for all tiles and cards |
| `raised` | `0 1px 20px rgba(31,31,31,.24)` | Floating tab bar, sticky elements |
| `popover` | `0 4px 16px rgba(0,0,0,.15)` | Dropdowns and popovers |

## Components

- **Alert bar:** full-width `#FFEB7C` strip at the very top. It holds 14px text, a bold lead ("UWAGA!") and a "Zamknij ✕" close control on the right.
- **Header:** white. The left column has the logo square (~109px). Top row: 16px/600 links (`Dom`, `Biznes`, `Grupa TAURON`) in `#272727`, with the active one in magenta. Main nav below: 22px/600 (`Oferta`, `Obsługa klienta`). The right side holds utilities (`A A+`, `Kontrast`, `E-faktura`, magenta `Zarejestruj się`) and a magenta **Zaloguj się** button with a lock icon.
- **Primary button:** `#E2007A` background, white 16px/600 text, 4px radius, padding `4px 10px`, height ~30px.
- **Inverse CTA:** white background, magenta 20px/600 text, 4px radius, height 54px. Used on the magenta hero ("Sprawdź").
- **Text link / arrow link:** magenta 16px/600; cards end with a black `→` arrow icon at the bottom-right.
- **Hero slider:** magenta panel with white heading and copy on the left, and a lifestyle photo on the right with a soft curved edge.
- **Floating tab bar:** white pill (radius 40px, `raised` shadow) overlapping the hero bottom edge. It holds 20px/400 tabs separated by thin dividers.
- **Cards / tiles:** white, 20px radius, `card` shadow, image or illustration on top, 18px/600 title, 14–16px description, arrow CTA bottom-right. A highlighted card has a 2px turquoise `#73DADF` border.
- **Section tabs:** small 14px eyebrow ("Usługi dla domu") above an uppercase 14–16px/600 label ("PRĄD"), with a turquoise top border marking the active tab.
- **Inputs:** 1px `#B7B7B7` border, 5px radius, 16px text.
- **Chat FAB:** magenta circle with a white chat icon, fixed at the bottom-right.
- **Footer:** white, four columns of 16px/400 links, social icons, and a legal note with magenta inline links.

## Logo usage

- Use [`assets/logo.webp`](../assets/logo.webp) as provided: a white symbol and "TAURON" wordmark inside a solid magenta square. On the site it sits at the top-left of the header, about 109px wide.
- The square already supplies its own magenta background, so it works on white and light surfaces. Keep clear space of at least 1/4 of the logo width around it.
- No inverted or transparent variant was available. Do not recolor, crop or stretch the logo. If a transparent version is needed, obtain the official file from the brand owner.

## Visual style summary

TAURON's consumer site is bright, friendly and functional. Saturated magenta (`#E2007A`) carries all brand moments: hero, primary actions, active states and links. Calm turquoise (`#73DADF`) and pale turquoise surfaces add freshness. Layouts are white, card-based and airy, with generous 20px rounded corners and soft diffuse shadows. Typography is a single humanist sans (Titillium Web), mostly in regular and semibold, with plain sentence-case headings. Overall it reads as an approachable utility provider: clear, modern and trustworthy, with lifestyle photography adding warmth.
