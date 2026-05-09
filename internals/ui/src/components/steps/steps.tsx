/** @jsxImportSource @semajsx/dom */

/**
 * Steps component
 *
 * A numbered step list for tutorials and walkthroughs.
 *
 * @example
 * ```tsx
 * import { Steps, Step } from "@semajsx/ui/steps";
 *
 * <Steps>
 *   <Step title="Install">Run bun add semajsx</Step>
 *   <Step title="Create component">Write your first JSX component</Step>
 *   <Step title="Render">Call render() to mount your app</Step>
 * </Steps>
 * ```
 */

import type { JSXNode } from "@semajsx/core";
import type { StyleToken } from "@semajsx/style";
import * as styles from "./steps.style";

type ClassValue = string | StyleToken | ClassValue[] | false | null | undefined;

export interface StepsProps {
  /** Additional CSS class(es) */
  class?: ClassValue;
  /** Step items */
  children?: JSXNode;
}

export interface StepProps {
  /** Step title */
  title: string;
  /** Step number (auto-assigned if omitted) */
  number?: number;
  /** Additional CSS class(es) */
  class?: ClassValue;
  /** Step description/content */
  children?: JSXNode;
}

export function Steps(props: StepsProps): JSXNode {
  return <div class={[styles.root, props.class]}>{props.children}</div>;
}

export function Step(props: StepProps): JSXNode {
  return (
    <div class={[styles.item, props.class]}>
      {props.number !== undefined && <div class={styles.number}>{props.number}</div>}
      <div class={styles.content}>
        <h4 class={styles.title}>{props.title}</h4>
        <div class={styles.body}>{props.children}</div>
      </div>
    </div>
  );
}
