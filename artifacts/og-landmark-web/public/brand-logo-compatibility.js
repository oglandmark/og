(() => {
  const officialLogo = "/og-landmark-logo-v20261106.png";
  const legacyLogoPaths = new Set([
    "/og-logo.png",
    "/og-logo-official.png",
    "/og-logo-official-white.png",
    "/images/logo.png",
    "/images/og-logo.png",
    "/assets/IMG_0329_1784919532811-CnY08-QX.PNG",
  ]);

  const replaceLegacyLogo = () => {
    document.querySelectorAll("img").forEach((image) => {
      const imageSrc = image.getAttribute("src") || "";
      if (!imageSrc) {
        return;
      }
      const imagePath = new URL(imageSrc, window.location.href).pathname;
      if (legacyLogoPaths.has(imagePath)) image.src = officialLogo;
    });
  };

  const observer = new MutationObserver(replaceLegacyLogo);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],
  });
  replaceLegacyLogo();
})();
