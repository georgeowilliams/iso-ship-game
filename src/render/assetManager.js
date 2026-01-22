export class AssetManager {
  constructor() {
    this.images = new Map();
  }

  load(url) {
    if (!url) return Promise.resolve(null);
    const existing = this.images.get(url);
    if (existing?.status === "loaded") return Promise.resolve(existing.image);
    if (existing?.status === "loading") return existing.promise;

    const image = new Image();
    const promise = new Promise((resolve) => {
      image.onload = () => {
        this.images.set(url, { status: "loaded", image });
        resolve(image);
      };
      image.onerror = () => {
        this.images.set(url, { status: "error", image: null });
        resolve(null);
      };
    });
    this.images.set(url, { status: "loading", image, promise });
    image.src = url;
    return promise;
  }

  loadAll(urls) {
    const unique = [...new Set(urls.filter(Boolean))];
    return Promise.all(unique.map((url) => this.load(url)));
  }

  get(url) {
    return this.images.get(url)?.image ?? null;
  }

  isLoaded(url) {
    return this.images.get(url)?.status === "loaded";
  }
}
