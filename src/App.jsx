import { useState, useRef, useEffect, useCallback, useMemo } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const SUBJECTS = [
  {
    id: "anatomy",
    name: "Anatomy",
    color: "#c0392b",
    light: "#fdecea",
    icon: "🫀",
  },
  {
    id: "physiology",
    name: "Physiology",
    color: "#2471a3",
    light: "#eaf4fb",
    icon: "⚡",
  },
  {
    id: "biochemistry",
    name: "Biochemistry",
    color: "#1e8449",
    light: "#eafaf1",
    icon: "🧬",
  },
  {
    id: "pathology",
    name: "Pathology",
    color: "#7d3c98",
    light: "#f5eef8",
    icon: "🔬",
  },
  {
    id: "pharmacology",
    name: "Pharmacology",
    color: "#d35400",
    light: "#fef5ec",
    icon: "💊",
  },
  {
    id: "microbiology",
    name: "Microbiology",
    color: "#148f77",
    light: "#e8f8f5",
    icon: "🦠",
  },
  {
    id: "medicine",
    name: "Medicine",
    color: "#2c3e50",
    light: "#eaecee",
    icon: "🏥",
  },
  {
    id: "surgery",
    name: "Surgery",
    color: "#626567",
    light: "#f2f3f4",
    icon: "🔪",
  },
  { id: "obg", name: "OB/GYN", color: "#c0392b", light: "#fdecea", icon: "👶" },
  {
    id: "pediatrics",
    name: "Pediatrics",
    color: "#1a5276",
    light: "#eaf2ff",
    icon: "🧒",
  },
  {
    id: "psychiatry",
    name: "Psychiatry",
    color: "#6c3483",
    light: "#f4ecf7",
    icon: "🧠",
  },
  {
    id: "radiology",
    name: "Radiology",
    color: "#1b2631",
    light: "#e8eaed",
    icon: "🩻",
  },
];

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am–9pm
const DRAW_COLORS = [
  "#1a1a2e",
  "#c0392b",
  "#2471a3",
  "#1e8449",
  "#f39c12",
  "#7d3c98",
  "#148f77",
  "#e67e22",
  "#ffffff",
  "#f9f6f0",
];
const BRUSH_SIZES = [2, 4, 8, 14, 22];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── LOCAL STORAGE HOOK ───────────────────────────────────────────────────────
function useLS(key, fallback) {
  const [val, setVal] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : fallback;
    } catch {
      return fallback;
    }
  });
  const set = useCallback(
    (v) => {
      setVal(v);
      try {
        localStorage.setItem(
          key,
          JSON.stringify(typeof v === "function" ? v(val) : v),
        );
      } catch {}
    },
    [key],
  );
  return [val, set];
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  app: {
    fontFamily: "'Segoe UI',system-ui,sans-serif",
    minHeight: "100vh",
    background: "#0f1117",
    color: "#e8e0d5",
    display: "flex",
    flexDirection: "column",
  },
  topBar: {
    background: "#161b22",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    padding: "0 16px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    height: 52,
    flexShrink: 0,
    zIndex: 100,
  },
  logo: {
    fontFamily: "Georgia,serif",
    fontSize: 20,
    fontWeight: 700,
    color: "#c0392b",
    letterSpacing: "-0.5px",
    whiteSpace: "nowrap",
  },
  logoSub: {
    fontSize: 11,
    color: "#888",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  body: { display: "flex", flex: 1, overflow: "hidden" },
  sidebar: {
    width: 220,
    background: "#161b22",
    borderRight: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    flexShrink: 0,
    transition: "width 0.2s",
  },
  sidebarCollapsed: { width: 52 },
  main: {
    flex: 1,
    overflowY: "auto",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  navBtn: (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 14px",
    cursor: "pointer",
    borderRadius: 8,
    background: active ? "rgba(192,57,43,0.18)" : "transparent",
    color: active ? "#e8887a" : "#bbb",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    border: "none",
    width: "100%",
    textAlign: "left",
    transition: "all 0.15s",
  }),
  card: {
    background: "#1e2430",
    borderRadius: 14,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.06)",
  },
  input: {
    background: "#0f1117",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    color: "#e8e0d5",
    padding: "8px 12px",
    fontSize: 14,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  btn: (variant = "primary") => ({
    padding: variant === "sm" ? "5px 12px" : "9px 18px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    background:
      variant === "danger"
        ? "rgba(192,57,43,0.2)"
        : variant === "ghost"
          ? "transparent"
          : "rgba(192,57,43,0.85)",
    color:
      variant === "danger" ? "#e8887a" : variant === "ghost" ? "#aaa" : "#fff",
    border: variant === "ghost" ? "1px solid rgba(255,255,255,0.12)" : "none",
    transition: "all 0.15s",
  }),
  badge: (color) => ({
    background: color + "33",
    color,
    borderRadius: 20,
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 700,
  }),
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  tag: (color) => ({
    background: color + "22",
    color,
    borderRadius: 6,
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 600,
  }),
};

