/**
 * Oxlint JS Plugin to enforce English-only comments
 */

export default {
  name: "english-only",
  rules: {
    "no-non-english-comments": {
      meta: {
        type: "suggestion",
        docs: {
          description: "Disallow non-English characters in comments",
        },
      },
      create(context) {
        // Check for non-ASCII characters (char codes > 127)
        const hasNonASCII = (text) => {
          for (let i = 0; i < text.length; i++) {
            if (text.charCodeAt(i) > 127) {
              return true;
            }
          }
          return false;
        };

        return {
          Program(_node) {
            const comments = context.getSourceCode().getAllComments();

            for (const comment of comments) {
              const text = comment.value;
              if (hasNonASCII(text)) {
                context.report({
                  node: comment,
                  message: "Comments must be in English (no non-ASCII characters allowed)",
                });
              }
            }
          },
        };
      },
    },
  },
};
