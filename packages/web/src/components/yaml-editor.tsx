/** @jsxImportSource semajsx/dom */

import * as styles from "./yaml-editor.style.ts";

export interface YamlEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function YamlEditor(props: YamlEditorProps) {
  let textareaRef: HTMLTextAreaElement | null = null;
  let gutterRef: HTMLDivElement | null = null;

  function updateGutter() {
    if (!textareaRef || !gutterRef) return;
    const lines = textareaRef.value.split("\n").length;
    const nums: string[] = [];
    for (let i = 1; i <= lines; i++) nums.push(String(i));
    gutterRef.textContent = nums.join("\n");
  }

  function syncScroll() {
    if (!textareaRef || !gutterRef) return;
    gutterRef.scrollTop = textareaRef.scrollTop;
  }

  function handleInput() {
    if (!textareaRef) return;
    props.onChange(textareaRef.value);
    updateGutter();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Tab") {
      e.preventDefault();
      if (!textareaRef) return;
      const start = textareaRef.selectionStart;
      const end = textareaRef.selectionEnd;
      const val = textareaRef.value;
      textareaRef.value = val.substring(0, start) + "  " + val.substring(end);
      textareaRef.selectionStart = textareaRef.selectionEnd = start + 2;
      props.onChange(textareaRef.value);
      updateGutter();
    }
  }

  // Compute initial gutter content
  const initialLines = props.value.split("\n").length;
  const initialGutter: string[] = [];
  for (let i = 1; i <= initialLines; i++) initialGutter.push(String(i));

  return (
    <div class={styles.wrapper}>
      <div
        class={styles.gutter}
        ref={(el: HTMLDivElement) => {
          gutterRef = el;
        }}
      >
        {initialGutter.join("\n")}
      </div>
      <textarea
        class={styles.textarea}
        placeholder={props.placeholder ?? ""}
        oninput={handleInput}
        onkeydown={handleKeydown}
        onscroll={syncScroll}
        ref={(el: HTMLTextAreaElement) => {
          textareaRef = el;
          el.value = props.value;
        }}
      />
    </div>
  );
}
