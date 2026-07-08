import { seedAssets, type SeedAsset } from "@/data/assets";
import {
  buildSeedImageDescriptor,
  getAssetRoute,
  galleryKindConfigs,
} from "@/data/discovery";
import {
  addAsset,
  clearCollection,
  collectionCount,
  COLLECTION_STORAGE_KEY,
  defaultCollectionState,
  loadCollection,
  moveAsset,
  removeAsset,
  renameCollection,
  resolveCollectionItems,
  saveCollection,
  type CollectionState,
  type StorageLike,
} from "@/lib/collection";
import { createCollectionZip, type ZipProgress } from "@/lib/collection-zip";

const assetsById = new Map(seedAssets.map((asset) => [asset.id, asset]));
const liveRegion = document.createElement("div");
liveRegion.className = "visually-hidden";
liveRegion.setAttribute("role", "status");
liveRegion.setAttribute("aria-live", "polite");
document.body.append(liveRegion);

let storage: StorageLike | undefined;
let storageWarning = "";
let state = defaultCollectionState();
let activeZipController: AbortController | undefined;

function announce(message: string): void {
  liveRegion.textContent = message;
}

function getStorage(): StorageLike | undefined {
  try {
    const testKey = `${COLLECTION_STORAGE_KEY}.test`;
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    storageWarning =
      "Browser storage is unavailable. Collection changes will work for this page view only.";
    return undefined;
  }
}

function persist(nextState: CollectionState, message?: string): void {
  state = nextState;

  if (storage) {
    try {
      saveCollection(storage, state);
    } catch {
      storageWarning =
        "Collection changes could not be saved. Your browser may be out of storage space.";
    }
  }

  render();
  document.dispatchEvent(new CustomEvent("pfseeker:collection-change"));

  if (message) {
    announce(message);
  }
}

function createButton(label: string, disabled = false): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "button button--ghost button--sm";
  button.type = "button";
  button.textContent = label;
  button.disabled = disabled;
  return button;
}

function assetKindLabel(asset: SeedAsset): string {
  return galleryKindConfigs[asset.kind].singularLabel;
}

function renderToggle(button: HTMLButtonElement): void {
  const assetId = button.dataset.assetId ?? "";
  const asset = assetsById.get(assetId);
  const saved = state.assetIds.includes(assetId);

  button.disabled = !asset;
  button.textContent = saved ? "Remove from collection" : "Add to collection";
  button.setAttribute("aria-pressed", String(saved));
  button.setAttribute(
    "aria-label",
    asset
      ? `${saved ? "Remove" : "Add"} ${asset.title} ${saved ? "from" : "to"} collection`
      : "Collection action unavailable",
  );
}

function renderHeaderCount(): void {
  const count = collectionCount(state);
  document
    .querySelectorAll<HTMLElement>("[data-collection-count]")
    .forEach((node) => {
      node.textContent = String(count);
      node.setAttribute(
        "aria-label",
        count === 1 ? "1 saved asset" : `${count} saved assets`,
      );
    });
}

function renderWarning(): void {
  document
    .querySelectorAll<HTMLElement>("[data-collection-storage-warning]")
    .forEach((node) => {
      node.hidden = !storageWarning;
      node.textContent = storageWarning;
    });
}

