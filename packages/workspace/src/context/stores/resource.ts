import { nanoid } from "../../utils.ts";
import type {
  Resource,
  StorageBackend,
  ResourceStoreInterface,
} from "../../types.ts";

export class ResourceStore implements ResourceStoreInterface {
  constructor(private readonly storage: StorageBackend) {}

  private resourcePath(id: string): string {
    return `resources/${id}.json`;
  }

  async create(content: string, createdBy: string): Promise<Resource> {
    const resource: Resource = {
      id: `res_${nanoid()}`,
      content,
      createdAt: new Date().toISOString(),
      createdBy,
    };

    await this.storage.writeFile(
      this.resourcePath(resource.id),
      JSON.stringify(resource),
    );

    return resource;
  }

  async read(id: string): Promise<Resource | null> {
    const content = await this.storage.readFile(this.resourcePath(id));
    if (!content) return null;
    return JSON.parse(content) as Resource;
  }
}
