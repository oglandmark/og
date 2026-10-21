(() => {
  const officialLogo = "/og-logo-official.png";
  const officialInverseLogo = "/og-logo-official-white.png";
  const legacyBundleLogo = "/assets/IMG_0329_1784919532811-CnY08-QX.PNG";

  const isLightColor = (color) => {
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (!channels || channels.length < 3) return false;
    const [red, green, blue] = channels.map((channel) => channel / 255);
    const luminance =
      0.2126 * red + 0.7152 * green + 0.0722 * blue;
    return luminance > 0.62;
  };

  const replaceLegacyLogo = () => {
    document
      .querySelectorAll('img[src="/og-logo.png"]')
      .forEach((image) => {
        image.src = officialInverseLogo;
      });

    document.querySelectorAll("img").forEach((image) => {
      const imageSrc = image.getAttribute("src") || "";
      if (imageSrc !== legacyBundleLogo && !image.src.endsWith(legacyBundleLogo)) {
        return;
      }

        const textColor = getComputedStyle(image.parentElement || image).color;
        image.src = isLightColor(textColor)
          ? officialInverseLogo
          : officialLogo;
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