// ─── DRAWING CANVAS ───────────────────────────────────────────────────────────
function DrawCanvas({ saveKey }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#1a1a2e");
  const [size, setSize] = useState(4);
  const [mode, setMode] = useState("pen");
  const [history, setHistory] = useState([]);
  const last = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fdfaf5";
    ctx.fillRect(0, 0, c.width, c.height);
    const saved = localStorage.getItem("draw_" + saveKey);
    if (saved) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = saved;
    }
  }, [saveKey]);

  const pos = (e, c) => {
    const r = c.getBoundingClientRect(),
      sx = c.width / r.width,
      sy = c.height / r.height;
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * sx, y: (t.clientY - r.top) * sy };
  };

  const start = (e) => {
    e.preventDefault();
    const c = canvasRef.current,
      p = pos(e, c);
    setDrawing(true);
    last.current = p;
    const ctx = c.getContext("2d");
    ctx.beginPath();
    ctx.arc(
      p.x,
      p.y,
      (mode === "eraser" ? size * 3 : size) / 2,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = mode === "eraser" ? "#fdfaf5" : color;
    ctx.fill();
  };

  const move = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const c = canvasRef.current,
      ctx = c.getContext("2d"),
      p = pos(e, c);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = mode === "eraser" ? "#fdfaf5" : color;
    ctx.lineWidth = mode === "eraser" ? size * 4 : size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    last.current = p;
  };

  const stop = () => {
    if (!drawing) return;
    setDrawing(false);
    const data = canvasRef.current.toDataURL();
    setHistory((h) => [...h.slice(-19), data]);
    localStorage.setItem("draw_" + saveKey, data);
  };

  const undo = () => {
    if (history.length < 2) return;
    const h = history.slice(0, -1);
    setHistory(h);
    const c = canvasRef.current,
      ctx = c.getContext("2d");
    ctx.fillStyle = "#fdfaf5";
    ctx.fillRect(0, 0, c.width, c.height);
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = h[h.length - 1];
    localStorage.setItem("draw_" + saveKey, h[h.length - 1]);
  };

  const clear = () => {
    const c = canvasRef.current,
      ctx = c.getContext("2d");
    ctx.fillStyle = "#fdfaf5";
    ctx.fillRect(0, 0, c.width, c.height);
    setHistory([]);
    localStorage.removeItem("draw_" + saveKey);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          background: "#1a1a2e",
          borderRadius: 12,
          padding: "8px 14px",
        }}
      >
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {DRAW_COLORS.map((c) => (
            <div
              key={c}
              onClick={() => {
                setColor(c);
                setMode("pen");
              }}
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: c,
                cursor: "pointer",
                flexShrink: 0,
                boxSizing: "border-box",
                border:
                  color === c && mode === "pen"
                    ? "3px solid #c0392b"
                    : "2px solid rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>
        <div
          style={{ width: 1, height: 22, background: "rgba(255,255,255,0.1)" }}
        />
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {BRUSH_SIZES.map((s) => (
            <div
              key={s}
              onClick={() => setSize(s)}
              style={{
                width: Math.max(s + 8, 14),
                height: Math.max(s + 8, 14),
                borderRadius: "50%",
                background: size === s ? "#c0392b" : "rgba(255,255,255,0.25)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            />
          ))}
        </div>
        <div
          style={{ width: 1, height: 22, background: "rgba(255,255,255,0.1)" }}
        />
        {[
          { id: "pen", l: "✏️" },
          { id: "eraser", l: "🧹" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            style={{
              ...S.btn(mode === t.id ? "primary" : "ghost"),
              padding: "4px 10px",
              fontSize: 13,
            }}
          >
            {t.l}
          </button>
        ))}
        <button
          onClick={undo}
          style={{ ...S.btn("ghost"), padding: "4px 10px", fontSize: 13 }}
        >
          ↩ Undo
        </button>
        <button
          onClick={clear}
          style={{ ...S.btn("ghost"), padding: "4px 10px", fontSize: 13 }}
        >
          🗑 Clear
        </button>
        <button
          onClick={() => {
            const a = document.createElement("a");
            a.download = "diagram.png";
            a.href = canvasRef.current.toDataURL();
            a.click();
          }}
          style={{ ...S.btn("ghost"), padding: "4px 10px", fontSize: 13 }}
        >
          ⬇ Export
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={1400}
        height={900}
        style={{
          width: "100%",
          borderRadius: 12,
          cursor: mode === "eraser" ? "cell" : "crosshair",
          touchAction: "none",
          background: "#fdfaf5",
          display: "block",
          maxHeight: 480,
        }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={stop}
      />
    </div>
  );
}

// ─── NOTE EDITOR ──────────────────────────────────────────────────────────────
function NoteEditor({ noteKey }) {
  const [content, setContent] = useLS("note_" + noteKey, "");
  const edRef = useRef(null);

  useEffect(() => {
    if (edRef.current && edRef.current.innerHTML !== content)
      edRef.current.innerHTML = content;
  }, [noteKey]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {[
          ["B", "bold"],
          ["I", "italic"],
          ["U", "underline"],
          ["H1", "formatBlock", "h2"],
          ["H2", "formatBlock", "h3"],
          ["• List", "insertUnorderedList"],
          ["1. List", "insertOrderedList"],
          ["—", "insertHorizontalRule"],
        ].map(([l, cmd, val]) => (
          <button
            key={l}
            onMouseDown={(e) => {
              e.preventDefault();
              document.execCommand(cmd, false, val || null);
            }}
            style={{
              background: "rgba(192,57,43,0.12)",
              border: "1px solid rgba(192,57,43,0.2)",
              borderRadius: 6,
              color: "#e8887a",
              padding: "3px 9px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {l}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#555" }}>
          autosaved
        </span>
      </div>
      <div
        ref={edRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => setContent(e.currentTarget.innerHTML)}
        style={{
          flex: 1,
          minHeight: 320,
          background: "#fdfaf5",
          borderRadius: 12,
          border: "1px solid rgba(192,57,43,0.12)",
          padding: "18px 22px",
          fontSize: 15,
          lineHeight: 1.9,
          outline: "none",
          overflowY: "auto",
          fontFamily: "Georgia,serif",
          color: "#1a1a2e",
        }}
      />
    </div>
  );
}

// ─── FLASHCARDS ───────────────────────────────────────────────────────────────
function Flashcards({ storeKey }) {
  const [cards, setCards] = useLS("fc_" + storeKey, []);
  const [form, setForm] = useState({ q: "", a: "" });
  const [mode, setMode] = useState("list"); // list | study
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [score, setScore] = useState({ got: 0, miss: 0 });

  const add = () => {
    if (!form.q.trim() || !form.a.trim()) return;
    setCards([...cards, { id: uid(), q: form.q, a: form.a, due: Date.now() }]);
    setForm({ q: "", a: "" });
  };
  const del = (id) => setCards(cards.filter((c) => c.id !== id));

  if (mode === "study" && cards.length > 0) {
    const card = cards[idx];
    const done = idx >= cards.length;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 13, color: "#888" }}>
            {idx + 1} / {cards.length}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ ...S.badge("#1e8449") }}>✓ {score.got}</span>
            <span style={{ ...S.badge("#c0392b") }}>✗ {score.miss}</span>
          </div>
          <button
            onClick={() => {
              setMode("list");
              setIdx(0);
              setFlipped(false);
              setScore({ got: 0, miss: 0 });
            }}
            style={S.btn("ghost")}
          >
            ✕ Exit
          </button>
        </div>
        {done ? (
          <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 48 }}>🎉</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 12 }}>
              Session Complete!
            </div>
            <div style={{ color: "#888", marginTop: 6 }}>
              Got {score.got} right, {score.miss} to review
            </div>
            <button
              onClick={() => {
                setIdx(0);
                setFlipped(false);
                setScore({ got: 0, miss: 0 });
              }}
              style={{ ...S.btn(), marginTop: 16 }}
            >
              Restart
            </button>
          </div>
        ) : (
          <div
            onClick={() => setFlipped((f) => !f)}
            style={{
              ...S.card,
              minHeight: 200,
              cursor: "pointer",
              textAlign: "center",
              padding: 36,
              border: flipped
                ? "1px solid rgba(30,132,73,0.4)"
                : "1px solid rgba(255,255,255,0.06)",
              transition: "all 0.3s",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#666",
                marginBottom: 12,
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              {flipped ? "Answer" : "Question — tap to reveal"}
            </div>
            <div
              style={{
                fontSize: 18,
                lineHeight: 1.6,
                color: flipped ? "#7dcea0" : "#e8e0d5",
              }}
            >
              {flipped ? card.a : card.q}
            </div>
          </div>
        )}
        {flipped && !done && (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => {
                setScore((s) => ({ ...s, miss: s.miss + 1 }));
                setIdx((i) => i + 1);
                setFlipped(false);
              }}
              style={{ ...S.btn("danger"), flex: 1, fontSize: 15 }}
            >
              ✗ Missed
            </button>
            <button
              onClick={() => {
                setScore((s) => ({ ...s, got: s.got + 1 }));
                setIdx((i) => i + 1);
                setFlipped(false);
              }}
              style={{
                ...S.btn(),
                flex: 1,
                fontSize: 15,
                background: "rgba(30,132,73,0.8)",
              }}
            >
              ✓ Got it
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={form.q}
          onChange={(e) => setForm((f) => ({ ...f, q: e.target.value }))}
          placeholder="Question / Term"
          style={{ ...S.input, flex: 2 }}
        />
        <input
          value={form.a}
          onChange={(e) => setForm((f) => ({ ...f, a: e.target.value }))}
          placeholder="Answer / Definition"
          style={{ ...S.input, flex: 2 }}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button onClick={add} style={S.btn()}>
          Add
        </button>
      </div>
      {cards.length > 0 && (
        <button
          onClick={() => {
            setMode("study");
            setIdx(0);
            setFlipped(false);
            setScore({ got: 0, miss: 0 });
          }}
          style={{ ...S.btn(), width: "100%" }}
        >
          🎯 Start Study Session ({cards.length} cards)
        </button>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {cards.map((c) => (
          <div
            key={c.id}
            style={{
              ...S.card,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                {c.q}
              </div>
              <div style={{ fontSize: 13, color: "#888" }}>{c.a}</div>
            </div>
            <button
              onClick={() => del(c.id)}
              style={{
                ...S.btn("danger"),
                padding: "4px 8px",
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
        ))}
        {cards.length === 0 && (
          <div style={{ textAlign: "center", color: "#555", padding: 30 }}>
            No flashcards yet. Add some above!
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SLIDES BUILDER ───────────────────────────────────────────────────────────
function SlidesBuilder({ storeKey }) {
  const [slides, setSlides] = useLS("slides_" + storeKey, []);
  const [active, setActive] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [pIdx, setPIdx] = useState(0);

  const addSlide = () => {
    const s = [
      ...slides,
      {
        id: uid(),
        title: "New Slide",
        body: "",
        bg: "#1e2430",
        accent: "#c0392b",
      },
    ];
    setSlides(s);
    setActive(s.length - 1);
  };
  const upd = (field, val) => {
    setSlides(
      slides.map((s, i) => (i === active ? { ...s, [field]: val } : s)),
    );
  };
  const del = (i) => {
    const s = slides.filter((_, j) => j !== i);
    setSlides(s);
    setActive(Math.min(active, s.length - 1));
  };

  const BKGS = [
    "#1e2430",
    "#0f1117",
    "#1a1a2e",
    "#1e1a2e",
    "#1a2e1e",
    "#2e1a1a",
    "#1a2a2e",
    "#2e2e1a",
  ];
  const ACCENTS = [
    "#c0392b",
    "#2471a3",
    "#1e8449",
    "#7d3c98",
    "#d35400",
    "#148f77",
    "#c0392b",
    "#e67e22",
  ];

  if (presenting && slides.length > 0) {
    const s = slides[pIdx];
    return (
      <div
        style={{
          background: s.bg,
          borderRadius: 14,
          padding: 60,
          minHeight: 400,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          border: `2px solid ${s.accent}33`,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "flex",
            gap: 8,
          }}
        >
          <button
            onClick={() => setPIdx((p) => Math.max(0, p - 1))}
            style={S.btn("ghost")}
            disabled={pIdx === 0}
          >
            ← Prev
          </button>
          <span style={{ color: "#666", fontSize: 13, alignSelf: "center" }}>
            {pIdx + 1}/{slides.length}
          </span>
          <button
            onClick={() => setPIdx((p) => Math.min(slides.length - 1, p + 1))}
            style={S.btn("ghost")}
            disabled={pIdx === slides.length - 1}
          >
            Next →
          </button>
          <button onClick={() => setPresenting(false)} style={S.btn("danger")}>
            ✕ End
          </button>
        </div>
        <div
          style={{
            width: 60,
            height: 4,
            background: s.accent,
            borderRadius: 2,
            marginBottom: 32,
          }}
        />
        <h2
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#fff",
            margin: "0 0 24px",
            fontFamily: "Georgia,serif",
          }}
        >
          {s.title}
        </h2>
        <div
          style={{
            fontSize: 16,
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.8,
            maxWidth: 600,
            whiteSpace: "pre-wrap",
          }}
        >
          {s.body}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div
        style={{
          width: 140,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {slides.map((s, i) => (
          <div
            key={s.id}
            onClick={() => setActive(i)}
            style={{
              background: i === active ? "rgba(192,57,43,0.25)" : s.bg,
              borderRadius: 8,
              padding: "8px 10px",
              cursor: "pointer",
              border:
                i === active
                  ? "1px solid rgba(192,57,43,0.5)"
                  : "1px solid rgba(255,255,255,0.06)",
              fontSize: 12,
              color: "#ccc",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.title || "Slide " + (i + 1)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                del(i);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#c0392b",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={addSlide}
          style={{ ...S.btn(), width: "100%", padding: "7px 0" }}
        >
          + Slide
        </button>
        {slides.length > 0 && (
          <button
            onClick={() => {
              setPresenting(true);
              setPIdx(0);
            }}
            style={{ ...S.btn("ghost"), width: "100%", padding: "7px 0" }}
          >
            ▶ Present
          </button>
        )}
      </div>
      <div style={{ flex: 1 }}>
        {slides.length === 0 ? (
          <div
            style={{
              ...S.card,
              textAlign: "center",
              padding: 40,
              color: "#555",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>🖥️</div>
            Click "+ Slide" to start building your presentation
          </div>
        ) : slides[active] ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              value={slides[active].title}
              onChange={(e) => upd("title", e.target.value)}
              placeholder="Slide title..."
              style={{
                ...S.input,
                fontSize: 18,
                fontWeight: 700,
                padding: "10px 14px",
              }}
            />
            <textarea
              value={slides[active].body}
              onChange={(e) => upd("body", e.target.value)}
              placeholder="Slide content, bullet points, key facts..."
              style={{
                ...S.input,
                minHeight: 160,
                resize: "vertical",
                lineHeight: 1.7,
                fontFamily: "Georgia,serif",
              }}
            />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={S.sectionTitle}>Background</div>
                <div style={{ display: "flex", gap: 5 }}>
                  {BKGS.map((c) => (
                    <div
                      key={c}
                      onClick={() => upd("bg", c)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: c,
                        cursor: "pointer",
                        border:
                          slides[active].bg === c
                            ? "2px solid #c0392b"
                            : "2px solid rgba(255,255,255,0.1)",
                      }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div style={S.sectionTitle}>Accent</div>
                <div style={{ display: "flex", gap: 5 }}>
                  {ACCENTS.map((c) => (
                    <div
                      key={c}
                      onClick={() => upd("accent", c)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: c,
                        cursor: "pointer",
                        border:
                          slides[active].accent === c
                            ? "2px solid #fff"
                            : "2px solid transparent",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div
              style={{
                background: slides[active].bg,
                borderRadius: 12,
                padding: 28,
                border: `1px solid ${slides[active].accent}44`,
                minHeight: 120,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 3,
                  background: slides[active].accent,
                  borderRadius: 2,
                  marginBottom: 16,
                }}
              />
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#fff",
                  marginBottom: 10,
                  fontFamily: "Georgia,serif",
                }}
              >
                {slides[active].title || "Title"}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.7)",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {slides[active].body || "Content..."}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── TASKS ────────────────────────────────────────────────────────────────────
function Tasks({ storeKey }) {
  const [tasks, setTasks] = useLS("tasks_" + storeKey, []);
  const [input, setInput] = useState("");
  const [priority, setPriority] = useState("medium");

  const add = () => {
    if (!input.trim()) return;
    setTasks([
      ...tasks,
      { id: uid(), text: input, done: false, priority, created: Date.now() },
    ]);
    setInput("");
  };
  const toggle = (id) =>
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const del = (id) => setTasks(tasks.filter((t) => t.id !== id));

  const pColor = { high: "#c0392b", medium: "#d35400", low: "#1e8449" };
  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const po = { high: 0, medium: 1, low: 2 };
    return po[a.priority] - po[b.priority];
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a task..."
          style={{ ...S.input, flex: 1 }}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          style={{ ...S.input, width: 110, flex: "none" }}
        >
          <option value="high">🔴 High</option>
          <option value="medium">🟠 Medium</option>
          <option value="low">🟢 Low</option>
        </select>
        <button onClick={add} style={S.btn()}>
          Add
        </button>
      </div>
      <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
        {["high", "medium", "low"].map((p) => (
          <span key={p} style={S.badge(pColor[p])}>
            {tasks.filter((t) => t.priority === p && !t.done).length} {p}
          </span>
        ))}
        <span style={{ ...S.badge("#555"), marginLeft: "auto" }}>
          {tasks.filter((t) => t.done).length}/{tasks.length} done
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map((t) => (
          <div
            key={t.id}
            style={{
              ...S.card,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              opacity: t.done ? 0.5 : 1,
              borderLeft: `3px solid ${pColor[t.priority]}`,
            }}
          >
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => toggle(t.id)}
              style={{
                width: 16,
                height: 16,
                accentColor: "#c0392b",
                cursor: "pointer",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                flex: 1,
                fontSize: 14,
                textDecoration: t.done ? "line-through" : "none",
                color: t.done ? "#666" : "#e8e0d5",
              }}
            >
              {t.text}
            </span>
            <span style={S.badge(pColor[t.priority])}>{t.priority}</span>
            <button
              onClick={() => del(t.id)}
              style={{ ...S.btn("danger"), padding: "3px 7px", fontSize: 12 }}
            >
              ✕
            </button>
          </div>
        ))}
        {tasks.length === 0 && (
          <div style={{ textAlign: "center", color: "#555", padding: 24 }}>
            No tasks yet. Add one above!
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TIMETABLE ───────────────────────────────────────────────────────────────
function Timetable() {
  const [schedule, setSchedule] = useLS("ms_timetable", {});
  const [editing, setEditing] = useState(null); // {day,hour}
  const [form, setForm] = useState({
    label: "",
    subject: "anatomy",
    type: "lecture",
  });

  const cellKey = (d, h) => `${d}_${h}`;
  const getCell = (d, h) => schedule[cellKey(d, h)];

  const saveCell = () => {
    if (!form.label.trim()) {
      setEditing(null);
      return;
    }
    setSchedule({ ...schedule, [cellKey(editing.day, editing.hour)]: form });
    setEditing(null);
  };
  const clearCell = (d, h) => {
    const s = { ...schedule };
    delete s[cellKey(d, h)];
    setSchedule(s);
  };

  const typeColors = {
    lecture: "#2471a3",
    practical: "#1e8449",
    tutorial: "#d35400",
    self: "#7d3c98",
    break: "#626567",
  };
  const TYPES = ["lecture", "practical", "tutorial", "self", "break"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, color: "#e8e0d5" }}>
          Weekly Timetable
        </h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TYPES.map((t) => (
            <span
              key={t}
              style={{ ...S.tag(typeColors[t]), textTransform: "capitalize" }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ borderCollapse: "collapse", minWidth: 700, width: "100%" }}
        >
          <thead>
            <tr>
              <th
                style={{
                  width: 50,
                  padding: "8px 6px",
                  fontSize: 11,
                  color: "#666",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                Time
              </th>
              {DAYS.map((d) => (
                <th
                  key={d}
                  style={{
                    padding: "8px 6px",
                    fontSize: 12,
                    color: "#aaa",
                    fontWeight: 600,
                    textAlign: "center",
                    minWidth: 90,
                  }}
                >
                  {d.slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS.map((h) => (
              <tr key={h}>
                <td
                  style={{
                    padding: "4px 6px",
                    fontSize: 11,
                    color: "#555",
                    textAlign: "center",
                    verticalAlign: "middle",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h % 12 || 12}
                  {h < 12 ? "am" : "pm"}
                </td>
                {DAYS.map((d) => {
                  const cell = getCell(d, h);
                  const subj = SUBJECTS.find((s) => s.id === cell?.subject);
                  return (
                    <td
                      key={d}
                      onClick={() => {
                        setEditing({ day: d, hour: h });
                        setForm(
                          cell || {
                            label: "",
                            subject: "anatomy",
                            type: "lecture",
                          },
                        );
                      }}
                      style={{
                        padding: 3,
                        verticalAlign: "top",
                        cursor: "pointer",
                        position: "relative",
                      }}
                    >
                      {cell ? (
                        <div
                          style={{
                            background: typeColors[cell.type] + "22",
                            borderRadius: 6,
                            padding: "4px 6px",
                            borderLeft: `3px solid ${typeColors[cell.type]}`,
                            minHeight: 36,
                            fontSize: 11,
                            lineHeight: 1.4,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              color: "#e8e0d5",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {cell.label}
                          </div>
                          <div style={{ color: "#888", fontSize: 10 }}>
                            {subj?.icon} {subj?.name}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearCell(d, h);
                            }}
                            style={{
                              position: "absolute",
                              top: 3,
                              right: 3,
                              background: "transparent",
                              border: "none",
                              color: "#c0392b",
                              cursor: "pointer",
                              fontSize: 12,
                              lineHeight: 1,
                              padding: 0,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            borderRadius: 6,
                            minHeight: 36,
                            border: "1px dashed rgba(255,255,255,0.05)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "rgba(255,255,255,0.06)",
                            fontSize: 16,
                          }}
                        >
                          +
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditing(null);
          }}
        >
          <div
            style={{
              ...S.card,
              width: 340,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {editing.day} · {editing.hour % 12 || 12}
              {editing.hour < 12 ? "am" : "pm"}
            </div>
            <input
              value={form.label}
              onChange={(e) =>
                setForm((f) => ({ ...f, label: e.target.value }))
              }
              placeholder="Session label (e.g. Upper Limb Anatomy)"
              style={S.input}
              autoFocus
            />
            <select
              value={form.subject}
              onChange={(e) =>
                setForm((f) => ({ ...f, subject: e.target.value }))
              }
              style={S.input}
            >
              {SUBJECTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              style={S.input}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveCell} style={{ ...S.btn(), flex: 1 }}>
                Save
              </button>
              <button
                onClick={() => setEditing(null)}
                style={{ ...S.btn("ghost"), flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── REMINDERS ────────────────────────────────────────────────────────────────
function Reminders() {
  const [reminders, setReminders] = useLS("ms_reminders", []);
  const [form, setForm] = useState({
    title: "",
    time: "",
    repeat: "none",
    subject: "",
    type: "study",
  });
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Check for due reminders
  useEffect(() => {
    reminders.forEach((r) => {
      if (!r.time || r.dismissed) return;
      const due = new Date(r.time);
      const diff = (due - now) / 60000;
      if (diff > -1 && diff < 1 && !r.alerted) {
        // Mark alerted
        setReminders((rs) =>
          rs.map((x) => (x.id === r.id ? { ...x, alerted: true } : x)),
        );
        // Browser notification if permission granted
        if (Notification.permission === "granted") {
          new Notification("📚 MedScholar Reminder", {
            body: r.title,
            icon: "🏥",
          });
        }
      }
    });
  }, [now, reminders]);

  const requestNotif = () => {
    if (Notification.permission === "default") Notification.requestPermission();
  };

  const add = () => {
    if (!form.title.trim()) return;
    setReminders([
      ...reminders,
      {
        id: uid(),
        ...form,
        created: Date.now(),
        dismissed: false,
        alerted: false,
      },
    ]);
    setForm({
      title: "",
      time: "",
      repeat: "none",
      subject: "",
      type: "study",
    });
  };

  const dismiss = (id) =>
    setReminders((rs) =>
      rs.map((r) => (r.id === id ? { ...r, dismissed: true } : r)),
    );
  const del = (id) => setReminders((rs) => rs.filter((r) => r.id !== id));

  const typeIcon = {
    study: "📚",
    lecture: "🎓",
    exam: "📝",
    practical: "🔬",
    break: "☕",
    medication: "💊",
    review: "🔄",
  };
  const TYPES = Object.keys(typeIcon);

  const upcoming = reminders
    .filter((r) => !r.dismissed)
    .sort((a, b) => new Date(a.time) - new Date(b.time));
  const isOverdue = (r) => r.time && new Date(r.time) < now;
  const isDueSoon = (r) => {
    if (!r.time) return false;
    const diff = (new Date(r.time) - now) / 60000;
    return diff >= 0 && diff <= 30;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {Notification.permission === "default" && (
        <div
          style={{
            ...S.card,
            background: "rgba(192,57,43,0.12)",
            border: "1px solid rgba(192,57,43,0.3)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 16px",
          }}
        >
          <span style={{ fontSize: 13, color: "#e8887a" }}>
            🔔 Enable browser notifications for reminders
          </span>
          <button onClick={requestNotif} style={S.btn()}>
            Enable
          </button>
        </div>
      )}

      <div
        style={{ ...S.card, display: "flex", flexDirection: "column", gap: 10 }}
      >
        <div style={S.sectionTitle}>New Reminder</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Reminder title..."
            style={{ ...S.input, flex: 2, minWidth: 160 }}
          />
          <input
            type="datetime-local"
            value={form.time}
            onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
            style={{ ...S.input, flex: 1, minWidth: 160, colorScheme: "dark" }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            style={{ ...S.input, flex: 1 }}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {typeIcon[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={form.subject}
            onChange={(e) =>
              setForm((f) => ({ ...f, subject: e.target.value }))
            }
            style={{ ...S.input, flex: 1 }}
          >
            <option value="">No subject</option>
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icon} {s.name}
              </option>
            ))}
          </select>
          <select
            value={form.repeat}
            onChange={(e) => setForm((f) => ({ ...f, repeat: e.target.value }))}
            style={{ ...S.input, flex: 1 }}
          >
            <option value="none">No repeat</option>
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Weekly</option>
          </select>
          <button onClick={add} style={S.btn()}>
            + Add
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {upcoming.length === 0 && (
          <div style={{ textAlign: "center", color: "#555", padding: 30 }}>
            No reminders set. Add one above!
          </div>
        )}
        {upcoming.map((r) => {
          const subj = SUBJECTS.find((s) => s.id === r.subject);
          const overdue = isOverdue(r),
            soon = isDueSoon(r);
          return (
            <div
              key={r.id}
              style={{
                ...S.card,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderLeft: `3px solid ${overdue ? "#c0392b" : soon ? "#d35400" : "rgba(255,255,255,0.1)"}`,
                background: overdue
                  ? "rgba(192,57,43,0.08)"
                  : soon
                    ? "rgba(211,84,0,0.08)"
                    : "#1e2430",
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>
                {typeIcon[r.type] || "📌"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#e8e0d5",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#888",
                    marginTop: 2,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {r.time && (
                    <span
                      style={{
                        color: overdue ? "#e8887a" : soon ? "#f0a070" : "#888",
                      }}
                    >
                      {overdue
                        ? "⚠️ Overdue · "
                        : soon
                          ? "⏰ Due soon · "
                          : "🕐 "}
                      {new Date(r.time).toLocaleString("en-IN", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  {subj && (
                    <span style={S.tag(subj.color)}>
                      {subj.icon} {subj.name}
                    </span>
                  )}
                  {r.repeat !== "none" && (
                    <span style={S.badge("#666")}>🔁 {r.repeat}</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => dismiss(r.id)}
                  style={{
                    ...S.btn("ghost"),
                    padding: "4px 9px",
                    fontSize: 12,
                  }}
                >
                  ✓ Done
                </button>
                <button
                  onClick={() => del(r.id)}
                  style={{
                    ...S.btn("danger"),
                    padding: "4px 9px",
                    fontSize: 12,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── POMODORO TIMER ───────────────────────────────────────────────────────────
function Pomodoro() {
  const [mode, setMode] = useState("focus"); // focus | short | long
  const TIMES = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
  const [secs, setSecs] = useState(TIMES.focus);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [target, setTarget] = useState(4);
  const intv = useRef(null);

  const reset = (m = mode) => {
    clearInterval(intv.current);
    setSecs(TIMES[m]);
    setRunning(false);
  };

  useEffect(() => {
    if (running) {
      intv.current = setInterval(() => {
        setSecs((s) => {
          if (s <= 1) {
            clearInterval(intv.current);
            setRunning(false);
            if (mode === "focus") setSessions((n) => n + 1);
            if (Notification.permission === "granted")
              new Notification("⏰ Timer Complete!", {
                body:
                  mode === "focus"
                    ? "Great work! Take a break."
                    : "Break over. Back to study!",
              });
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intv.current);
  }, [running, mode]);

  const switchMode = (m) => {
    setMode(m);
    reset(m);
    setSecs(TIMES[m]);
  };
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const pct = (1 - secs / TIMES[mode]) * 100;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        {[
          ["focus", "Focus 25m"],
          ["short", "Short Break 5m"],
          ["long", "Long Break 15m"],
        ].map(([m, l]) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            style={{ ...S.btn(mode === m ? "primary" : "ghost"), fontSize: 12 }}
          >
            {l}
          </button>
        ))}
      </div>

      <div style={{ position: "relative", width: 200, height: 200 }}>
        <svg
          width={200}
          height={200}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: "rotate(-90deg)",
          }}
        >
          <circle
            cx={100}
            cy={100}
            r={88}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={8}
          />
          <circle
            cx={100}
            cy={100}
            r={88}
            fill="none"
            stroke={mode === "focus" ? "#c0392b" : "#1e8449"}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 88}`}
            strokeDashoffset={`${2 * Math.PI * 88 * (1 - pct / 100)}`}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              fontFamily: "monospace",
              color: "#e8e0d5",
              letterSpacing: 2,
            }}
          >
            {mm}:{ss}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: 2,
              marginTop: 4,
            }}
          >
            {mode}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={() => setRunning((r) => !r)}
          style={{ ...S.btn(), padding: "10px 32px", fontSize: 16 }}
        >
          {running ? "⏸ Pause" : "▶ Start"}
        </button>
        <button
          onClick={() => reset()}
          style={{ ...S.btn("ghost"), padding: "10px 20px" }}
        >
          ↺ Reset
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {Array.from({ length: target }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: i < sessions ? "#c0392b" : "rgba(255,255,255,0.1)",
              transition: "background 0.3s",
            }}
          />
        ))}
        <span style={{ fontSize: 12, color: "#666", marginLeft: 4 }}>
          {sessions}/{target} sessions
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#666" }}>Daily target:</span>
        <input
          type="number"
          min={1}
          max={12}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value) || 4)}
          style={{ ...S.input, width: 60, textAlign: "center" }}
        />
        <span style={{ fontSize: 12, color: "#666" }}>sessions</span>
      </div>
    </div>
  );
}

// ─── AI ASSIST ────────────────────────────────────────────────────────────────

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ setView, setActiveSubject, setActiveTool }) {
  const [tasks] = useLS("tasks_global", []);
  const [reminders] = useLS("ms_reminders", []);
  const [now] = useState(new Date());
  const upcomingReminders = reminders
    .filter((r) => !r.dismissed && r.time && new Date(r.time) > now)
    .slice(0, 3);
  const pendingTasks = tasks.filter((t) => !t.done);
  const todayDay = DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1];
  const [schedule] = useLS("ms_timetable", {});
  const todaySessions = HOURS.map((h) => ({
    h,
    cell: schedule[`${todayDay}_${h}`],
  })).filter((x) => x.cell);

  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const quotes = [
    "The art of medicine consists in amusing the patient while nature cures the disease. — Voltaire",
    "Wherever the art of medicine is loved, there is also a love of humanity. — Hippocrates",
    "Medicine is not only a science; it is also an art. — Paracelsus",
    "The good physician treats the disease; the great physician treats the patient. — William Osler",
  ];
  const quote = quotes[now.getDate() % quotes.length];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          ...S.card,
          background: "linear-gradient(135deg,#1a1a2e 0%,#2c1a1a 100%)",
          border: "1px solid rgba(192,57,43,0.2)",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#e8e0d5",
            marginBottom: 4,
          }}
        >
          {greeting} 👋
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#888",
            fontStyle: "italic",
            lineHeight: 1.6,
          }}
        >
          {quote}
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: "#aaa" }}>
          {now.toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
          gap: 10,
        }}
      >
        {[
          {
            icon: "📝",
            label: "Pending Tasks",
            value: pendingTasks.length,
            color: "#d35400",
          },
          {
            icon: "🔔",
            label: "Upcoming Reminders",
            value: upcomingReminders.length,
            color: "#2471a3",
          },
          {
            icon: "📅",
            label: "Today's Sessions",
            value: todaySessions.length,
            color: "#1e8449",
          },
          {
            icon: "📚",
            label: "Subjects",
            value: SUBJECTS.length,
            color: "#7d3c98",
          },
        ].map(({ icon, label, value, color }) => (
          <div
            key={label}
            style={{
              ...S.card,
              textAlign: "center",
              padding: "16px 12px",
              borderTop: `3px solid ${color}`,
            }}
          >
            <div style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#e8e0d5" }}>
              {value}
            </div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
          gap: 14,
        }}
      >
        {todaySessions.length > 0 && (
          <div style={S.card}>
            <div style={S.sectionTitle}>Today — {todayDay}</div>
            {todaySessions.slice(0, 5).map(({ h, cell }) => {
              const subj = SUBJECTS.find((s) => s.id === cell.subject);
              return (
                <div
                  key={h}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: "6px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <span style={{ fontSize: 11, color: "#555", minWidth: 36 }}>
                    {h % 12 || 12}
                    {h < 12 ? "am" : "pm"}
                  </span>
                  <span style={{ fontSize: 13, flex: 1, color: "#ccc" }}>
                    {cell.label}
                  </span>
                  {subj && <span style={S.tag(subj.color)}>{subj.icon}</span>}
                </div>
              );
            })}
          </div>
        )}

        {upcomingReminders.length > 0 && (
          <div style={S.card}>
            <div style={S.sectionTitle}>Upcoming Reminders</div>
            {upcomingReminders.map((r) => {
              const subj = SUBJECTS.find((s) => s.id === r.subject);
              return (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "6px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <span style={{ fontSize: 16 }}>
                    {{
                      study: "📚",
                      lecture: "🎓",
                      exam: "📝",
                      practical: "🔬",
                      break: "☕",
                      review: "🔄",
                    }[r.type] || "📌"}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#ccc" }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: "#666" }}>
                      {r.time &&
                        new Date(r.time).toLocaleString("en-IN", {
                          weekday: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                    </div>
                  </div>
                  {subj && <span style={S.tag(subj.color)}>{subj.icon}</span>}
                </div>
              );
            })}
          </div>
        )}

        <div style={S.card}>
          <div style={S.sectionTitle}>Quick Access</div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            {[
              { l: "📅 Timetable", v: "timetable" },
              { l: "🔔 Reminders", v: "reminders" },
              { l: "⏱ Pomodoro", v: "pomodoro" },
              { l: "✅ Global Tasks", v: "tasks_global" },
            ].map(({ l, v }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  ...S.btn("ghost"),
                  width: "100%",
                  padding: "8px 10px",
                  fontSize: 12,
                  textAlign: "left",
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Subjects</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))",
            gap: 10,
          }}
        >
          {SUBJECTS.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveSubject(s.id);
                setView("subject");
              }}
              style={{
                background: s.color + "18",
                border: `1px solid ${s.color}33`,
                borderRadius: 10,
                padding: "12px 10px",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>
                {s.name}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SUBJECT VIEW ─────────────────────────────────────────────────────────────
function SubjectView({ subjectId }) {
  const subj = SUBJECTS.find((s) => s.id === subjectId);
  const [chapters, setChapters] = useLS("chapters_" + subjectId, []);
  const [activeChap, setActiveChap] = useState(null);
  const [newChap, setNewChap] = useState("");
  const [activeTool, setActiveTool] = useState("notes");
  const TOOLS = [
    { id: "notes", l: "📝 Notes" },
    { id: "draw", l: "✏️ Draw" },
    { id: "fc", l: "🃏 Flashcards" },
    { id: "slides", l: "🖥️ Slides" },
    { id: "tasks", l: "✅ Tasks" },
  ];

  const addChapter = () => {
    if (!newChap.trim()) return;
    const c = { id: uid(), name: newChap };
    setChapters([...chapters, c]);
    setNewChap("");
    setActiveChap(c.id);
  };

  const chap = chapters.find((c) => c.id === activeChap);

  return (
    <div style={{ display: "flex", gap: 16, height: "100%" }}>
      <div
        style={{
          width: 180,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={newChap}
            onChange={(e) => setNewChap(e.target.value)}
            placeholder="Chapter name..."
            style={{ ...S.input, flex: 1, fontSize: 12, padding: "6px 10px" }}
            onKeyDown={(e) => e.key === "Enter" && addChapter()}
          />
          <button
            onClick={addChapter}
            style={{ ...S.btn(), padding: "6px 10px", fontSize: 13 }}
          >
            +
          </button>
        </div>
        {chapters.map((c) => (
          <div
            key={c.id}
            onClick={() => setActiveChap(c.id)}
            style={{
              ...S.navBtn(activeChap === c.id),
              borderLeft: `3px solid ${activeChap === c.id ? subj?.color : "transparent"}`,
              paddingLeft: 10,
            }}
          >
            <span
              style={{
                fontSize: 12,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {c.name}
            </span>
          </div>
        ))}
        {chapters.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: "#555",
              textAlign: "center",
              paddingTop: 16,
            }}
          >
            Add chapters above
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {!activeChap ? (
          <div
            style={{
              ...S.card,
              textAlign: "center",
              padding: 48,
              color: "#555",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>{subj?.icon}</div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#888",
                marginBottom: 6,
              }}
            >
              {subj?.name}
            </div>
            <div style={{ fontSize: 13 }}>
              Select or create a chapter to begin
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: subj?.color,
                  marginRight: 4,
                }}
              >
                {chap?.name}
              </span>
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTool(t.id)}
                  style={{
                    ...S.btn(activeTool === t.id ? "primary" : "ghost"),
                    padding: "5px 12px",
                    fontSize: 12,
                  }}
                >
                  {t.l}
                </button>
              ))}
              <button
                onClick={() => {
                  const prompt = `
You are an expert MBBS tutor.

Subject: ${subj?.name}
Chapter: ${chap?.name || "General"}

Please explain clearly for an MBBS student.

Include:
- conceptual understanding
- high yield exam points
- mnemonics
- clinical relevance
- viva questions

Question:
`;

                  navigator.clipboard.writeText(prompt);

                  window.open("https://claude.ai", "_blank");
                }}
                style={{
                  ...S.btn("ghost"),
                  padding: "5px 12px",
                  fontSize: 12,
                }}
              >
                🤖 Open in Claude
              </button>
            </div>
            <div style={{ flex: 1 }}>
              {activeTool === "notes" && (
                <NoteEditor noteKey={subjectId + "_" + activeChap} />
              )}
              {activeTool === "draw" && (
                <DrawCanvas saveKey={subjectId + "_" + activeChap} />
              )}
              {activeTool === "fc" && (
                <Flashcards storeKey={subjectId + "_" + activeChap} />
              )}
              {activeTool === "slides" && (
                <SlidesBuilder storeKey={subjectId + "_" + activeChap} />
              )}
              {activeTool === "tasks" && (
                <Tasks storeKey={subjectId + "_" + activeChap} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("dashboard");
  const [activeSubject, setActiveSubject] = useState(null);
  const [activeTool, setActiveTool] = useState("notes");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 600;

  const NAV = [
    { id: "dashboard", l: "🏠 Dashboard" },
    { id: "timetable", l: "📅 Timetable" },
    { id: "reminders", l: "🔔 Reminders" },
    { id: "pomodoro", l: "⏱ Pomodoro" },
    { id: "tasks_global", l: "✅ All Tasks" },
  ];

  const navClick = (v) => {
    setView(v);
    setMobileMenuOpen(false);
  };
  const goSubject = (s) => {
    setActiveSubject(s);
    setView("subject");
    setMobileMenuOpen(false);
  };

  const Sidebar = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "10px 6px",
        overflowY: "auto",
        flex: 1,
      }}
    >
      <div
        style={{
          padding: "0 8px 8px",
          fontSize: 10,
          fontWeight: 700,
          color: "#444",
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        Navigation
      </div>
      {NAV.map((n) => (
        <button
          key={n.id}
          onClick={() => navClick(n.id)}
          style={S.navBtn(view === n.id)}
        >
          {n.l}
        </button>
      ))}
      <div
        style={{
          padding: "12px 8px 8px",
          fontSize: 10,
          fontWeight: 700,
          color: "#444",
          textTransform: "uppercase",
          letterSpacing: 2,
          marginTop: 8,
        }}
      >
        Subjects
      </div>
      {SUBJECTS.map((s) => (
        <button
          key={s.id}
          onClick={() => goSubject(s.id)}
          style={{
            ...S.navBtn(view === "subject" && activeSubject === s.id),
            borderLeft:
              view === "subject" && activeSubject === s.id
                ? `3px solid ${s.color}`
                : "3px solid transparent",
          }}
        >
          <span>{s.icon}</span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {s.name}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div style={S.app}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #0f1117; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #aaa; pointer-events: none; }
        input[type=datetime-local]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        @media (max-width:600px) { .desktop-sidebar { display: none !important; } }
      `}</style>

      <div style={S.topBar}>
        <button
          onClick={() =>
            isMobile ? setMobileMenuOpen((m) => !m) : setSidebarOpen((s) => !s)
          }
          style={{
            background: "transparent",
            border: "none",
            color: "#888",
            fontSize: 20,
            cursor: "pointer",
            padding: 4,
            flexShrink: 0,
          }}
        >
          ☰
        </button>
        <div>
          <div style={S.logo}>⚕ MedScholar</div>
          <div style={S.logoSub}>MBBS Study Platform</div>
        </div>
        <div style={{ flex: 1 }} />
        {view === "subject" && activeSubject && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
            }}
          >
            <span
              style={S.badge(
                SUBJECTS.find((s) => s.id === activeSubject)?.color || "#666",
              )}
            >
              {SUBJECTS.find((s) => s.id === activeSubject)?.icon}{" "}
              {SUBJECTS.find((s) => s.id === activeSubject)?.name}
            </span>
          </div>
        )}
        <div
          style={{
            fontSize: 12,
            color: "#555",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#1e8449",
              display: "inline-block",
            }}
          />
          v1.0
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex" }}
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            style={{
              width: 240,
              background: "#161b22",
              borderRight: "1px solid rgba(255,255,255,0.07)",
              height: "100%",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar />
          </div>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} />
        </div>
      )}

      <div style={S.body}>
        <div
          className="desktop-sidebar"
          style={{ ...S.sidebar, ...(!sidebarOpen ? S.sidebarCollapsed : {}) }}
        >
          {sidebarOpen ? (
            <Sidebar />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: "10px 6px",
                alignItems: "center",
              }}
            >
              {[
                ...NAV,
                ...SUBJECTS.map((s) => ({
                  id: s.id,
                  l: s.icon,
                  isSub: true,
                  s,
                })),
              ].map((n) => (
                <button
                  key={n.id}
                  onClick={() => (n.isSub ? goSubject(n.id) : navClick(n.id))}
                  title={n.l}
                  style={{
                    ...S.navBtn(
                      view === n.id ||
                        (view === "subject" && activeSubject === n.id),
                    ),
                    padding: "8px",
                    justifyContent: "center",
                    width: 36,
                    height: 36,
                    fontSize: 16,
                  }}
                >
                  {n.l.slice(0, 2)}
                </button>
              ))}
            </div>
          )}
        </div>

        <main style={S.main}>
          {view === "dashboard" && (
            <Dashboard
              setView={setView}
              setActiveSubject={setActiveSubject}
              setActiveTool={setActiveTool}
            />
          )}
          {view === "timetable" && <Timetable />}
          {view === "reminders" && <Reminders />}
          {view === "pomodoro" && (
            <div
              style={{
                ...S.card,
                maxWidth: 400,
                margin: "0 auto",
                width: "100%",
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  marginBottom: 20,
                  textAlign: "center",
                }}
              >
                ⏱ Pomodoro Timer
              </div>
              <Pomodoro />
            </div>
          )}
          {view === "tasks_global" && <Tasks storeKey="global" />}
          {view === "subject" && activeSubject && (
            <SubjectView subjectId={activeSubject} />
          )}
        </main>
      </div>
    </div>
  );
}
