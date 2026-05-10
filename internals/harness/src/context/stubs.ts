// No-op store stubs used by the substrate `CompositeContextProvider`
// when no coord-flavored runtime is present (i.e. the harness is
// plugged into a non-coord HarnessType). The provider's channels /
// inbox / status fields are non-optional in the type (~170 callers
// depend on that), so substrate hands these stubs through; calling
// any method raises an explicit error so a non-coord harness can't
// silently route messages or accept registrations.

import type {
  ChannelStoreInterface,
  InboxEntry,
  InboxStoreInterface,
  Message,
  StatusStoreInterface,
  AgentStatusEntry,
} from "../types.ts";

const ERR_NO_COORD =
  "Channel/inbox/status access requires the multi-agent-coordination " +
  "HarnessType; this Harness is not coord-typed.";

function reject<T>(): Promise<T> {
  return Promise.reject(new Error(ERR_NO_COORD));
}

export const noopChannelStore: ChannelStoreInterface = {
  append() {
    return reject<Message>();
  },
  read() {
    return reject<Message[]>();
  },
  getMessage() {
    return reject<Message | null>();
  },
  listChannels() {
    return [];
  },
  createChannel() {
    throw new Error(ERR_NO_COORD);
  },
  clear() {
    return reject<void>();
  },
  on() {
    /* no-op: no listeners fire because nothing publishes */
  },
  off() {
    /* no-op */
  },
};

export const noopInboxStore: InboxStoreInterface = {
  enqueue() {
    return reject<void>();
  },
  peek() {
    return Promise.resolve([] as InboxEntry[]);
  },
  inspect() {
    return Promise.resolve([] as InboxEntry[]);
  },
  ack() {
    return reject<void>();
  },
  defer() {
    return reject<void>();
  },
  hasEntry() {
    return Promise.resolve(false);
  },
  markSeen() {
    return reject<void>();
  },
  markRunStart() {
    return reject<void>();
  },
  onNewEntry() {
    return new Promise<void>(() => {
      /* never resolves — there's no coord routing to deliver new entries */
    });
  },
};

export const noopStatusStore: StatusStoreInterface = {
  set() {
    return reject<void>();
  },
  get() {
    return Promise.resolve(null);
  },
  getAll() {
    return Promise.resolve([] as AgentStatusEntry[]);
  },
  getCached(): AgentStatusEntry | null {
    return null;
  },
};
