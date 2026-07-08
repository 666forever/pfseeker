import type { SeedAsset } from "@/data/assets";
import { createCollectionZip, type ZipProgress } from "@/lib/collection-zip";

interface CollectionSummary {
  id: string;
  name: string;
  itemCount: number;
  visibility: "private";
}

interface CollectionListResponse {
  collections: CollectionSummary[];
  containing: string[];
}

type AssetForZip = SeedAsset;

const isAuthenticated = document.body.dataset.authenticated === "true";
const liveRegion = document.createElement("div");
liveRegion.className = "visually-hidden";
liveRegion.setAttribute("role", "status");
liveRegion.setAttribute("aria-live", "polite");
document.body.append(liveRegion);

let activeAssetId = "";
let activeAssetTitle = "";
let pickerDialog: HTMLDialogElement | null = null;
let activeZipController: AbortController | undefined;

function announce(message: string): void {
  liveRegion.textContent = message;
}

function sameOriginHeaders(): HeadersInit {
  return {
    "content-type": "application/json",
  };
}

function currentReturnPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function signInHref(): string {
  return `/auth/discord?returnTo=${encodeURIComponent(currentReturnPath())}`;
}

function ensurePickerDialog(): HTMLDialogElement {
  if (pickerDialog) return pickerDialog;

  const dialog = document.createElement("dialog");
  dialog.className = "dialog collection-picker";
  dialog.setAttribute("data-overlay", "");
  dialog.innerHTML = `
    <div class="dialog__panel">
      <header class="dialog__header">
        <div>
          <h2 id="collection-picker-title">Save to collections</h2>
          <p data-collection-picker-description></p>
        </div>
        <button class="icon-button" type="button" data-dialog-close aria-label="Close dialog">x</button>
      </header>
      <div class="dialog__body">
        <div data-collection-picker-status role="status" aria-live="polite"></div>
        <div data-collection-picker-list></div>
        <form class="collection-rename" data-collection-picker-create>
          <label for="collection-picker-name">New collection</label>
          <input id="collection-picker-name" name="name" maxlength="80" autocomplete="off" />
          <button class="button button--secondary button--md" type="submit">Create</button>
        </form>
        <div class="dialog-actions">
          <a class="button button--secondary button--md" data-collection-picker-signin href="/auth/discord">Sign in with Discord</a>
          <button class="button button--ghost button--md" type="button" data-dialog-close>Close</button>
        </div>
      </div>
    </div>
  `;
  document.body.append(dialog);
  pickerDialog = dialog;
  return dialog;
}

function closeDialog(dialog: HTMLDialogElement): void {
  dialog.close();
  dialog.removeAttribute("data-open");
  document.documentElement.removeAttribute("data-overlay-lock");
}

function openDialog(dialog: HTMLDialogElement): void {
  if (!dialog.open) dialog.showModal();
  dialog.setAttribute("data-open", "true");
  document.documentElement.dataset.overlayLock = "true";
  dialog
    .querySelector<HTMLElement>("[data-autofocus], button, a, input")
    ?.focus();
}

async function loadCollections(
  assetId: string,
): Promise<CollectionListResponse> {
  const response = await fetch(
    `/api/collections?assetId=${encodeURIComponent(assetId)}`,
    {
      headers: { accept: "application/json" },
    },
  );
  if (!response.ok) throw new Error("Collections could not be loaded.");
  return (await response.json()) as CollectionListResponse;
}

async function mutateCollection(
  url: string,
  method: "POST" | "DELETE",
): Promise<void> {
  const response = await fetch(url, {
    method,
    headers: sameOriginHeaders(),
    body: method === "POST" ? "{}" : undefined,
  });
  if (!response.ok) throw new Error("Collection could not be updated.");
}

