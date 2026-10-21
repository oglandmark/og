(() => {
  const replaceLegacyLogo = () => {
    document
      .querySelectorAll('img[src="/og-logo.png"]')
      .forEach((image) => {
        image.src = "/og-logo-official-white.png";
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
