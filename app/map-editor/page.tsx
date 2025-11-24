"use client";

import React, { useEffect, useState } from "react";
import ModelBuilder from "../race/assets/ModelBuilder";
import MapPreview from "./MapPreview";

export default function MapEditorPage() {
  const [status, setStatus] = useState<string>("Ready");
  const [importText, setImportText] = useState<string>("");

  const tryLoadFromWindow = () => {
    try {
      const api = (window as any).__MODEL_BUILDER_API;
      if (api && typeof api.getShapes === "function") {
        const shapes = api.getShapes();
        // setShapes via API so history is preserved
        api.setShapes(shapes);
        setStatus("Loaded shapes from editor instance");
        return true;
      }
    } catch (err) {
      // ignore
    }
    return false;
  };

  useEffect(() => {
    // If the ModelBuilder registers its API, we can pre-load or sync.
    // Nothing critical here; user can use the UI below.
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (tryLoadFromWindow()) return;
      }, 500);
    }
  }, []);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewShapes, setPreviewShapes] = useState<any[] | null>(null);

  const openPreview = () => {
    try {
      const api = (window as any).__MODEL_BUILDER_API;
      if (api && typeof api.getShapes === "function") {
        const shapes = api.getShapes();
        setPreviewShapes(shapes);
        setPreviewOpen(true);
        return;
      }
      // fallback to reading from localStorage import or empty
      const raw = localStorage.getItem("mb:shapes:import");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setPreviewShapes(parsed);
          setPreviewOpen(true);
          return;
        } catch (err) {}
      }
      setStatus(
        "No editor instance available to preview. Open the editor first."
      );
    } catch (err) {
      setStatus("Unable to open preview: " + (err as Error).message);
    }
  };

  const handleLoadFromLocalStorage = () => {
    try {
      const raw = localStorage.getItem("mb:shapes:import");
      if (!raw) return setStatus("No import JSON saved in localStorage.");
      const parsed = JSON.parse(raw);
      const api = (window as any).__MODEL_BUILDER_API;
      if (api && typeof api.setShapes === "function") {
        api.setShapes(parsed);
        setStatus("Loaded shapes into editor from localStorage");
      } else {
        setStatus("Open the editor in this window to apply the shapes.");
      }
    } catch (err) {
      setStatus("Failed to load: " + (err as Error).message);
    }
  };

  const handleImport = () => {
    if (!importText) return setStatus("Paste JSON into the import box first");
    try {
      const parsed = JSON.parse(importText);
      const api = (window as any).__MODEL_BUILDER_API;
      if (api && typeof api.setShapes === "function") {
        api.setShapes(parsed);
        setStatus("Imported shapes into editor");
      } else {
        // If API not present, store to localStorage for ModelBuilder to pick up
        localStorage.setItem("mb:shapes:import", JSON.stringify(parsed));
        setStatus("Saved to localStorage. Open Model Builder to apply.");
      }
    } catch (err) {
      setStatus("Invalid JSON: " + (err as Error).message);
    }
  };

  const handleExport = async () => {
    try {
      const api = (window as any).__MODEL_BUILDER_API;
      if (api && typeof api.exportJSON === "function") {
        const json = api.exportJSON();
        await navigator.clipboard.writeText(json);
        setStatus("Exported JSON copied to clipboard");
      } else {
        setStatus(
          "Editor API not available. Open Model Builder in this window first."
        );
      }
    } catch (err) {
      setStatus("Export failed: " + (err as Error).message);
    }
  };

  const handleDownload = () => {
    try {
      const api = (window as any).__MODEL_BUILDER_API;
      if (api && typeof api.downloadJSON === "function") {
        api.downloadJSON();
        setStatus("Download started");
      } else {
        setStatus(
          "Editor API not available. Open Model Builder in this window first."
        );
      }
    } catch (err) {
      setStatus("Download failed: " + (err as Error).message);
    }
  };

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-3">Map Editor</h1>
      <p className="text-sm text-slate-400 mb-4">
        Use the tool below to move/rotate/scale buildings, spawn points and
        scenery. Export the layout as JSON for use in the game.
      </p>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-slate-900/50 rounded p-2">
          <ModelBuilder />
        </div>

        <aside className="bg-slate-800/60 rounded p-4">
          <div className="mb-3">
            <button
              onClick={handleExport}
              className="w-full bg-emerald-600 px-3 py-2 rounded mb-2"
            >
              Copy JSON to clipboard
            </button>
            <button
              onClick={handleDownload}
              className="w-full bg-amber-600 px-3 py-2 rounded mb-2"
            >
              Download JSON
            </button>
            <button
              onClick={openPreview}
              className="w-full bg-sky-600 px-3 py-2 rounded"
            >
              Open Preview
            </button>
          </div>

          <div className="mb-3">
            <label className="text-xs text-slate-400">Import JSON</label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full h-36 mt-2 p-2 bg-slate-900 rounded text-xs"
              placeholder="Paste layout JSON here (array of shapes)"
            />
            <button
              onClick={handleImport}
              className="mt-2 w-full bg-blue-600 px-3 py-2 rounded mb-2"
            >
              Import into editor
            </button>
            <button
              onClick={handleLoadFromLocalStorage}
              className="w-full bg-violet-600 px-3 py-2 rounded"
            >
              Apply saved import (localStorage)
            </button>
          </div>

          <div className="text-xs text-slate-400 mt-4">Status: {status}</div>
          <div className="text-xs text-slate-500 mt-2">
            Tip: Open this page in the same tab as the Model Builder to allow
            direct import/export and preview. Otherwise use the import box or
            localStorage to transfer JSON between windows.
          </div>
        </aside>
      </div>

      {/* Preview modal */}
      {previewOpen && previewShapes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-[90vw] h-[80vh] bg-slate-900 rounded-lg p-2">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">Map Preview</h3>
              <div>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="px-3 py-1 bg-slate-700 rounded"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="h-full">
              <MapPreview shapes={previewShapes} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