function renderSignedOutPrompt(dialog: HTMLDialogElement): void {
  dialog
    .querySelector<HTMLElement>("[data-collection-picker-list]")
    ?.replaceChildren();
  const status = dialog.querySelector<HTMLElement>(
    "[data-collection-picker-status]",
  );
  const description = dialog.querySelector<HTMLElement>(
    "[data-collection-picker-description]",
  );
  const createForm = dialog.querySelector<HTMLFormElement>(
    "[data-collection-picker-create]",
  );
  const signIn = dialog.querySelector<HTMLAnchorElement>(
    "[data-collection-picker-signin]",
  );

  if (description) {
    description.textContent = activeAssetTitle
      ? `Sign in to save ${activeAssetTitle} into private synced collections.`
      : "Sign in to save assets into private synced collections.";
  }
  if (status) {
    status.textContent =
      "Anonymous browsing and downloads stay available, but saving requires Discord sign-in.";
  }
  if (createForm) createForm.hidden = true;
  if (signIn) {
    signIn.hidden = false;
    signIn.href = signInHref();
  }
}

function collectionButton(
  collection: CollectionSummary,
  containsAsset: boolean,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button--ghost button--md collection-picker__row";
  button.dataset.collectionId = collection.id;
  button.dataset.collectionAction = containsAsset ? "remove" : "add";
  button.textContent = `${containsAsset ? "Remove from" : "Add to"} ${collection.name} (${collection.itemCount})`;
  return button;
}

function renderPicker(
  dialog: HTMLDialogElement,
  response: CollectionListResponse,
): void {
  const description = dialog.querySelector<HTMLElement>(
    "[data-collection-picker-description]",
  );
  const status = dialog.querySelector<HTMLElement>(
    "[data-collection-picker-status]",
  );
  const list = dialog.querySelector<HTMLElement>(
    "[data-collection-picker-list]",
  );
  const createForm = dialog.querySelector<HTMLFormElement>(
    "[data-collection-picker-create]",
  );
  const signIn = dialog.querySelector<HTMLAnchorElement>(
    "[data-collection-picker-signin]",
  );
  const containing = new Set(response.containing);

  if (description) {
    description.textContent = `Choose where to save ${activeAssetTitle || "this asset"}.`;
  }
  if (status) {
    status.textContent =
      response.collections.length === 0
        ? "Create a collection to save this asset."
        : "Existing collections loaded.";
  }
  if (createForm) createForm.hidden = false;
  if (signIn) signIn.hidden = true;
  if (!list) return;

  list.replaceChildren();
  response.collections.forEach((collection) => {
    list.append(collectionButton(collection, containing.has(collection.id)));
  });
}

async function openSavePicker(button: HTMLButtonElement): Promise<void> {
  activeAssetId = button.dataset.assetId ?? "";
  activeAssetTitle = button.dataset.assetTitle ?? "";
  const dialog = ensurePickerDialog();

  if (!isAuthenticated) {
    renderSignedOutPrompt(dialog);
    openDialog(dialog);
    announce("Sign in to save assets into synced collections.");
    return;
  }

  const status = dialog.querySelector<HTMLElement>(
    "[data-collection-picker-status]",
  );
  if (status) status.textContent = "Loading collections.";
  openDialog(dialog);

  try {
    renderPicker(dialog, await loadCollections(activeAssetId));
  } catch {
    if (status) status.textContent = "Collections could not be loaded.";
    announce("Collections could not be loaded.");
  }
}

async function refreshPicker(message: string): Promise<void> {
  if (!pickerDialog || !activeAssetId) return;
  renderPicker(pickerDialog, await loadCollections(activeAssetId));
  announce(message);
}

