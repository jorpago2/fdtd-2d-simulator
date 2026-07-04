(function initFdtdSceneRepro(global) {
  "use strict";

  function requireFunction(value, name) {
    if (typeof value !== "function") {
      throw new Error(`Scene reproducibility dependency must provide ${name}().`);
    }
    return value;
  }

  function downloadTextFile(documentRef, filename, text, type = "application/json") {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = documentRef.createElement("a");
    link.download = filename;
    link.href = url;
    documentRef.body.appendChild(link);
    link.click();
    link.remove();
    global.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyTextToClipboard(text, { documentRef, navigatorRef, windowRef }) {
    let clipboardError = null;
    if (navigatorRef.clipboard?.writeText) {
      try {
        await navigatorRef.clipboard.writeText(text);
        return;
      } catch (error) {
        clipboardError = error;
      }
    }
    const textarea = documentRef.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    documentRef.body.appendChild(textarea);
    windowRef.focus();
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = documentRef.execCommand("copy");
    textarea.remove();
    if (!copied) {
      throw clipboardError || new Error("Clipboard unavailable");
    }
  }

  function createSceneReproController(dependencies) {
    const documentRef = dependencies.documentRef || global.document;
    const windowRef = dependencies.windowRef || global;
    const navigatorRef = dependencies.navigatorRef || global.navigator || {};
    const el = dependencies.el || {};
    const sceneShareUrlLimit = Number(dependencies.sceneShareUrlLimit) || 7600;
    const exportSceneState = requireFunction(dependencies.exportSceneState, "exportSceneState");
    const applySceneState = requireFunction(dependencies.applySceneState, "applySceneState");
    const encodeSceneSnapshot = requireFunction(dependencies.encodeSceneSnapshot, "encodeSceneSnapshot");
    const decodeSceneSnapshot = requireFunction(dependencies.decodeSceneSnapshot, "decodeSceneSnapshot");
    const safeFilePart = requireFunction(dependencies.safeFilePart, "safeFilePart");
    const getPresetName = requireFunction(dependencies.getPresetName, "getPresetName");
    const setStatus = requireFunction(dependencies.setStatus, "setStatus");
    const warn = typeof dependencies.warn === "function" ? dependencies.warn : () => {};

    function downloadSceneJson() {
      const snapshot = exportSceneState({ includeMaterials: true });
      downloadTextFile(documentRef, `fdtd-scene-${safeFilePart(getPresetName())}.json`, JSON.stringify(snapshot, null, 2));
      setStatus(`Exported JSON with ${snapshot.materials.length} material cells.`);
    }

    async function importSceneJsonFile(file) {
      if (!file) return;
      try {
        const snapshot = JSON.parse(await file.text());
        applySceneState(snapshot);
        setStatus(`Imported ${file.name || "scene JSON"}.`);
      } catch (error) {
        warn("Scene import failed", error);
        setStatus(`Import failed: ${error.message || "invalid JSON"}.`, true);
      }
    }

    async function copySceneUrl() {
      let urlText = "";
      let lightweight = false;
      try {
        let snapshot = exportSceneState({ includeMaterials: true });
        let encoded = encodeSceneSnapshot(snapshot);
        if (encoded.length > sceneShareUrlLimit) {
          snapshot = exportSceneState({ includeMaterials: false });
          encoded = encodeSceneSnapshot(snapshot);
          lightweight = true;
        }
        const url = new URL(windowRef.location.href);
        url.searchParams.set("scene", encoded);
        urlText = url.toString();
        await copyTextToClipboard(urlText, { documentRef, navigatorRef, windowRef });
        if (el.shareSceneUrlOutput) {
          el.shareSceneUrlOutput.hidden = true;
          el.shareSceneUrlOutput.value = "";
        }
        setStatus(
          lightweight
            ? "Copied lightweight URL with parameters and preset; use JSON for drawn-cell exactness."
            : "Copied URL with full scene state.",
        );
      } catch (error) {
        warn("Scene URL copy failed", error);
        if (urlText && el.shareSceneUrlOutput) {
          el.shareSceneUrlOutput.value = urlText;
          el.shareSceneUrlOutput.hidden = false;
          el.shareSceneUrlOutput.focus({ preventScroll: true });
          el.shareSceneUrlOutput.select();
          setStatus(
            lightweight
              ? "Clipboard blocked; lightweight URL generated below. Use JSON for drawn-cell exactness."
              : "Clipboard blocked; URL generated below.",
            true,
          );
          return;
        }
        setStatus(`Copy failed: ${error.message || "clipboard unavailable"}.`, true);
      }
    }

    function loadSceneFromUrlParam() {
      const encoded = new URLSearchParams(windowRef.location.search).get("scene");
      if (!encoded) return false;
      try {
        applySceneState(decodeSceneSnapshot(encoded));
        setStatus("Loaded scene from URL.");
        return true;
      } catch (error) {
        warn("Shared scene URL failed", error);
        setStatus("Shared scene URL could not be loaded.", true);
        return false;
      }
    }

    function bindControls() {
      el.exportSceneBtn?.addEventListener("click", downloadSceneJson);
      el.importSceneBtn?.addEventListener("click", () => {
        el.importSceneFileInput?.click();
      });
      el.importSceneFileInput?.addEventListener("change", async () => {
        const file = el.importSceneFileInput.files?.[0];
        await importSceneJsonFile(file);
        el.importSceneFileInput.value = "";
      });
      el.copySceneUrlBtn?.addEventListener("click", () => {
        copySceneUrl();
      });
    }

    return Object.freeze({
      bindControls,
      copySceneUrl,
      downloadSceneJson,
      importSceneJsonFile,
      loadSceneFromUrlParam,
    });
  }

  global.FdtdSceneRepro = Object.freeze({
    createSceneReproController,
  });
})(window);
