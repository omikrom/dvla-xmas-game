"use client";

import { useEffect, useState } from "react";

export default function JoystickDebug() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    const id = window.setInterval(() => {
      // read global debug object if present
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const d = window.__JOYSTICK_DEBUG__ || null;
      if (mounted) setData(d);
    }, 120);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed left-4 bottom-4 z-[9999] text-xs font-mono text-slate-900">
      <div className="bg-white/90 p-2 rounded-lg border border-black/10 shadow-lg w-64">
        <div className="font-semibold mb-1">Joystick Debug</div>
        {!data && <div className="text-xs text-slate-600">no data</div>}
        {data && (
          <div className="space-y-1">
            <div>pointerType: {data.pointerType ?? "-"}</div>
            <div>
              client: {data.clientX != null ? Math.round(data.clientX) : "-"},
              {data.clientY != null ? Math.round(data.clientY) : "-"}
            </div>
            <div>
              center: {data.cx != null ? Math.round(data.cx) : "-"},
              {data.cy != null ? Math.round(data.cy) : "-"}
            </div>
            <div>
              raw dx,dy: {data.dx != null ? data.dx.toFixed(1) : "-"},
              {data.dy != null ? data.dy.toFixed(1) : "-"}
            </div>
            <div>
              rot rx,ry: {data.rx != null ? data.rx.toFixed(1) : "-"},
              {data.ry != null ? data.ry.toFixed(1) : "-"}
            </div>
            <div>
              relative: {data.relativeX != null ? data.relativeX.toFixed(2) : "-"},
              {data.relativeY != null ? data.relativeY.toFixed(2) : "-"}
            </div>
            <div>
              norm: {data.nextX != null ? data.nextX.toFixed(2) : "-"},
              {data.nextY != null ? data.nextY.toFixed(2) : "-"}
            </div>
            <div>
              curveRaw: {data.curveRawX != null ? data.curveRawX.toFixed(2) : (data.curveX != null ? data.curveX.toFixed(2) : "-")},
              {data.curveRawY != null ? data.curveRawY.toFixed(2) : (data.curveY != null ? data.curveY.toFixed(2) : "-")}
            </div>
            <div>
              final: {data.finalX != null ? data.finalX.toFixed(2) : "-"},
              {data.finalY != null ? data.finalY.toFixed(2) : "-"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
