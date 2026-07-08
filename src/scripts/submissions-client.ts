import type { AssetKind } from "@/lib/media";
import { allowedSubmissionFormats } from "@/lib/submissions";

interface FileLimit {
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  maxBytes: number;
}

interface UploadIntentResponse {
  intentId: string;
  upload: {
    uploadUrl: string;
    apiKey: string;
    timestamp: number;
    publicId: string;
    overwrite: "false";
    context: string;
    signature: string;
  };
}

interface CompleteResponse {
  redirectTo: string;
}

const liveRegion = document.querySelector<HTMLElement>(
  "[data-submission-status]",
);
const form = document.querySelector<HTMLFormElement>("[data-submission-form]");
const fileInput = document.querySelector<HTMLInputElement>(
  "[data-submission-file]",
);
const dropzone = document.querySelector<HTMLElement>(
  "[data-submission-dropzone]",
);
const preview = document.querySelector<HTMLElement>(
  "[data-submission-preview]",
);
const previewImage = document.querySelector<HTMLImageElement>(
  "[data-submission-preview-image]",
);
const fileMeta = document.querySelector<HTMLElement>(
  "[data-submission-file-meta]",
);
const assetTypeSelect = document.querySelector<HTMLSelectElement>(
  "[data-submission-asset-type]",
);
const categorySelect = document.querySelector<HTMLSelectElement>(
  "[data-submission-category]",
);
const progress = document.querySelector<HTMLProgressElement>(
  "[data-submission-progress]",
);
const limitsSource = document.getElementById("submission-file-limits");

const fileLimits = limitsSource?.textContent
  ? (JSON.parse(limitsSource.textContent) as Record<AssetKind, FileLimit>)
  : undefined;
let selectedFile: File | undefined;
let submitting = false;

function announce(message: string): void {
  if (liveRegion) liveRegion.textContent = message;
}

function assetType(): AssetKind {
  const value = assetTypeSelect?.value;
  return value === "banner" || value === "icon" ? value : "pfp";
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function extensionFor(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function validateFileBasics(file: File): string | undefined {
  const extension = extensionFor(file);
  if (!allowedSubmissionFormats.includes(extension as never)) {
    return "Use JPG, JPEG, PNG, WebP, or GIF.";
  }
  const limit = fileLimits?.[assetType()];
  if (limit && file.size > limit.maxBytes) {
    return `This ${assetType()} file must be ${formatBytes(limit.maxBytes)} or smaller.`;
  }
  return undefined;
}

function loadImageDimensions(file: File): Promise<{
  width: number;
  height: number;
  objectUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
        objectUrl,
      });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image could not be decoded."));
    };
    image.src = objectUrl;
  });
}

async function inspectFile(file: File): Promise<void> {
  const basicError = validateFileBasics(file);
  if (basicError) {
    announce(basicError);
    return;
  }

  try {
    const dimensions = await loadImageDimensions(file);
    const limit = fileLimits?.[assetType()];
    if (
      limit &&
      (dimensions.width < limit.minWidth ||
        dimensions.height < limit.minHeight ||
        dimensions.width > limit.maxWidth ||
        dimensions.height > limit.maxHeight)
    ) {
      URL.revokeObjectURL(dimensions.objectUrl);
      announce("The image dimensions are outside the allowed range.");
      return;
    }

    selectedFile = file;
    if (previewImage) {
      previewImage.src = dimensions.objectUrl;
      previewImage.width = dimensions.width;
      previewImage.height = dimensions.height;
    }
    if (fileMeta) {
      fileMeta.textContent = `${file.name} / ${dimensions.width} x ${dimensions.height} / ${formatBytes(file.size)}`;
    }
    preview?.removeAttribute("hidden");
    announce("Image ready.");
  } catch {
    announce("Image could not be decoded.");
  }
}

function updateCategories(): void {
  if (!categorySelect) return;
  const kind = assetType();
  let firstVisible: HTMLOptionElement | undefined;
  Array.from(categorySelect.options).forEach((option) => {
    const visible = option.dataset.kinds?.split(",").includes(kind) ?? false;
    option.hidden = !visible;
    option.disabled = !visible;
    if (visible && !firstVisible) firstVisible = option;
  });
  if (categorySelect.selectedOptions[0]?.disabled && firstVisible) {
    categorySelect.value = firstVisible.value;
  }
  if (selectedFile) void inspectFile(selectedFile);
}

