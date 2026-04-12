interface ImportMetaHot {
  dispose(callback: () => void): void;
}

interface ImportMeta {
  hot?: ImportMetaHot;
}
