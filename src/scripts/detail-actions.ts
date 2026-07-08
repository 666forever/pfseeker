const copyButtons =
  document.querySelectorAll<HTMLButtonElement>("[data-copy-link]");

async function copyValue(value: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

for (const button of copyButtons) {
  const feedback = button
    .closest(".detail-actions")
    ?.querySelector<HTMLElement>("[data-copy-feedback]");
  const value = button.dataset.copyValue ?? window.location.href;

  button.addEventListener("click", async () => {
    const copied = await copyValue(value);

    if (feedback) {
      feedback.textContent = copied
        ? "Link copied."
        : "Copy failed. The page URL remains visible below.";
    }
  });
}
