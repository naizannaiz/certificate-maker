# Design System Document: The Sovereign Aesthetic

## 1. Overview & Creative North Star: "The Digital Atelier"
The Creative North Star for this design system is **The Digital Atelier**. Unlike standard SaaS platforms that feel like utilitarian tools, this system is designed to feel like a high-end, private workshop. It rejects the "flatness" of modern web design in favor of depth, tactile luxury, and editorial prestige.

We break the "template" look by employing **Intentional Asymmetry**. Instead of perfectly centered grids, we use weighted compositions where certificate previews might overlap container edges, and gold ornaments act as "anchors" for the eye. The interface does not just "house" the certificate; it frames it as a masterpiece.

---

## 2. Colors & Tonal Depth
The palette is built on a foundation of "Deep Space" purples and "Luminous Gold" accents.

### The Palette (Material Design Tokens)
*   **Background (`surface`):** `#13121e` – A deep, ink-like purple that provides the canvas.
*   **Primary Accents (`primary`):** `#cdbdff` – Soft lavender for interactive states.
*   **Secondary Accents (`secondary`):** `#e9c349` – The "Metallic Gold" for high-prestige moments.
*   **Containers (`surface_container`):** Range from `#0e0d19` (lowest) to `#353341` (highest).

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Structural boundaries must be defined solely through background color shifts. For example, a `surface-container-low` sidebar sitting against a `surface` background. The eye should perceive change through tonal depth, not "boxes."

### The "Glass & Gradient" Rule
To achieve the luxury feel, floating elements (modals, dropdowns, hovered cards) must use **Glassmorphism**.
*   **Recipe:** `surface_container_highest` at 60% opacity + `backdrop-filter: blur(20px)`.
*   **Soulful Gradients:** Use a linear gradient from `primary` (#cdbdff) to `primary_container` (#7c4dff) at a 135° angle for primary CTAs. This prevents the UI from feeling static.

---

## 3. Typography: Editorial Authority
We pair the functional clarity of **Inter** with the timeless elegance of **Noto Serif** (substituting for Playfair/Bodoni for web performance).

*   **Display & Headlines (`display-lg` to `headline-sm`):** **Noto Serif**. These are reserved for certificate titles and "Hero" marketing moments. Use wide letter-spacing (-0.02em) for a high-fashion look.
*   **UI & Navigation (`title-lg` to `label-sm`):** **Inter**. These provide the "mechanical" utility of the app.
*   **The Contrast Principle:** Always pair a large Serif heading with a small, all-caps Inter label (`label-md`) to create an "Editorial Masthead" feel.

---

## 4. Elevation & Depth
We convey hierarchy through **Tonal Layering** rather than structural lines.

*   **The Layering Principle:** Stack your containers. Place a `surface_container_lowest` editor panel inside a `surface_container_low` workspace. This creates a "recessed" or "inset" feel that suggests a physical desk.
*   **Ambient Shadows:** For floating glass cards, use a shadow with a blur radius of `40px`, an offset of `Y: 20px`, and an opacity of `8%`. The shadow color must be a tinted purple (derived from `primary_fixed_dim`) rather than black.
*   **The "Ghost Border" Fallback:** If accessibility requires a border, use the `outline_variant` token at **15% opacity**. It should feel like a faint reflection on the edge of a lens, not a drawn line.

---

## 5. Components

### Buttons
*   **Primary:** Gradient (`primary` to `primary_container`). Roundedness: `md` (0.375rem). Text is `on_primary_fixed`.
*   **Secondary (The "Gold" Standard):** `secondary` (#e9c349) outline with 10% fill. Used for "Export" or "Finalize" actions.
*   **States:** On hover, add a `0 0 15px` outer glow using the `primary` color to mimic neon-glass luminosity.

### Glassmorphism Inputs
*   **Base:** `surface_container_highest` at 40% opacity.
*   **Focus State:** The "Ghost Border" becomes 100% opaque `primary`, and a `4px` soft purple inner-glow is applied.
*   **Typography:** All input text uses `body-md` (Inter).

### Cards & Certificate Previews
*   **Rules:** Forbid divider lines. Use `surface_container_high` for the card body. 
*   **Ornaments:** Use the `secondary` (gold) token for corner flourishes. These should be SVG assets that "hang" off the edges of the card, breaking the rectangular container.

### Chips & Badges
*   **Status:** Use `tertiary_container` for "Draft" and `secondary_container` for "Premium Template" badges. Keep them small (`label-sm`) to maintain the "fine print" look of a luxury brand.

---

## 6. Do’s and Don’ts

### Do:
*   **Use Negative Space:** Give Serif headings 2x the standard padding. Luxury is defined by "wasted" space.
*   **Layer Glass:** Allow background gradients or blurred "blobs" of `primary` color to sit *behind* glass containers to create a sense of three-dimensional space.
*   **Use Gold Sparingly:** Gold is a "high-salt" ingredient. Use it for borders, ornaments, and "Premium" icons only.

### Don’t:
*   **Don’t use 100% White:** Never use `#FFFFFF`. Use `on_surface_variant` (#cac3d8) for body text to reduce harsh contrast and maintain the "dark room" vibe.
*   **Don’t use Sharp Corners:** Avoid `none` roundedness. Even a `sm` (0.125rem) radius makes the "glass" feel polished and expensive.
*   **Don’t Grid-Lock:** Do not feel forced to align everything to a 12-column grid. Let decorative elements and certificate previews "float" and overlap sections to break the digital monotony.