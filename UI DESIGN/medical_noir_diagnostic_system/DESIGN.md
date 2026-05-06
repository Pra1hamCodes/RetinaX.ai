---
name: Medical Noir Diagnostic System
colors:
  surface: '#12131a'
  surface-dim: '#12131a'
  surface-bright: '#383941'
  surface-container-lowest: '#0d0e15'
  surface-container-low: '#1a1b22'
  surface-container: '#1e1f26'
  surface-container-high: '#292931'
  surface-container-highest: '#33343c'
  on-surface: '#e3e1ec'
  on-surface-variant: '#e5bdbe'
  inverse-surface: '#e3e1ec'
  inverse-on-surface: '#2f3038'
  outline: '#ac8889'
  outline-variant: '#5c3f40'
  surface-tint: '#ffb3b6'
  primary: '#ffb3b6'
  on-primary: '#68001a'
  primary-container: '#e11d48'
  on-primary-container: '#fffaf9'
  inverse-primary: '#be0037'
  secondary: '#c9c6c5'
  on-secondary: '#313030'
  secondary-container: '#4a4949'
  on-secondary-container: '#bab8b7'
  tertiary: '#74d8bd'
  on-tertiary: '#00382d'
  tertiary-container: '#00836c'
  on-tertiary-container: '#eefff7'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdada'
  primary-fixed-dim: '#ffb3b6'
  on-primary-fixed: '#40000c'
  on-primary-fixed-variant: '#920028'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c9c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474646'
  tertiary-fixed: '#90f5d9'
  tertiary-fixed-dim: '#74d8bd'
  on-tertiary-fixed: '#002019'
  on-tertiary-fixed-variant: '#005142'
  background: '#12131a'
  on-background: '#e3e1ec'
  surface-variant: '#33343c'
typography:
  h1:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  h3:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-mono:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.1em
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 16px
  margin: 32px
---

## Brand & Style

The design system is engineered to evoke a sense of high-stakes precision, urgency, and technical sophistication. It targets specialized medical professionals who require immediate clarity in critical diagnostic environments. The aesthetic narrative is "Medical Noir"—a fusion of deep-space shadows, clinical sterility, and high-tech instrumentation.

The design style leverages **Glassmorphism** for data containment and **Minimalism** for content density. By using translucent layers over obsidian backgrounds, the system creates a sense of physical depth akin to an advanced imaging terminal. Subtle light-emissive properties (glows) are applied to critical elements to simulate the luminescent hardware found in modern diagnostic suites, ensuring the user's attention is guided with surgical precision.

## Colors

The palette is strictly constrained to a high-contrast dark mode to reduce eye strain in low-light laboratory settings and to maximize the impact of diagnostic data.

- **Backgrounds:** A foundation of pure black (#000000) for the deepest level, with deep charcoal (#111111) used for structural surfaces.
- **Clinical Red (#E11D48):** The soul of the system. This color is used exclusively for primary actions, critical status alerts, and data highlights. It must always be treated as a signal of high importance.
- **Neutral Grays:** Used to establish a clear hierarchy. Secondary text uses a muted zinc-gray, while borders use a low-opacity gray to maintain the glass effect without cluttering the visual field.
- **Zero Purple Policy:** Absolutely no violet or purple hues are permitted in the spectrum to maintain the sterile, noir aesthetic.

## Typography

This design system utilizes **Inter** for its exceptional legibility and neutral, systematic character. Heavy weights are used for headlines to create a commanding hierarchy against the dark background. 

For technical readouts and metadata, **Space Grotesk** is introduced as a secondary font. Its geometric, futuristic nature complements the high-tech equipment aesthetic. All labels should be rendered in uppercase with increased letter spacing to simulate digital display readouts. Ensure high contrast is maintained: white text on black or charcoal backgrounds only.

## Layout & Spacing

The system employs a **Fixed Grid** model for centralized dashboards and a **Fluid Grid** for diagnostic data streams. 

- **Grid:** A 12-column system with tight 16px gutters to maximize screen real estate for imaging data.
- **Rhythm:** An 8px linear scaling system governs all padding and margins. 
- **Alignment:** Strict, sharp alignment is mandatory. Content should be boxed within high-definition containers to maintain the "instrumentation" feel. Use generous outer margins (32px) to frame the application, pushing the focus toward the center of the viewport.

## Elevation & Depth

Depth is achieved through **Glassmorphism** rather than traditional drop shadows. 

1.  **Base Layer:** Pure black (#000000).
2.  **Surface Layer:** Deep charcoal (#111111) with a 1px solid border (#27272A) to define edges.
3.  **Floating Glass:** Translucent overlays (White @ 5% opacity) with a `backdrop-filter: blur(12px)`. These panels house primary diagnostic controls.
4.  **Emissive Accents:** Instead of shadows, use "Glows." Primary buttons and critical indicators feature a soft `box-shadow` using Clinical Red with a 15px-25px blur at low opacity (20-30%) to simulate a glowing LED hardware status light.

## Shapes

The design system utilizes **Sharp Edges (0px)** for all primary components. This reinforces the clinical, industrial, and "noir" aesthetic. Rounded corners are strictly prohibited as they soften the professional, high-precision tone of the application. 

Every container, button, and input field must terminate in a 90-degree angle. This "brutalist-lite" approach ensures that every pixel of the screen is used efficiently and aligns with the visual language of high-end laboratory monitors.

## Components

- **Buttons:** Primary buttons are solid Clinical Red with white text. They feature a subtle outer glow. Hover states trigger an increase in glow intensity and a slight vertical lift. Secondary buttons are ghost buttons with a 1px white or gray border.
- **Input Fields:** Designed to look "secure" and technical. They feature a dark charcoal background, a 1px bottom border that turns Clinical Red upon focus, and a monospaced "Space Grotesk" font for data entry.
- **Progress Indicators:** Linear bars with a pure black track and a Clinical Red fill. Critical progress should include a pulsing glow animation.
- **Data Visualization:** Line charts and histograms must use Clinical Red for the primary data line, with thin, low-opacity gray grid lines. The area under the curve should use a subtle red-to-transparent gradient.
- **Glass Cards:** Semi-transparent containers used for grouping related diagnostic metrics. They must include a subtle 1px top-light highlight to give the "glass" thickness.
- **Status Chips:** Small, rectangular tags. Use Clinical Red for "Critical" and Crisp White for "Stable." No yellow or green is used; status is binary—Action Required vs. Nominal.