function renderCollectionPage(): void {
  const page = document.querySelector<HTMLElement>("[data-collection-page]");
  if (!page) {
    return;
  }

  const input = page.querySelector<HTMLInputElement>(
    "[data-collection-name-input]",
  );
  const count = page.querySelector<HTMLElement>("[data-collection-page-count]");
  const list = page.querySelector<HTMLOListElement>("[data-collection-list]");
  const empty = page.querySelector<HTMLElement>("[data-collection-empty]");
  const clearOpen = page.querySelector<HTMLButtonElement>(
    "[data-collection-clear-open]",
  );
  const download = page.querySelector<HTMLButtonElement>(
    "[data-collection-download]",
  );
  const missingPanel = page.querySelector<HTMLElement>(
    "[data-collection-missing]",
  );
  const missingList = page.querySelector<HTMLUListElement>(
    "[data-collection-missing-list]",
  );

  if (input && document.activeElement !== input) {
    input.value = state.name;
  }

  const resolved = resolveCollectionItems(state);
  const available = resolved.filter((item) => item.asset);
  const missing = resolved.filter((item) => item.missing);

  if (count) {
    count.textContent =
      state.assetIds.length === 1
        ? "1 saved item in this browser."
        : `${state.assetIds.length} saved items in this browser.`;
  }

  if (empty) {
    empty.hidden = state.assetIds.length > 0;
  }

  if (clearOpen) {
    clearOpen.disabled = state.assetIds.length === 0;
  }

  if (download) {
    download.disabled = available.length === 0 || !!activeZipController;
  }

  if (list) {
    list.replaceChildren();
    available.forEach(({ asset }, index) => {
      if (!asset) {
        return;
      }

      const image = buildSeedImageDescriptor(asset);
      const item = document.createElement("li");
      item.className = "collection-item";

      const preview = document.createElement("a");
      preview.className = "collection-item__preview";
      preview.href = getAssetRoute(asset);
      preview.setAttribute("aria-label", `Open ${asset.title}`);
      preview.style.aspectRatio = image.aspectRatio;

      const img = document.createElement("img");
      img.src = image.src;
      img.alt = image.alt;
      img.width = image.width;
      img.height = image.height;
      img.loading = "lazy";
      preview.append(img);

      const body = document.createElement("div");
      body.className = "collection-item__body";

      const title = document.createElement("h3");
      title.textContent = asset.title;
      const meta = document.createElement("p");
      meta.textContent = `${assetKindLabel(asset)} / ${asset.width} x ${asset.height} / ${asset.format.toUpperCase()}`;
      body.append(title, meta);

      const controls = document.createElement("div");
      controls.className = "collection-item__controls";
      const up = createButton("Move up", index === 0);
      up.dataset.collectionMove = "up";
      up.dataset.assetId = asset.id;
      up.setAttribute("aria-label", `Move ${asset.title} up`);
      const down = createButton("Move down", index === available.length - 1);
      down.dataset.collectionMove = "down";
      down.dataset.assetId = asset.id;
      down.setAttribute("aria-label", `Move ${asset.title} down`);
      const remove = createButton("Remove");
      remove.dataset.collectionRemove = asset.id;
      remove.setAttribute(
        "aria-label",
        `Remove ${asset.title} from collection`,
      );
      controls.append(up, down, remove);

      item.append(preview, body, controls);
      list.append(item);
    });
  }

  if (missingPanel && missingList) {
    missingPanel.hidden = missing.length === 0;
    missingList.replaceChildren();
    missing.forEach((item) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = item.id;
      const button = createButton("Remove missing item");
      button.dataset.collectionRemove = item.id;
      li.append(span, button);
      missingList.append(li);
    });
  }
}

function render(): void {
  document
    .querySelectorAll<HTMLButtonElement>("[data-collection-toggle]")
    .forEach(renderToggle);
  renderHeaderCount();
  renderWarning();
  renderCollectionPage();
}

function initializeState(): void {
  storage = getStorage();

  if (!storage) {
    state = defaultCollectionState();
    return;
  }

  try {
    const result = loadCollection(storage);
    state = result.state;
    storageWarning = result.warning ?? "";
  } catch {
    state = defaultCollectionState();
    storageWarning =
      "Collection storage could not be read. A clean local collection is active until you save again.";
  }
}