async function createCollection(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);
  const name = String(formData.get("name") ?? "");
  const response = await fetch("/api/collections", {
    method: "POST",
    headers: sameOriginHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error("Collection could not be created.");
  form.reset();
  await refreshPicker("Collection created.");
}

function readZipAssets(): AssetForZip[] {
  const source = document.getElementById("collection-zip-assets");
  if (!source?.textContent) return [];
  return JSON.parse(source.textContent) as AssetForZip[];
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
  const detail = document.querySelector<HTMLElement>(
    "[data-collection-detail]",
  );
  const assets = readZipAssets();

  if (assets.length === 0) {
    announce("There are no available assets to download.");
    if (status)
      status.textContent = "There are no available assets to download.";
    return;
  }

  activeZipController = new AbortController();
  panel?.removeAttribute("hidden");
  cancel?.removeAttribute("hidden");
  if (download) download.disabled = true;
  failures?.replaceChildren();

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
  failures?.replaceChildren();
  result.failures.forEach((failure) => {
    const li = document.createElement("li");
    li.textContent = `${failure.title}: ${failure.reason}`;
    failures?.append(li);
  });

  if (result.blob) {
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = detail?.dataset.zipFilename ?? "pfseeker-collection.zip";
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
}

async function reorderFromButton(button: HTMLButtonElement): Promise<void> {
  const item = button.closest<HTMLElement>("[data-asset-id]");
  const list = button.closest<HTMLOListElement>("[data-collection-list]");
  const detail = document.querySelector<HTMLElement>(
    "[data-collection-detail]",
  );
  if (!item || !list || !detail?.dataset.collectionId) return;

  const sibling =
    button.dataset.collectionMove === "up"
      ? item.previousElementSibling
      : item.nextElementSibling;
  if (!(sibling instanceof HTMLElement)) return;

  if (button.dataset.collectionMove === "up") {
    list.insertBefore(item, sibling);
  } else {
    list.insertBefore(sibling, item);
  }

  const assetIds = Array.from(
    list.querySelectorAll<HTMLElement>("[data-asset-id]"),
  ).map((row) => row.dataset.assetId ?? "");

  const response = await fetch(
    `/api/collections/${detail.dataset.collectionId}/reorder`,
    {
      method: "POST",
      headers: sameOriginHeaders(),
      body: JSON.stringify({ assetIds }),
    },
  );
  if (!response.ok) {
    window.location.reload();
    return;
  }
  announce("Collection order saved.");
  window.location.reload();
}

async function removeFromDetail(button: HTMLButtonElement): Promise<void> {
  const detail = document.querySelector<HTMLElement>(
    "[data-collection-detail]",
  );
  const assetId = button.dataset.collectionRemove;
  if (!detail?.dataset.collectionId || !assetId) return;
  await mutateCollection(
    `/api/collections/${detail.dataset.collectionId}/items/${encodeURIComponent(assetId)}`,
    "DELETE",
  );
  announce("Asset removed from collection.");
  window.location.reload();
}

async function deleteCurrentCollection(): Promise<void> {
  const detail = document.querySelector<HTMLElement>(
    "[data-collection-detail]",
  );
  if (!detail?.dataset.collectionId) return;
  await mutateCollection(
    `/api/collections/${detail.dataset.collectionId}`,
    "DELETE",
  );
  window.location.href = "/collections";
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const close = target.closest<HTMLElement>("[data-dialog-close]");
  if (close) {
    const dialog = close.closest<HTMLDialogElement>("dialog");
    if (dialog?.open) closeDialog(dialog);
  }

  const toggle = target.closest<HTMLButtonElement>("[data-collection-toggle]");
  if (toggle) {
    void openSavePicker(toggle);
    return;
  }

  const pickerAction = target.closest<HTMLButtonElement>(
    "[data-collection-action]",
  );
  if (pickerAction && activeAssetId) {
    const collectionId = pickerAction.dataset.collectionId;
    const action = pickerAction.dataset.collectionAction;
    if (!collectionId || (action !== "add" && action !== "remove")) return;
    void mutateCollection(
      `/api/collections/${collectionId}/items/${encodeURIComponent(activeAssetId)}`,
      action === "add" ? "POST" : "DELETE",
    ).then(() =>
      refreshPicker(
        action === "add"
          ? "Asset added to collection."
          : "Asset removed from collection.",
      ),
    );
    return;
  }

  const remove = target.closest<HTMLButtonElement>("[data-collection-remove]");
  if (remove) {
    void removeFromDetail(remove);
    return;
  }

  const move = target.closest<HTMLButtonElement>("[data-collection-move]");
  if (move) {
    void reorderFromButton(move);
    return;
  }

  if (target.closest("[data-collection-delete]")) {
    void deleteCurrentCollection();
    return;
  }

  if (target.closest("[data-collection-download]")) {
    void runZipDownload();
    return;
  }

  if (target.closest("[data-zip-cancel]")) {
    activeZipController?.abort();
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (
    form instanceof HTMLFormElement &&
    form.matches("[data-collection-picker-create]")
  ) {
    event.preventDefault();
    void createCollection(form).catch(() => {
      announce("Collection could not be created.");
    });
  }
});
