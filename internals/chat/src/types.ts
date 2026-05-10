/** Generic chat event -- intentionally loose to support different backends */
export interface ChatEvent {
  ts?: number;
  type: string;
  [key: string]: unknown;
}
