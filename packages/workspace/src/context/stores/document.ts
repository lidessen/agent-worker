import type { StorageBackend, DocumentStoreInterface } from "../../types.ts";

export class DocumentStore implements DocumentStoreInterface {
  constructor(private readonly storage: StorageBackend) {}

  private docPath(name: string): string {
    return `documents/${name}`;
  }

  private metaPath(name: string): string {
    return `documents/.meta/${name}.json`;
  }

  async read(name: string): Promise<string | null> {
    return this.storage.readFile(this.docPath(name));
  }

  async write(
    name: string,
    content: string,
    updatedBy: string,
  ): Promise<void> {
    await this.storage.writeFile(this.docPath(name), content);
    await this.storage.writeFile(
      this.metaPath(name),
      JSON.stringify({ name, updatedAt: new Date().toISOString(), updatedBy }),
    );
  }

  async append(
    name: string,
    content: string,
    updatedBy: string,
  ): Promise<void> {
    const existing = (await this.storage.readFile(this.docPath(name))) ?? "";
    await this.write(name, existing + content, updatedBy);
  }

  async list(): Promise<string[]> {
    return this.storage.listFiles("documents");
  }

  async create(
    name: string,
    content: string,
    createdBy: string,
  ): Promise<void> {
    const existing = await this.storage.readFile(this.docPath(name));
    if (existing !== null) {
      throw new Error(`Document "${name}" already exists`);
    }
    await this.write(name, content, createdBy);
  }
}