async function runZipDownload(): Promise<void> {
  const panel = document.querySelector<HTMLElement>("[data-zip-panel]");
  const status = document.querySelector<HTMLElement>("[data-zip-status]");
  const progress = document.querySelector<HTMLProgressElement>(
    "[data-zip-progress]",
  );
  const failures = document.querySelector<HTMLUListElement>(
    "[data-zip-failures]",
  );
  const cancel = document.querySelector<HTMLButtonElement>("[data-zip-cancel]");
  const download = document.querySelector<HTMLButtonElement>(
    "[data-collection-download]",
  );
  const assets = resolveCollectionItems(state)
    .map((item) => item.asset)
    .filter((asset): asset is SeedAsset => asset !== undefined);

  if (assets.length === 0) {
    announce("There are no available assets to download.");
    if (status) {
      status.textContent = "There are no available assets to download.";
    }
    return;
  }

  activeZipController = new AbortController();
  panel?.removeAttribute("hidden");
  cancel?.removeAttribute("hidden");
  if (download) download.disabled = true;
  if (failures) failures.replaceChildren();

  const onProgress = (next: ZipProgress) => {
    if (status) status.textContent = next.message;
    if (progress) {
      progress.max = Math.max(1, next.total);
      progress.value = next.completed;
    }
  };

  const result = await createCollectionZip({
    assets,
    signal: activeZipController.signal,
    onProgress,
  });

  activeZipController = undefined;
  cancel?.setAttribute("hidden", "");
  if (download) download.disabled = false;

  if (failures) {
    failures.replaceChildren();
    result.failures.forEach((failure) => {
      const li = document.createElement("li");
      li.textContent = `${failure.title}: ${failure.reason}`;
      failures.append(li);
    });
  }

  if (result.blob) {
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pfseeker-local-collection.zip";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const finalMessage =
    result.status === "complete"
      ? "Collection ZIP downloaded."
      : result.status === "partial"
        ? "Collection ZIP downloaded with failed items listed below."
        : result.status === "cancelled"
          ? "Collection ZIP download cancelled."
          : "Collection ZIP could not be created.";
  if (status) status.textContent = finalMessage;
  announce(finalMessage);
  render();
}

initializeState();
render();

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const toggle = target.closest<HTMLButtonElement>("[data-collection-toggle]");
  if (toggle) {
    const assetId = toggle.dataset.assetId ?? "";
    const asset = assetsById.get(assetId);
    if (!asset) return;
    const saved = state.assetIds.includes(assetId);
    persist(
      saved ? removeAsset(state, assetId) : addAsset(state, assetId),
      saved
        ? `${asset.title} removed from collection.`
        : `${asset.title} added to collection.`,
    );
    return;
  }

  const remove = target.closest<HTMLButtonElement>("[data-collection-remove]");
  if (remove) {
    const assetId = remove.dataset.collectionRemove ?? "";
    const asset = assetsById.get(assetId);
    persist(
      removeAsset(state, assetId),
      asset
        ? `${asset.title} removed from collection.`
        : "Missing item removed from collection.",
    );
    return;
  }

  const move = target.closest<HTMLButtonElement>("[data-collection-move]");
  if (move) {
    const assetId = move.dataset.assetId ?? "";
    const direction = move.dataset.collectionMove === "up" ? -1 : 1;
    const asset = assetsById.get(assetId);
    persist(
      moveAsset(state, assetId, direction),
      asset
        ? `${asset.title} moved ${direction === -1 ? "up" : "down"}.`
        : "Item moved.",
    );
    move.focus();
    return;
  }

  if (target.closest("[data-collection-clear-confirm]")) {
    persist(clearCollection(state), "Collection cleared.");
    return;
  }

  if (target.closest("[data-collection-download]")) {
    void runZipDownload();
    return;
  }

  if (target.closest("[data-zip-cancel]")) {
    activeZipController?.abort();
    return;
  }

  if (target.closest("[data-collection-name-cancel]")) {
    render();
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (
    !(form instanceof HTMLFormElement) ||
    !form.matches("[data-collection-rename]")
  ) {
    return;
  }

  event.preventDefault();
  const input = form.querySelector<HTMLInputElement>(
    "[data-collection-name-input]",
  );
  const feedback = document.querySelector<HTMLElement>(
    "[data-collection-rename-feedback]",
  );

  try {
    persist(renameCollection(state, input?.value ?? ""), "Collection renamed.");
    if (input) input.value = state.name;
    if (feedback) feedback.textContent = "Collection renamed.";
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Name is not valid.";
    if (feedback) feedback.textContent = message;
    announce(message);
  }
});

window.addEventListener("storage", (event) => {
  if (event.key !== COLLECTION_STORAGE_KEY || !storage) {
    return;
  }

  const result = loadCollection(storage);
  state = result.state;
  storageWarning = result.warning ?? "";
  render();
  announce("Collection updated in another tab.");
});