function selectedTags(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>('input[name="tags"]:checked'),
  ).map((input) => input.value);
}

function metadataFromForm(
  formElement: HTMLFormElement,
): Record<string, unknown> {
  const data = new FormData(formElement);
  return {
    assetType: data.get("assetType"),
    title: data.get("title"),
    category: data.get("category"),
    tags: selectedTags(),
    description: data.get("description"),
    creatorCredit: data.get("creatorCredit"),
    sourceUrl: data.get("sourceUrl"),
    suggestedTags: String(data.get("suggestedTags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    contentRulesConfirmed: data.get("contentRulesConfirmed") === "on",
  };
}

async function createUploadIntent(): Promise<UploadIntentResponse> {
  const response = await fetch("/api/submissions/upload-intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assetType: assetType() }),
  });
  const body = (await response.json()) as UploadIntentResponse & {
    error?: string;
  };
  if (!response.ok) throw new Error(body.error ?? "Upload could not start.");
  return body;
}

function uploadToCloudinary(
  file: File,
  intent: UploadIntentResponse,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.set("file", file);
    body.set("api_key", intent.upload.apiKey);
    body.set("timestamp", String(intent.upload.timestamp));
    body.set("public_id", intent.upload.publicId);
    body.set("overwrite", intent.upload.overwrite);
    body.set("context", intent.upload.context);
    body.set("signature", intent.upload.signature);

    xhr.upload.onprogress = (event) => {
      if (!progress || !event.lengthComputable) return;
      progress.hidden = false;
      progress.max = event.total;
      progress.value = event.loaded;
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error("Cloudinary upload failed."));
      }
    };
    xhr.onerror = () => reject(new Error("Cloudinary upload failed."));
    xhr.open("POST", intent.upload.uploadUrl);
    xhr.send(body);
  });
}

async function completeSubmission(
  intent: UploadIntentResponse,
  metadata: Record<string, unknown>,
): Promise<CompleteResponse> {
  const response = await fetch("/api/submissions/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      intentId: intent.intentId,
      publicId: intent.upload.publicId,
      metadata,
    }),
  });
  const body = (await response.json()) as CompleteResponse & { error?: string };
  if (!response.ok)
    throw new Error(body.error ?? "Submission could not be saved.");
  return body;
}

async function submitForm(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!form || submitting) return;
  if (!selectedFile) {
    announce("Choose one image before submitting.");
    fileInput?.focus();
    return;
  }
  if (selectedTags().length < 1 || selectedTags().length > 5) {
    announce("Choose 1 to 5 tags.");
    return;
  }

  submitting = true;
  form.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled =
    true;
  announce("Preparing upload.");
  try {
    const metadata = metadataFromForm(form);
    const intent = await createUploadIntent();
    announce("Uploading image.");
    await uploadToCloudinary(selectedFile, intent);
    announce("Verifying submission.");
    const completed = await completeSubmission(intent, metadata);
    announce("Submission created.");
    window.location.href = completed.redirectTo;
  } catch (error) {
    announce(error instanceof Error ? error.message : "Submission failed.");
    submitting = false;
    form.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled =
      false;
  }
}

async function cancelSubmission(submissionId: string): Promise<void> {
  const confirmed = window.confirm(
    "Cancel this pending submission? The uploaded file and submission record will be deleted permanently.",
  );
  if (!confirmed) return;
  announce("Cancelling submission.");
  const response = await fetch(`/api/submissions/${submissionId}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (!response.ok) {
    announce("Submission could not be cancelled.");
    return;
  }
  window.location.href = "/submissions";
}

fileInput?.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void inspectFile(file);
});

dropzone?.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.dataset.dragging = "true";
});

dropzone?.addEventListener("dragleave", () => {
  delete dropzone.dataset.dragging;
});

dropzone?.addEventListener("drop", (event) => {
  event.preventDefault();
  delete dropzone.dataset.dragging;
  const file = event.dataTransfer?.files[0];
  if (file) void inspectFile(file);
});

assetTypeSelect?.addEventListener("change", updateCategories);
form?.addEventListener("submit", (event) => void submitForm(event));
document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const cancel = target.closest<HTMLButtonElement>("[data-submission-cancel]");
  if (cancel?.dataset.submissionCancel) {
    void cancelSubmission(cancel.dataset.submissionCancel);
  }
});

updateCategories();
