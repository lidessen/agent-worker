/**
 * Apple-inspired theme CSS for the docs-theme plugin.
 *
 * All class names are prefixed with `dt-` to avoid collisions.
 * Component styles (Card, Callout, Badge) from @semajsx/ui are collected automatically
 * by the SSR renderer from StyleTokens.
 * This file contains layout, navigation, hero, typography, animations, and responsive styles.
 */

export const THEME_CSS = /* css */ `
/* ==============================================
 * Keyframes
 * ============================================== */

@keyframes dt-fade-in-up {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes dt-fade-in-scale {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

/* ==============================================
 * Font Face
 * ============================================== */

@font-face {
  font-family: "Maple Mono NF CN";
  src: url("/fonts/MapleMono-NF-CN-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

/* ==============================================
 * Global Reset & Base
 * ============================================== */

* { margin: 0; padding: 0; box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
    Inter, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.6;
  color: #1d1d1f;
  background: #fbfbfd;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

::selection {
  background: rgba(0, 113, 227, 0.2);
  color: #1d1d1f;
}

/* ==============================================
 * Frosted Glass Navigation
 * ============================================== */

.dt-glass-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(251, 251, 253, 0.8);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
}

.dt-nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 2rem;
  height: 52px;
}

.dt-nav-logo {
  color: #1d1d1f;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  text-decoration: none;
}

.dt-nav-links {
  display: flex;
  list-style: none;
  margin: 0;
  gap: 2rem;
}

.dt-nav-link {
  color: #1d1d1f;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 400;
  letter-spacing: -0.005em;
  transition: color 0.2s ease;
}

.dt-nav-link:hover {
  color: #0071e3;
}

/* ==============================================
 * Layout
 * ============================================== */

.dt-root {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #fbfbfd;
}

.dt-main {
  flex: 1 1 0%;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 2rem 4rem;
}

/* ==============================================
 * Footer
 * ============================================== */

.dt-footer {
  border-top: 0.5px solid rgba(0, 0, 0, 0.08);
  background: #f5f5f7;
}

.dt-footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.dt-footer-links {
  display: flex;
  gap: 2rem;
  align-items: center;
}

.dt-footer-link {
  color: #6e6e73;
  text-decoration: none;
  font-size: 0.8125rem;
  transition: color 0.2s;
}

.dt-footer-link:hover {
  color: #0071e3;
}

.dt-footer-copy {
  color: #86868b;
  font-size: 0.8125rem;
  margin: 0;
}

/* ==============================================
 * Hero Section
 * ============================================== */

.dt-hero-bg {
  background: linear-gradient(180deg, #fbfbfd 0%, #f5f5f7 40%, #fbfbfd 100%);
  position: relative;
}

.dt-hero-bg::before {
  content: "";
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  height: 100%;
  background: radial-gradient(
    ellipse 60% 50% at 50% 40%,
    rgba(0, 113, 227, 0.06) 0%,
    rgba(251, 251, 253, 0) 70%
  );
  pointer-events: none;
}

.dt-hero-title {
  font-size: clamp(3rem, 8vw, 5rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, #1d1d1f 30%, #6e6e73 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1.25rem;
}

.dt-hero-subtitle {
  font-size: clamp(1.25rem, 2.5vw, 1.5rem);
  font-weight: 400;
  line-height: 1.5;
  color: #6e6e73;
  max-width: 40rem;
  margin: 0 auto 2.5rem;
  letter-spacing: -0.005em;
}

.dt-hero-cta {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
}

/* ==============================================
 * Section Typography
 * ============================================== */

.dt-section-title {
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: #1d1d1f;
  margin-bottom: 0.75rem;
}

.dt-section-subtitle {
  font-size: clamp(1rem, 2vw, 1.25rem);
  font-weight: 400;
  line-height: 1.5;
  color: #6e6e73;
  max-width: 36rem;
  margin: 0 auto 3rem;
}

/* ==============================================
 * Buttons
 * ============================================== */

.dt-primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 1.75rem;
  background: #0071e3;
  color: white;
  border-radius: 980px;
  font-size: 1.0625rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
  border: none;
  cursor: pointer;
  letter-spacing: -0.005em;
}

.dt-primary-btn:hover {
  background: #0077ed;
  transform: scale(1.02);
  box-shadow: 0 4px 16px rgba(0, 113, 227, 0.3);
}

.dt-secondary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 1.75rem;
  background: transparent;
  color: #0071e3;
  border: 1.5px solid #0071e3;
  border-radius: 980px;
  font-size: 1.0625rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
  cursor: pointer;
  letter-spacing: -0.005em;
}

.dt-secondary-btn:hover {
  background: #0071e3;
  color: white;
  transform: scale(1.02);
}

/* ==============================================
 * Animations
 * ============================================== */

.dt-anim-slide-up {
  animation: dt-fade-in-up 0.8s cubic-bezier(0.25, 0.1, 0.25, 1) both;
}

.dt-anim-scale-in {
  animation: dt-fade-in-scale 0.6s cubic-bezier(0.25, 0.1, 0.25, 1) both;
}

.dt-fade-in {
  animation: dt-fade-in-up 0.6s cubic-bezier(0.25, 0.1, 0.25, 1) both;
}

.dt-stagger-1 { animation-delay: 0.1s; }
.dt-stagger-2 { animation-delay: 0.2s; }
.dt-stagger-3 { animation-delay: 0.35s; }
.dt-stagger-4 { animation-delay: 0.5s; }
.dt-stagger-5 { animation-delay: 0.65s; }

/* ==============================================
 * Page Layout
 * ============================================== */

.dt-page-container {
  max-width: 720px;
}

.dt-page-title {
  font-size: 2.25rem;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: -0.02em;
  margin-bottom: 0.5rem;
}

.dt-page-desc {
  font-size: 1.125rem;
  color: #6e6e73;
  line-height: 1.5;
}

.dt-category-heading {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #86868b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 1rem;
}

.dt-card-title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: #1d1d1f;
  letter-spacing: -0.01em;
  margin-bottom: 0.25rem;
}

.dt-card-desc {
  color: #6e6e73;
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0;
}

.dt-content-desc {
  font-size: 1.125rem;
  color: #6e6e73;
  line-height: 1.5;
  padding-bottom: 1.5rem;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}

/* ==============================================
 * Content Typography
 * ============================================== */

.dt-content {
  line-height: 1.75;
  color: #1d1d1f;
}

.dt-content h1 {
  font-size: 1.875rem;
  font-weight: 700;
  margin-top: 3rem;
  margin-bottom: 0.75rem;
  color: #1d1d1f;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.dt-content h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-top: 2.5rem;
  margin-bottom: 0.75rem;
  color: #1d1d1f;
  letter-spacing: -0.015em;
  line-height: 1.25;
  padding-top: 1.5rem;
  border-top: 0.5px solid rgba(0, 0, 0, 0.06);
}

.dt-content h2:first-child,
.dt-content hr + h2 {
  border-top: none;
  padding-top: 0;
  margin-top: 0;
}

.dt-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 2rem;
  margin-bottom: 0.5rem;
  color: #1d1d1f;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.dt-content p {
  margin-bottom: 1.25rem;
  font-size: 1rem;
  color: #1d1d1f;
}

.dt-content ul,
.dt-content ol {
  margin-left: 1.5rem;
  margin-bottom: 1.25rem;
}

.dt-content li {
  margin-bottom: 0.375rem;
  font-size: 1rem;
  line-height: 1.65;
}

.dt-content code {
  background: rgba(0, 0, 0, 0.04);
  padding: 0.15rem 0.4rem;
  border-radius: 5px;
  font-family: "Maple Mono NF CN", "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace;
  font-size: 0.875em;
  color: #1d1d1f;
  border: 0.5px solid rgba(0, 0, 0, 0.06);
}

.dt-content pre {
  background: #1d1d1f;
  color: #e5e5ea;
  padding: 1.25rem 1.5rem;
  border-radius: 12px;
  overflow-x: auto;
  margin-bottom: 1.25rem;
  font-size: 0.875rem;
  line-height: 1.65;
  border: 0.5px solid rgba(0, 0, 0, 0.1);
}

.dt-content pre code {
  background: none;
  color: inherit;
  padding: 0;
  border: none;
  font-size: inherit;
}

.dt-content a {
  color: #0071e3;
  text-decoration: none;
  transition: color 0.2s ease;
}

.dt-content a:hover {
  text-decoration: underline;
}

.dt-content strong {
  font-weight: 600;
  color: #1d1d1f;
}

.dt-content blockquote {
  border-left: 3px solid rgba(0, 0, 0, 0.08);
  padding: 0.75rem 1.25rem;
  margin: 1.5rem 0;
  color: #6e6e73;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 0 10px 10px 0;
}

.dt-content hr {
  border: none;
  border-top: 0.5px solid rgba(0, 0, 0, 0.06);
  margin: 2.5rem 0;
}

/* Tables */

.dt-table-wrapper {
  margin: 1.5rem 0;
  border-radius: 10px;
  border: 0.5px solid rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.dt-content table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9375rem;
  line-height: 1.5;
}

.dt-content thead {
  background: rgba(0, 0, 0, 0.03);
}

.dt-content th {
  font-weight: 600;
  color: #1d1d1f;
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
}

.dt-content td {
  padding: 0.75rem 1rem;
  color: #1d1d1f;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.04);
}

.dt-content tbody tr:last-child td {
  border-bottom: none;
}

.dt-content tbody tr:hover {
  background: rgba(0, 0, 0, 0.02);
}

/* Table scrollbar styling */
.dt-table-wrapper {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.12) rgba(0, 0, 0, 0.02);
}

.dt-table-wrapper::-webkit-scrollbar {
  height: 6px;
}

.dt-table-wrapper::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 3px;
}

.dt-table-wrapper::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 3px;
}

.dt-table-wrapper::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}

/* ==============================================
 * Code Blocks
 * ============================================== */

.dt-code-block {
  position: relative;
  margin: 1.5rem 0;
  border-radius: 12px;
  overflow: hidden;
  border: 0.5px solid rgba(0, 0, 0, 0.1);
}

.dt-code-header {
  position: absolute;
  top: 0;
  right: 0;
  padding: 0.625rem 1rem;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(to left, rgba(34, 39, 46, 0.95) 70%, transparent);
  padding-left: 2rem;
}

.dt-code-lang {
  color: #636e7b;
  font-size: 0.6875rem;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.04em;
  user-select: none;
}

.dt-code-block pre {
  margin: 0;
  border-radius: 0;
  border: none;
  padding-top: 2.25rem;
}

/* Shiki integration */

.dt-content pre.shiki code {
  display: block;
}

.dt-content pre.shiki .line {
  display: inline;
}

/* ==============================================
 * Tabs interactivity (aria-selected)
 * ============================================== */

[role="tab"][aria-selected="true"] {
  color: #0071e3;
  border-bottom-color: #0071e3;
}

/* ==============================================
 * 404 Page
 * ============================================== */

.dt-not-found-title {
  font-size: clamp(4rem, 12vw, 8rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.04em;
  background: linear-gradient(135deg, #1d1d1f 30%, #6e6e73 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1.25rem;
}

/* ==============================================
 * Responsive
 * ============================================== */

@media (max-width: 768px) {
  .dt-nav-inner {
    padding: 12px 1rem !important;
    height: 48px !important;
  }

  .dt-nav-logo { font-size: 1.125rem !important; }
  .dt-nav-links { gap: 1.25rem !important; }
  .dt-nav-link { font-size: 0.8125rem; }

  .dt-main {
    padding: 1.25rem 1rem 2.5rem !important;
  }

  .dt-hero-section {
    padding: 60px 16px 48px !important;
  }

  .dt-hero-cta {
    flex-direction: column !important;
    align-items: center !important;
    gap: 0.75rem !important;
  }

  .dt-section-features {
    padding: 48px 16px !important;
  }

  .dt-section-links {
    padding: 0 16px 60px !important;
  }

  .dt-section-links-inner {
    padding-top: 48px !important;
  }

  .dt-features-grid {
    grid-template-columns: 1fr !important;
    gap: 1rem !important;
  }

  .dt-links-grid {
    grid-template-columns: 1fr !important;
  }

  .dt-page-title {
    font-size: 1.75rem !important;
  }

  .dt-page-desc {
    font-size: 1rem !important;
  }

  .dt-page-container {
    max-width: 100%;
  }

  .dt-footer-inner {
    flex-direction: column !important;
    align-items: center !important;
    text-align: center;
    padding: 1.5rem 1rem !important;
  }

  .dt-footer-links {
    justify-content: center !important;
    gap: 1.5rem !important;
  }

  .dt-not-found-section {
    padding: 60px 16px 48px !important;
  }

  .dt-not-found-cta {
    flex-direction: column !important;
    align-items: center !important;
    gap: 0.75rem !important;
  }

  .dt-content { line-height: 1.7; }
  .dt-content h1 { font-size: 1.5rem; margin-top: 2rem; }
  .dt-content h2 { font-size: 1.25rem; margin-top: 2rem; padding-top: 1.25rem; }
  .dt-content h3 { font-size: 1.125rem; margin-top: 1.5rem; }
  .dt-content pre { padding: 1rem; font-size: 0.8125rem; border-radius: 10px; }
  .dt-content ul, .dt-content ol { margin-left: 1.25rem; }

  .dt-table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    border-radius: 8px;
  }

  .dt-content table {
    font-size: 0.8125rem;
  }

  .dt-content th {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
  }

  .dt-content td {
    padding: 0.5rem 0.75rem;
  }

  .dt-content td:first-child {
    font-weight: 500;
  }

  .dt-code-block { border-radius: 10px; }
  .dt-code-header { padding: 0.375rem 1rem; }

  .dt-ui-grid {
    grid-template-columns: 1fr !important;
  }

  .dt-preview-box {
    padding: 2rem 1rem !important;
  }
}

/* ==============================================
 * Component Preview (shadcn-style showcase)
 * ============================================== */

.dt-preview {
  margin: 1.5rem 0;
  border: 0.5px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  overflow: hidden;
  background: white;
}

.dt-preview-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3.5rem 2.5rem;
  min-height: 120px;
  background: white;
  position: relative;
}

.dt-preview-box > * {
  pointer-events: none;
}

.dt-preview-box.dt-preview-interactive > * {
  pointer-events: auto;
}

.dt-preview-box::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle, rgba(0, 0, 0, 0.04) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
}

.dt-preview-label {
  position: absolute;
  top: 0.75rem;
  left: 1rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #86868b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  z-index: 1;
}

/* ==============================================
 * UI Components Section
 * ============================================== */

.dt-ui-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.dt-ui-card {
  display: block;
  padding: 1.5rem;
  background: white;
  border: 0.5px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.dt-ui-card:hover {
  border-color: rgba(0, 113, 227, 0.3);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}

.dt-ui-card-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
  margin-bottom: 1rem;
  background: #f9f9fb;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.dt-ui-card-preview > * {
  pointer-events: none;
}

.dt-ui-card-preview::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle, rgba(0, 0, 0, 0.03) 1px, transparent 1px);
  background-size: 16px 16px;
  pointer-events: none;
}

.dt-ui-card-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0 0 0.25rem;
  letter-spacing: -0.01em;
}

.dt-ui-card-desc {
  font-size: 0.8125rem;
  color: #6e6e73;
  margin: 0;
  line-height: 1.4;
}

.dt-ui-badge-new {
  display: inline-block;
  padding: 0.1rem 0.4rem;
  background: rgba(0, 113, 227, 0.08);
  color: #0071e3;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 4px;
  margin-left: 0.5rem;
  vertical-align: middle;
}
`;
