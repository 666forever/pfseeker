import {
  focusableSelector,
  isEscapeKey,
  nextFocusableIndex,
} from "@/lib/focus";

const openTriggers = "[data-dialog-open], [data-drawer-open]";
const closeTriggers = "[data-dialog-close], [data-drawer-close]";
const overlaySelector = "dialog[data-overlay]";

let lastActiveElement: HTMLElement | null = null;
let openOverlayCount = 0;

function lockScroll(): void {
  openOverlayCount += 1;
  document.documentElement.dataset.overlayLock = "true";
}

function unlockScroll(): void {
  openOverlayCount = Math.max(0, openOverlayCount - 1);

  if (openOverlayCount === 0) {
    document.documentElement.removeAttribute("data-overlay-lock");
  }
}

function getFocusableElements(container: ParentNode): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter(
    (element) => !element.hasAttribute("disabled") && element.tabIndex !== -1,
  );
}

function openOverlay(dialog: HTMLDialogElement): void {
  lastActiveElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  dialog.showModal();
  dialog.setAttribute("data-open", "true");
  lockScroll();

  const focusTarget =
    dialog.querySelector<HTMLElement>("[data-autofocus]") ??
    getFocusableElements(dialog)[0];
  focusTarget?.focus();
}

function closeOverlay(dialog: HTMLDialogElement): void {
  dialog.close();
  dialog.removeAttribute("data-open");
  unlockScroll();
  lastActiveElement?.focus();
  lastActiveElement = null;
}

function toggleDropdown(button: HTMLButtonElement): void {
  const id = button.getAttribute("aria-controls");
  const menu = id ? document.getElementById(id) : null;

  if (!menu) {
    return;
  }

  const shouldOpen = button.getAttribute("aria-expanded") !== "true";
  button.setAttribute("aria-expanded", String(shouldOpen));
  menu.toggleAttribute("hidden", !shouldOpen);

  if (shouldOpen) {
    getFocusableElements(menu)[0]?.focus();
  }
}

function closeDropdowns(except?: HTMLElement): void {
  document
    .querySelectorAll<HTMLButtonElement>("[data-dropdown-trigger]")
    .forEach((button) => {
      const id = button.getAttribute("aria-controls");
      const menu = id ? document.getElementById(id) : null;

      if (!menu || menu.contains(except ?? null) || button === except) {
        return;
      }

      button.setAttribute("aria-expanded", "false");
      menu.hidden = true;
    });
}

document.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target instanceof HTMLDialogElement && target.matches(overlaySelector)) {
    closeOverlay(target);
    return;
  }

  const opener = target.closest<HTMLElement>(openTriggers);
  if (opener) {
    const targetId =
      opener.getAttribute("data-dialog-open") ??
      opener.getAttribute("data-drawer-open");
    const dialog = targetId ? document.getElementById(targetId) : null;

    if (dialog instanceof HTMLDialogElement) {
      openOverlay(dialog);
    }
  }

  const closer = target.closest<HTMLElement>(closeTriggers);
  if (closer) {
    const dialog = closer.closest<HTMLDialogElement>(overlaySelector);

    if (dialog) {
      closeOverlay(dialog);
    }
  }

  const dropdownTrigger = target.closest<HTMLButtonElement>(
    "[data-dropdown-trigger]",
  );
  if (dropdownTrigger) {
    toggleDropdown(dropdownTrigger);
    return;
  }

  closeDropdowns(target);
});

document.addEventListener("keydown", (event) => {
  const openDialog = document.querySelector<HTMLDialogElement>(
    `${overlaySelector}[open]`,
  );

  if (openDialog && event.key === "Tab") {
    const focusable = getFocusableElements(openDialog);
    const activeIndex = focusable.indexOf(
      document.activeElement as HTMLElement,
    );

    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    if (activeIndex === -1) {
      event.preventDefault();
      focusable[0]?.focus();
      return;
    }

    const nextIndex = nextFocusableIndex(
      activeIndex,
      focusable.length,
      event.shiftKey ? -1 : 1,
    );
    event.preventDefault();
    focusable[nextIndex]?.focus();
  }

  if (isEscapeKey(event)) {
    document
      .querySelectorAll<HTMLDialogElement>(`${overlaySelector}[open]`)
      .forEach(closeOverlay);
    closeDropdowns();
  }
});

document.addEventListener("cancel", (event) => {
  const dialog = event.target;

  if (dialog instanceof HTMLDialogElement && dialog.matches(overlaySelector)) {
    event.preventDefault();
    closeOverlay(dialog);
  }
});
