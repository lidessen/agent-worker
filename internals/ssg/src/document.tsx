/** @jsxImportSource @semajsx/dom */

import type { DocumentTemplate } from "./types";

/**
 * Default HTML document template for SSG
 */
export const DefaultDocument: DocumentTemplate = ({
  children,
  title = "SSG Page",
  scripts,
  css,
  styles,
}) => (
  <html lang="en">
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title}</title>
      {css?.map((href) => (
        <link rel="stylesheet" href={href} />
      ))}
      {styles && styles.length > 0 && <style>{styles.join("\n")}</style>}
    </head>
    <body>
      {children}
      {scripts}
    </body>
  </html>
);
