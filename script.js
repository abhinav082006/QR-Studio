(function () {
  "use strict";

  // ---------- DOM refs ----------
  const textInput = document.getElementById("textInput");
  const errorMsg = document.getElementById("errorMsg");
  const fgColor = document.getElementById("fgColor");
  const bgColor = document.getElementById("bgColor");
  const fgColorLabel = document.getElementById("fgColorLabel");
  const bgColorLabel = document.getElementById("bgColorLabel");
  const sizeSelect = document.getElementById("sizeSelect");
  const ecSelect = document.getElementById("ecSelect");
  const logoToggle = document.getElementById("logoToggle");
  const logoUploadWrap = document.getElementById("logoUploadWrap");
  const logoInput = document.getElementById("logoInput");
  const qrCanvas = document.getElementById("qrCanvas");
  const emptyState = document.getElementById("emptyState");
  const downloadPngBtn = document.getElementById("downloadPng");
  const downloadSvgBtn = document.getElementById("downloadSvg");

  const ctx = qrCanvas.getContext("2d");

  // ---------- State ----------
  const state = {
    logoDataUrl: null,
    logoImage: null,
    lastQr: null,       // qrcode-generator instance
    lastModuleCount: 0,
    hasContent: false,
  };

  const QUIET_ZONE = 2; // modules of padding around the code

  // ---------- Helpers ----------
  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function setError(show) {
    errorMsg.hidden = !show;
  }

  function setEmptyState(empty) {
    emptyState.classList.toggle("hidden", !empty);
    qrCanvas.classList.toggle("visible", !empty);
  }

  function setDownloadButtonsEnabled(enabled) {
    downloadPngBtn.disabled = !enabled;
    downloadSvgBtn.disabled = !enabled;
  }

  // ---------- Color label sync ----------
  function syncColorLabels() {
    fgColorLabel.textContent = fgColor.value.toUpperCase();
    bgColorLabel.textContent = bgColor.value.toUpperCase();
  }

  // ---------- Core QR generation ----------
  function buildQrMatrix(text, ecLevel) {
    // typeNumber 0 = auto-detect smallest size that fits the data
    const qr = qrcode(0, ecLevel);
    qr.addData(text);
    qr.make();
    return qr;
  }

  function effectiveErrorCorrection() {
    // Force High EC when a logo is embedded, for scan reliability
    return logoToggle.checked ? "H" : ecSelect.value;
  }

  function renderCanvas(qr, pixelSize, fg, bg, withLogo) {
    const moduleCount = qr.getModuleCount();
    const totalModules = moduleCount + QUIET_ZONE * 2;
    const dpr = window.devicePixelRatio || 1;

    qrCanvas.width = pixelSize * dpr;
    qrCanvas.height = pixelSize * dpr;
    qrCanvas.style.width = pixelSize + "px";
    qrCanvas.style.height = pixelSize + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cellSize = pixelSize / totalModules;

    // background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, pixelSize, pixelSize);

    // modules
    ctx.fillStyle = fg;
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
          const x = (col + QUIET_ZONE) * cellSize;
          const y = (row + QUIET_ZONE) * cellSize;
          ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(cellSize), Math.ceil(cellSize));
        }
      }
    }

    // logo overlay
    if (withLogo && state.logoImage) {
      const logoFrac = 0.24; // logo footprint relative to full QR (incl. white pad)
      const logoBoxSize = pixelSize * logoFrac;
      const cx = pixelSize / 2;
      const cy = pixelSize / 2;
      const padPx = logoBoxSize * 0.12;

      // white rounded backdrop
      drawRoundedRect(
        ctx,
        cx - logoBoxSize / 2 - padPx,
        cy - logoBoxSize / 2 - padPx,
        logoBoxSize + padPx * 2,
        logoBoxSize + padPx * 2,
        10
      );
      ctx.fillStyle = bg;
      ctx.fill();

      // draw the logo image, contained within the box, preserving aspect ratio
      const img = state.logoImage;
      const ratio = Math.min(logoBoxSize / img.width, logoBoxSize / img.height);
      const drawW = img.width * ratio;
      const drawH = img.height * ratio;
      ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
    }
  }

  function drawRoundedRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function buildSvgString(qr, pixelSize, fg, bg, withLogo) {
    const moduleCount = qr.getModuleCount();
    const totalModules = moduleCount + QUIET_ZONE * 2;
    const cellSize = pixelSize / totalModules;

    let rects = "";
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
          const x = (col + QUIET_ZONE) * cellSize;
          const y = (row + QUIET_ZONE) * cellSize;
          rects += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="${fg}"/>`;
        }
      }
    }

    let logoSvg = "";
    if (withLogo && state.logoDataUrl) {
      const logoFrac = 0.24;
      const logoBoxSize = pixelSize * logoFrac;
      const cx = pixelSize / 2;
      const cy = pixelSize / 2;
      const padPx = logoBoxSize * 0.12;
      const boxX = cx - logoBoxSize / 2 - padPx;
      const boxY = cy - logoBoxSize / 2 - padPx;
      const boxSize = logoBoxSize + padPx * 2;

      logoSvg = `
        <rect x="${boxX.toFixed(2)}" y="${boxY.toFixed(2)}" width="${boxSize.toFixed(2)}" height="${boxSize.toFixed(2)}" rx="10" fill="${bg}"/>
        <image x="${(cx - logoBoxSize / 2).toFixed(2)}" y="${(cy - logoBoxSize / 2).toFixed(2)}" width="${logoBoxSize.toFixed(2)}" height="${logoBoxSize.toFixed(2)}" href="${state.logoDataUrl}" preserveAspectRatio="xMidYMid meet"/>
      `;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${pixelSize}" height="${pixelSize}" viewBox="0 0 ${pixelSize} ${pixelSize}">
  <rect width="100%" height="100%" fill="${bg}"/>
  ${rects}
  ${logoSvg}
</svg>`;
  }

  // ---------- Main render pipeline ----------
  function render() {
    const text = textInput.value.trim();
    const pixelSize = parseInt(sizeSelect.value, 10);
    const fg = fgColor.value;
    const bg = bgColor.value;
    const withLogo = logoToggle.checked && !!state.logoImage;
    const ec = effectiveErrorCorrection();

    if (!text) {
      state.hasContent = false;
      setError(true);
      setEmptyState(true);
      setDownloadButtonsEnabled(false);
      state.lastQr = null;
      return;
    }

    setError(false);

    let qr;
    try {
      qr = buildQrMatrix(text, ec);
    } catch (e) {
      // Data too large for this EC level — fall back to L
      try {
        qr = buildQrMatrix(text, "L");
      } catch (e2) {
        setError(true);
        errorMsg.textContent = "This text is too long to encode in a QR code. Try shortening it.";
        errorMsg.hidden = false;
        setEmptyState(true);
        setDownloadButtonsEnabled(false);
        return;
      }
    }

    state.lastQr = qr;
    state.lastModuleCount = qr.getModuleCount();
    state.hasContent = true;

    renderCanvas(qr, pixelSize, fg, bg, withLogo);
    setEmptyState(false);
    setDownloadButtonsEnabled(true);
  }

  const debouncedRender = debounce(render, 300);

  // ---------- Downloads ----------
  function downloadPng() {
    if (!state.hasContent || !state.lastQr) return;

    // Render at a higher fixed resolution for a crisp download, independent of preview size
    const exportSize = 1024;
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = exportSize;
    tempCanvas.height = exportSize;

    const moduleCount = state.lastQr.getModuleCount();
    const totalModules = moduleCount + QUIET_ZONE * 2;
    const cellSize = exportSize / totalModules;
    const fg = fgColor.value;
    const bg = bgColor.value;
    const withLogo = logoToggle.checked && !!state.logoImage;

    tempCtx.fillStyle = bg;
    tempCtx.fillRect(0, 0, exportSize, exportSize);
    tempCtx.fillStyle = fg;
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (state.lastQr.isDark(row, col)) {
          const x = (col + QUIET_ZONE) * cellSize;
          const y = (row + QUIET_ZONE) * cellSize;
          tempCtx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(cellSize), Math.ceil(cellSize));
        }
      }
    }

    if (withLogo && state.logoImage) {
      const logoFrac = 0.24;
      const logoBoxSize = exportSize * logoFrac;
      const cx = exportSize / 2;
      const cy = exportSize / 2;
      const padPx = logoBoxSize * 0.12;
      drawRoundedRect(tempCtx, cx - logoBoxSize / 2 - padPx, cy - logoBoxSize / 2 - padPx, logoBoxSize + padPx * 2, logoBoxSize + padPx * 2, 24);
      tempCtx.fillStyle = bg;
      tempCtx.fill();
      const img = state.logoImage;
      const ratio = Math.min(logoBoxSize / img.width, logoBoxSize / img.height);
      const drawW = img.width * ratio;
      const drawH = img.height * ratio;
      tempCtx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
    }

    tempCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      triggerDownload(url, "qr-code.png");
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function downloadSvg() {
    if (!state.hasContent || !state.lastQr) return;
    const exportSize = 1024;
    const fg = fgColor.value;
    const bg = bgColor.value;
    const withLogo = logoToggle.checked && !!state.logoImage;

    const svgString = buildSvgString(state.lastQr, exportSize, fg, bg, withLogo);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, "qr-code.svg");
    URL.revokeObjectURL(url);
  }

  function triggerDownload(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ---------- Logo handling ----------
  function handleLogoFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      state.logoDataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        state.logoImage = img;
        render();
      };
      img.src = state.logoDataUrl;
    };
    reader.readAsDataURL(file);
  }

  // ---------- Event wiring ----------
  textInput.addEventListener("input", debouncedRender);

  fgColor.addEventListener("input", () => { syncColorLabels(); render(); });
  bgColor.addEventListener("input", () => { syncColorLabels(); render(); });

  sizeSelect.addEventListener("change", render);
  ecSelect.addEventListener("change", render);

  logoToggle.addEventListener("change", () => {
    logoUploadWrap.hidden = !logoToggle.checked;
    if (!logoToggle.checked) {
      render();
    } else if (state.logoImage) {
      render();
    }
  });

  logoInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleLogoFile(file);
  });

  downloadPngBtn.addEventListener("click", downloadPng);
  downloadSvgBtn.addEventListener("click", downloadSvg);

  // ---------- Init ----------
  syncColorLabels();
  setDownloadButtonsEnabled(false);
  setEmptyState(true);
})();
