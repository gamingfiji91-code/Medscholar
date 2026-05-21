import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useReducer,
  memo,
} from "react";

// ─── SCHEMA VERSION ───────────────────────────────────────────────────────────
const SCHEMA_VERSION = 2;

function runMigrations() {
  try {
    const stored = parseInt(
      localStorage.getItem("ms_schema_version") || "1",
      10,
    );
    if (stored < 2) {
      // v1 → v2: nothing to migrate structurally, just stamp the version
      localStorage.setItem("ms_schema_version", String(SCHEMA_VERSION));
    }
  } catch (e) {
    console.warn("Migration error:", e);
  }
}
runMigrations();

// ─── INDEXEDDB HOOK (replaces localStorage for drawings) ─────────────────────
const IDB_NAME = "medscholar_db";
const IDB_STORE = "drawings";

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbSet(key, val) {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(val, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

async function idbDel(key) {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const SUBJECTS = [
  { id: "anatomy", name: "Anatomy", color: "#c0392b", icon: "🫀" },
  { id: "physiology", name: "Physiology", color: "#2471a3", icon: "⚡" },
  { id: "biochemistry", name: "Biochemistry", color: "#1e8449", icon: "🧬" },
  { id: "pathology", name: "Pathology", color: "#7d3c98", icon: "🔬" },
  { id: "pharmacology", name: "Pharmacology", color: "#d35400", icon: "💊" },
  { id: "microbiology", name: "Microbiology", color: "#148f77", icon: "🦠" },
  { id: "medicine", name: "Medicine", color: "#2c3e50", icon: "🏥" },
  { id: "surgery", name: "Surgery", color: "#626567", icon: "🔪" },
  { id: "obg", name: "OB/GYN", color: "#c0392b", icon: "👶" },
  { id: "pediatrics", name: "Pediatrics", color: "#1a5276", icon: "🧒" },
  { id: "psychiatry", name: "Psychiatry", color: "#6c3483", icon: "🧠" },
  { id: "radiology", name: "Radiology", color: "#1b2631", icon: "🩻" },
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
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);
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
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function uid() {
  return crypto.randomUUID();
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
      setVal((prev) => {
        const next = typeof v === "function" ? v(prev) : v;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch (e) {
          console.warn("localStorage write failed:", e);
        }
        return next;
      });
    },
    [key],
  );
  return [val, set];
}

// ─── SM-2 SPACED REPETITION ───────────────────────────────────────────────────
function sm2Update(card, quality) {
  // quality: 5=perfect, 4=correct, 3=correct with difficulty, 2=missed
  const q = quality;
  let { easiness = 2.5, interval = 1, repetitions = 0 } = card;
  if (q >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easiness);
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }
  easiness = Math.max(1.3, easiness + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  const due = Date.now() + interval * 24 * 60 * 60 * 1000;
  return { ...card, easiness, interval, repetitions, due };
}

// ─── EXPORT / IMPORT BACKUP ───────────────────────────────────────────────────
function exportBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    try {
      data[k] = JSON.parse(localStorage.getItem(k));
    } catch {
      data[k] = localStorage.getItem(k);
    }
  }
  const blob = new Blob(
    [
      JSON.stringify(
        { version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `medscholar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const data = parsed.data || parsed;
        let count = 0;
        Object.entries(data).forEach(([k, v]) => {
          try {
            localStorage.setItem(
              k,
              typeof v === "string" ? v : JSON.stringify(v),
            );
            count++;
          } catch {}
        });
        resolve(count);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ─── ERROR BOUNDARY ───────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("MedScholar error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, textAlign: "center", color: "#e8e0d5" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Something went wrong
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#888",
              marginBottom: 20,
              maxWidth: 400,
              margin: "0 auto 20px",
            }}
          >
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: "10px 24px",
              background: "rgba(192,57,43,0.85)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  app: {
    fontFamily: "'Segoe UI',system-ui,sans-serif",
    minHeight: "100dvh",
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
    position: "sticky",
    top: 0,
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
    WebkitOverflowScrolling: "touch",
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

// ─── DRAWING CANVAS (IndexedDB + compressed JPEG) ─────────────────────────────
function DrawCanvas({ saveKey }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#1a1a2e");
  const [size, setSize] = useState(4);
  const [mode, setMode] = useState("pen");
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const last = useRef(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fdfaf5";
    ctx.fillRect(0, 0, c.width, c.height);

    // Load from IndexedDB instead of localStorage
    idbGet("draw_" + saveKey).then((saved) => {
      if (saved) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          setHistory([saved]);
          setLoaded(true);
        };
        img.src = saved;
      } else {
        // Compress even the initial blank state as JPEG
        setHistory([c.toDataURL("image/jpeg", 0.6)]);
        setLoaded(true);
      }
    });
    return () => clearTimeout(saveTimer.current);
  }, [saveKey]);

  // Debounced compressed save to IndexedDB
  const debouncedSave = useCallback(
    (data) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        idbSet("draw_" + saveKey, data);
      }, 500);
    },
    [saveKey],
  );

  const compressedSnapshot = () => {
    // Save as JPEG at 0.6 quality — ~10x smaller than PNG
    return canvasRef.current.toDataURL("image/jpeg", 0.6);
  };

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
    const data = compressedSnapshot();
    setHistory((h) => [...h.slice(-19), data]);
    debouncedSave(data);
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
    debouncedSave(h[h.length - 1]);
  };

  const clear = () => {
    const c = canvasRef.current,
      ctx = c.getContext("2d");
    ctx.fillStyle = "#fdfaf5";
    ctx.fillRect(0, 0, c.width, c.height);
    const data = compressedSnapshot();
    setHistory([data]);
    idbDel("draw_" + saveKey);
  };

  if (!loaded)
    return (
      <div
        style={{ ...S.card, textAlign: "center", padding: 40, color: "#555" }}
      >
        Loading canvas…
      </div>
    );

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
            // Export as full PNG for download (quality doesn't matter for export)
            const a = document.createElement("a");
            a.download = "diagram.png";
            a.href = canvasRef.current.toDataURL("image/png");
            a.click();
          }}
          style={{ ...S.btn("ghost"), padding: "4px 10px", fontSize: 13 }}
        >
          ⬇ Export
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={900}
        height={600}
        style={{
          width: "100%",
          borderRadius: 12,
          cursor: mode === "eraser" ? "cell" : "crosshair",
          touchAction: "none",
          background: "#fdfaf5",
          display: "block",
          maxHeight: 420,
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
  const loadedKey = useRef(null);

  useEffect(() => {
    if (edRef.current && loadedKey.current !== noteKey) {
      edRef.current.innerHTML = content;
      loadedKey.current = noteKey;
    }
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
        data-placeholder="Start typing your notes here..."
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

// ─── FLASHCARDS (SM-2 spaced repetition) ─────────────────────────────────────
function Flashcards({ storeKey }) {
  const [cards, setCards] = useLS("fc_" + storeKey, []);
  const [form, setForm] = useState({ q: "", a: "" });
  const [mode, setMode] = useState("list");
  const [studyQueue, setStudyQueue] = useState([]);
  const [qIdx, setQIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [score, setScore] = useState({ got: 0, miss: 0 });

  const add = () => {
    if (!form.q.trim() || !form.a.trim()) return;
    setCards([
      ...cards,
      {
        id: uid(),
        q: form.q,
        a: form.a,
        due: Date.now(),
        easiness: 2.5,
        interval: 1,
        repetitions: 0,
      },
    ]);
    setForm({ q: "", a: "" });
  };
  const del = (id) => setCards(cards.filter((c) => c.id !== id));

  // Cards due now (or never studied yet)
  const dueCards = cards.filter((c) => !c.due || c.due <= Date.now());
  const allCards = cards;

  const startStudy = (useAll = false) => {
    const queue = useAll
      ? [...cards]
      : dueCards.length > 0
        ? [...dueCards]
        : [...cards];
    // Sort: overdue first, then by easiness ascending (hardest first)
    queue.sort((a, b) => (a.due || 0) - (b.due || 0));
    setStudyQueue(queue);
    setQIdx(0);
    setFlipped(false);
    setScore({ got: 0, miss: 0 });
    setMode("study");
  };

  if (mode === "study") {
    const done = qIdx >= studyQueue.length;
    const card = done ? null : studyQueue[qIdx];
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
            {done ? studyQueue.length : qIdx + 1} / {studyQueue.length}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={S.badge("#1e8449")}>✓ {score.got}</span>
            <span style={S.badge("#c0392b")}>✗ {score.miss}</span>
          </div>
          <button onClick={() => setMode("list")} style={S.btn("ghost")}>
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
            <div style={{ color: "#555", fontSize: 12, marginTop: 8 }}>
              Next due cards scheduled by spaced repetition
            </div>
            <button
              onClick={() => setMode("list")}
              style={{ ...S.btn(), marginTop: 16 }}
            >
              Back to list
            </button>
          </div>
        ) : (
          <>
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
                  fontSize: 10,
                  color: "#555",
                  marginBottom: 8,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ textTransform: "uppercase", letterSpacing: 2 }}>
                  {flipped ? "Answer" : "Question — tap to reveal"}
                </span>
                {card.interval > 1 && (
                  <span style={S.badge("#2471a3")}>
                    interval: {card.interval}d
                  </span>
                )}
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
            {flipped && (
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { label: "✗ Blackout", q: 0, color: "#8B0000" },
                  { label: "Almost", q: 2, color: "#c0392b" },
                  { label: "Hard", q: 3, color: "#d35400" },
                  { label: "Good", q: 4, color: "#1a7a4a" },
                  { label: "✓ Easy", q: 5, color: "#1e8449" },
                ].map(({ label, q }) => (
                  <button
                    key={label}
                    onClick={() => {
                      const updated = sm2Update(card, q);
                      setCards((prev) =>
                        prev.map((c) => (c.id === card.id ? updated : c)),
                      );
                      if (q >= 3) setScore((s) => ({ ...s, got: s.got + 1 }));
                      else setScore((s) => ({ ...s, miss: s.miss + 1 }));
                      setQIdx((i) => i + 1);
                      setFlipped(false);
                    }}
                    style={{
                      ...S.btn(
                        q >= 4 ? "primary" : q >= 3 ? "ghost" : "danger",
                      ),
                      flex: 1,
                      fontSize: 12,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </>
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
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => startStudy(false)}
            style={{ ...S.btn(), flex: 1 }}
          >
            🎯 Study Due ({dueCards.length > 0 ? dueCards.length : "all"} cards)
          </button>
          {dueCards.length > 0 && dueCards.length < cards.length && (
            <button
              onClick={() => startStudy(true)}
              style={{ ...S.btn("ghost"), flex: 1 }}
            >
              Study All ({cards.length})
            </button>
          )}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {cards.map((c) => {
          const isDue = !c.due || c.due <= Date.now();
          const dueDate =
            c.due && c.due > Date.now()
              ? new Date(c.due).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })
              : null;
          return (
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
                <div
                  style={{
                    fontSize: 11,
                    color: "#555",
                    marginTop: 4,
                    display: "flex",
                    gap: 8,
                  }}
                >
                  {isDue ? (
                    <span style={{ color: "#d35400" }}>📅 Due now</span>
                  ) : (
                    <span>📅 Due {dueDate}</span>
                  )}
                  <span>Interval: {c.interval || 1}d</span>
                  <span>Rep: {c.repetitions || 0}</span>
                </div>
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
          );
        })}
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

  const safeActive = Math.min(active, Math.max(0, slides.length - 1));

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
  const upd = (field, val) =>
    setSlides(
      slides.map((s, i) => (i === safeActive ? { ...s, [field]: val } : s)),
    );
  const del = (i) => {
    const s = slides.filter((_, j) => j !== i);
    setSlides(s);
    setActive(
      Math.max(
        0,
        i === safeActive ? i - 1 : safeActive > i ? safeActive - 1 : safeActive,
      ),
    );
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

  const currentSlide = slides[safeActive];
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
              background: i === safeActive ? "rgba(192,57,43,0.25)" : s.bg,
              borderRadius: 8,
              padding: "8px 10px",
              cursor: "pointer",
              border:
                i === safeActive
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
        ) : currentSlide ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              value={currentSlide.title}
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
              value={currentSlide.body}
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
                          currentSlide.bg === c
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
                          currentSlide.accent === c
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
                background: currentSlide.bg,
                borderRadius: 12,
                padding: 28,
                border: `1px solid ${currentSlide.accent}44`,
                minHeight: 120,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 3,
                  background: currentSlide.accent,
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
                {currentSlide.title || "Title"}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.7)",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {currentSlide.body || "Content..."}
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
  const clearDone = () => setTasks(tasks.filter((t) => !t.done));

  const pColor = { high: "#c0392b", medium: "#d35400", low: "#1e8449" };
  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });
  const doneCount = tasks.filter((t) => t.done).length;

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
      <div
        style={{ display: "flex", gap: 10, fontSize: 12, alignItems: "center" }}
      >
        {["high", "medium", "low"].map((p) => (
          <span key={p} style={S.badge(pColor[p])}>
            {tasks.filter((t) => t.priority === p && !t.done).length} {p}
          </span>
        ))}
        <span style={{ ...S.badge("#555"), marginLeft: "auto" }}>
          {doneCount}/{tasks.length} done
        </span>
        {doneCount > 0 && (
          <button
            onClick={clearDone}
            style={{ ...S.btn("ghost"), padding: "3px 10px", fontSize: 11 }}
          >
            Clear done
          </button>
        )}
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
              borderRadius: 10,
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

// ─── TIMETABLE (memoized cells) ───────────────────────────────────────────────
const TimetableCell = memo(function TimetableCell({
  cell,
  subj,
  onClick,
  onClear,
}) {
  const typeColors = {
    lecture: "#2471a3",
    practical: "#1e8449",
    tutorial: "#d35400",
    self: "#7d3c98",
    break: "#626567",
  };
  return (
    <td
      onClick={onClick}
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
              onClear();
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
});

function Timetable() {
  const [schedule, setSchedule] = useLS("ms_timetable", {});
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    label: "",
    subject: "anatomy",
    type: "lecture",
  });

  const cellKey = useCallback((d, h) => `${d}_${h}`, []);
  const getCell = useCallback(
    (d, h) => schedule[cellKey(d, h)],
    [schedule, cellKey],
  );

  const saveCell = () => {
    if (!form.label.trim()) {
      setEditing(null);
      return;
    }
    setSchedule({ ...schedule, [cellKey(editing.day, editing.hour)]: form });
    setEditing(null);
  };
  const clearCell = useCallback(
    (d, h) => {
      setSchedule((prev) => {
        const s = { ...prev };
        delete s[cellKey(d, h)];
        return s;
      });
    },
    [cellKey],
  );

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
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
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
                    <TimetableCell
                      key={d}
                      cell={cell}
                      subj={subj}
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
                      onClear={() => clearCell(d, h)}
                    />
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
              onKeyDown={(e) => e.key === "Enter" && saveCell()}
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

// ─── REMINDERS (useReducer) ───────────────────────────────────────────────────
function remindersReducer(state, action) {
  switch (action.type) {
    case "ADD":
      return [...state, action.payload];
    case "DISMISS":
      return state.map((r) =>
        r.id === action.id ? { ...r, dismissed: true } : r,
      );
    case "DELETE":
      return state.filter((r) => r.id !== action.id);
    case "MARK_ALERTED":
      return state.map((r) =>
        r.id === action.id ? { ...r, alerted: true } : r,
      );
    case "RESET_ALERTED_FOR_REPEAT":
      return state.map((r) => {
        if (r.id !== action.id || r.repeat === "none") return r;
        const now = new Date(action.now);
        let nextDue = new Date(r.time);
        while (nextDue <= now) {
          if (r.repeat === "daily") nextDue.setDate(nextDue.getDate() + 1);
          else if (r.repeat === "weekdays") {
            nextDue.setDate(nextDue.getDate() + 1);
            while ([0, 6].includes(nextDue.getDay()))
              nextDue.setDate(nextDue.getDate() + 1);
          } else if (r.repeat === "weekly")
            nextDue.setDate(nextDue.getDate() + 7);
          else break;
        }
        return {
          ...r,
          time: nextDue.toISOString().slice(0, 16),
          alerted: false,
        };
      });
    default:
      return state;
  }
}

function useRemindersLS() {
  const key = "ms_reminders";
  const [state, dispatch] = useReducer(remindersReducer, [], () => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  // Sync to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.warn("Reminders save failed:", e);
    }
  }, [state]);

  return [state, dispatch];
}

function Reminders() {
  const [reminders, dispatch] = useRemindersLS();
  const [form, setForm] = useState({
    title: "",
    time: "",
    repeat: "none",
    subject: "",
    type: "study",
  });
  const [now, setNow] = useState(Date.now());
  const [notifPerm, setNotifPerm] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );

  // Tick every 30s
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Also check on window focus (critical for mobile where tabs can sleep)
  useEffect(() => {
    const onFocus = () => setNow(Date.now());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Fire notifications
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    reminders.forEach((r) => {
      if (!r.time || r.dismissed || r.alerted) return;
      const diff = (new Date(r.time) - now) / 60000;
      if (diff > -1 && diff < 1) {
        dispatch({ type: "MARK_ALERTED", id: r.id });
        if (r.repeat !== "none")
          dispatch({ type: "RESET_ALERTED_FOR_REPEAT", id: r.id, now });
        if (Notification.permission === "granted") {
          try {
            new Notification("📚 MedScholar Reminder", { body: r.title });
          } catch (e) {
            console.warn("Notification failed:", e);
          }
        }
      }
    });
  }, [now, reminders]);

  const requestNotif = () => {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then((p) => setNotifPerm(p));
  };

  const add = () => {
    if (!form.title.trim()) return;
    dispatch({
      type: "ADD",
      payload: {
        id: uid(),
        ...form,
        created: Date.now(),
        dismissed: false,
        alerted: false,
      },
    });
    setForm({
      title: "",
      time: "",
      repeat: "none",
      subject: "",
      type: "study",
    });
  };

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
      {notifPerm === "default" && (
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
            onKeyDown={(e) => e.key === "Enter" && add()}
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
                borderRadius: 10,
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
                  onClick={() => dispatch({ type: "DISMISS", id: r.id })}
                  style={{
                    ...S.btn("ghost"),
                    padding: "4px 9px",
                    fontSize: 12,
                  }}
                >
                  ✓ Done
                </button>
                <button
                  onClick={() => dispatch({ type: "DELETE", id: r.id })}
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

// ─── POMODORO (timestamp-based — survives tab throttling) ─────────────────────
function Pomodoro() {
  const TIMES = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
  const [mode, setMode] = useState("focus");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(TIMES.focus);
  const [sessions, setSessions] = useState(0);
  const [target, setTarget] = useState(4);
  // Timestamp-based: store when the current session started + how many seconds were left at that point
  const startedAt = useRef(null);
  const baseRemaining = useRef(TIMES.focus);
  const intv = useRef(null);
  const modeRef = useRef("focus");

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const tick = useCallback(() => {
    if (!startedAt.current) return;
    const elapsed = (Date.now() - startedAt.current) / 1000;
    const left = Math.max(0, baseRemaining.current - elapsed);
    setRemaining(left);
    if (left <= 0) {
      clearInterval(intv.current);
      setRunning(false);
      startedAt.current = null;
      if (modeRef.current === "focus") setSessions((n) => n + 1);
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification("⏰ Timer Complete!", {
            body:
              modeRef.current === "focus"
                ? "Great work! Take a break."
                : "Break over. Back to study!",
          });
        } catch (e) {}
      }
    }
  }, []);

  useEffect(() => {
    if (running) {
      startedAt.current = Date.now();
      baseRemaining.current = remaining;
      intv.current = setInterval(tick, 500); // 500ms for accuracy without battery drain
    } else {
      clearInterval(intv.current);
      startedAt.current = null;
    }
    return () => clearInterval(intv.current);
  }, [running]);

  // Re-sync when tab regains focus (handles throttled tabs)
  useEffect(() => {
    const onFocus = () => {
      if (running) tick();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [running, tick]);

  const switchMode = (m) => {
    clearInterval(intv.current);
    setRunning(false);
    setMode(m);
    setRemaining(TIMES[m]);
    baseRemaining.current = TIMES[m];
    startedAt.current = null;
  };

  const reset = () => {
    clearInterval(intv.current);
    setRunning(false);
    setRemaining(TIMES[mode]);
    baseRemaining.current = TIMES[mode];
    startedAt.current = null;
  };

  const secs = Math.ceil(remaining);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const pct = (1 - remaining / TIMES[mode]) * 100;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
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
            style={{ transition: "stroke-dashoffset 0.5s linear" }}
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
          onClick={reset}
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
      {sessions >= target && target > 0 && (
        <span style={{ fontSize: 12, color: "#1e8449", fontWeight: 700 }}>
          🎯 Daily goal reached!
        </span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#666" }}>Daily target:</span>
        <input
          type="number"
          min={1}
          max={12}
          value={target}
          onChange={(e) =>
            setTarget(Math.max(1, Math.min(12, Number(e.target.value) || 4)))
          }
          style={{ ...S.input, width: 60, textAlign: "center" }}
        />
        <span style={{ fontSize: 12, color: "#666" }}>sessions</span>
      </div>
    </div>
  );
}

// ─── BACKUP PANEL ─────────────────────────────────────────────────────────────
function BackupPanel() {
  const [status, setStatus] = useState(null);
  const fileRef = useRef(null);

  const doImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const count = await importBackup(file);
      setStatus({
        ok: true,
        msg: `✅ Restored ${count} items. Reload the page to see changes.`,
      });
    } catch (err) {
      setStatus({ ok: false, msg: `❌ Import failed: ${err.message}` });
    }
    e.target.value = "";
  };

  return (
    <div
      style={{ ...S.card, display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={S.sectionTitle}>Backup & Restore</div>
      <div style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>
        Export all your notes, flashcards, slides, tasks, timetable and
        reminders as a single JSON file. Import it later to restore everything.
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={exportBackup}
          style={{ ...S.btn(), display: "flex", alignItems: "center", gap: 6 }}
        >
          ⬇ Export Backup
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            ...S.btn("ghost"),
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ⬆ Import Backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={doImport}
          style={{ display: "none" }}
        />
      </div>
      {status && (
        <div
          style={{
            fontSize: 13,
            color: status.ok ? "#1e8449" : "#c0392b",
            background: (status.ok ? "#1e8449" : "#c0392b") + "18",
            borderRadius: 8,
            padding: "8px 12px",
          }}
        >
          {status.msg}
          {status.ok && (
            <button
              onClick={() => location.reload()}
              style={{
                ...S.btn(),
                marginLeft: 12,
                padding: "3px 10px",
                fontSize: 12,
              }}
            >
              Reload Now
            </button>
          )}
        </div>
      )}
      <div
        style={{
          fontSize: 11,
          color: "#444",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          paddingTop: 10,
        }}
      >
        Schema v{SCHEMA_VERSION} · Data stored locally in browser (localStorage
        + IndexedDB for drawings)
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ setView, setActiveSubject }) {
  const [tasks] = useLS("tasks_global", []);
  const [schedule] = useLS("ms_timetable", {});
  const [remindersRaw] = useLS("ms_reminders", []);
  const now = new Date();
  const upcomingReminders = remindersRaw
    .filter((r) => !r.dismissed && r.time && new Date(r.time) > now)
    .slice(0, 3);
  const pendingTasks = tasks.filter((t) => !t.done);
  const todayDay = DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1];
  const todaySessions = HOURS.map((h) => ({
    h,
    cell: schedule[`${todayDay}_${h}`],
  })).filter((x) => x.cell);
  const overdueReminders = remindersRaw.filter(
    (r) => !r.dismissed && r.time && new Date(r.time) < now,
  ).length;

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
            label: overdueReminders > 0 ? "⚠️ Overdue!" : "Upcoming",
            value: upcomingReminders.length + overdueReminders,
            color: overdueReminders > 0 ? "#c0392b" : "#2471a3",
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
              ["📅 Timetable", "timetable"],
              ["🔔 Reminders", "reminders"],
              ["⏱ Pomodoro", "pomodoro"],
              ["✅ Global Tasks", "tasks_global"],
              ["💾 Backup", "backup"],
            ].map(([l, v]) => (
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
  const [activeChap, setActiveChap] = useState(null); // string ID
  const [newChap, setNewChap] = useState("");
  const [activeTool, setActiveTool] = useState("notes");
  const [dupError, setDupError] = useState(false);

  const TOOLS = [
    { id: "notes", l: "📝 Notes" },
    { id: "draw", l: "✏️ Draw" },
    { id: "fc", l: "🃏 Flashcards" },
    { id: "slides", l: "🖥️ Slides" },
    { id: "tasks", l: "✅ Tasks" },
  ];

  const addChapter = () => {
    if (!newChap.trim()) return;
    if (
      chapters.some(
        (c) => c.name.toLowerCase() === newChap.trim().toLowerCase(),
      )
    ) {
      setDupError(true);
      setTimeout(() => setDupError(false), 2000);
      return;
    }
    const c = { id: uid(), name: newChap.trim() };
    setChapters([...chapters, c]);
    setNewChap("");
    setActiveChap(c.id);
  };

  const delChapter = (id) => {
    setChapters(chapters.filter((c) => c.id !== id));
    if (activeChap === id) setActiveChap(null);
  };

  const chap = chapters.find((c) => c.id === activeChap);
  useEffect(() => {
    setActiveTool("notes");
  }, [activeChap]);

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
            style={{
              ...S.input,
              flex: 1,
              fontSize: 12,
              padding: "6px 10px",
              ...(dupError ? { borderColor: "#c0392b" } : {}),
            }}
            onKeyDown={(e) => e.key === "Enter" && addChapter()}
          />
          <button
            onClick={addChapter}
            style={{ ...S.btn(), padding: "6px 10px", fontSize: 13 }}
          >
            +
          </button>
        </div>
        {dupError && (
          <div style={{ fontSize: 11, color: "#c0392b" }}>
            Chapter already exists
          </div>
        )}
        {chapters.map((c) => (
          <div
            key={c.id}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <button
              onClick={() => setActiveChap(c.id)}
              style={{
                ...S.navBtn(activeChap === c.id),
                borderLeft: `3px solid ${activeChap === c.id ? subj?.color : "transparent"}`,
                paddingLeft: 10,
                flex: 1,
                overflow: "hidden",
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
            </button>
            <button
              onClick={() => delChapter(c.id)}
              style={{
                background: "transparent",
                border: "none",
                color: "#c0392b",
                cursor: "pointer",
                fontSize: 14,
                padding: "4px",
                flexShrink: 0,
              }}
              title="Delete"
            >
              ×
            </button>
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
        {!chap ? (
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
                {chap.name}
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
                  const prompt = `You are an expert MBBS tutor.\n\nSubject: ${subj?.name}\nChapter: ${chap.name}\n\nPlease explain clearly for an MBBS student. Include conceptual understanding, high yield exam points, mnemonics, clinical relevance, and viva questions.\n\nQuestion: `;
                  navigator.clipboard
                    .writeText(prompt)
                    .catch(() => {})
                    .finally(() => window.open("https://claude.ai", "_blank"));
                }}
                style={{ ...S.btn("ghost"), padding: "5px 12px", fontSize: 12 }}
              >
                🤖 Open in Claude
              </button>
            </div>
            <div style={{ flex: 1 }}>
              <ErrorBoundary>
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
              </ErrorBoundary>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
// ErrorBoundary needs React in scope — import it
import React from "react";

export default function App() {
  const [view, setView] = useState("dashboard");
  const [activeSubject, setActiveSubject] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  // Mobile keyboard viewport fix
  const [kbOffset, setKbOffset] = useState(0);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Detect keyboard on mobile using visualViewport
  useEffect(() => {
    if (!window.visualViewport) return;
    const onViewport = () => {
      const gap = window.innerHeight - window.visualViewport.height;
      setKbOffset(gap > 100 ? gap : 0);
    };
    window.visualViewport.addEventListener("resize", onViewport);
    return () =>
      window.visualViewport.removeEventListener("resize", onViewport);
  }, []);

  const NAV = [
    { id: "dashboard", l: "🏠 Dashboard" },
    { id: "timetable", l: "📅 Timetable" },
    { id: "reminders", l: "🔔 Reminders" },
    { id: "pomodoro", l: "⏱ Pomodoro" },
    { id: "tasks_global", l: "✅ All Tasks" },
    { id: "backup", l: "💾 Backup" },
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

  const SidebarContent = () => (
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
    <div style={{ ...S.app, paddingBottom: kbOffset }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #0f1117; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        [contenteditable][data-placeholder]:empty:before { content: attr(data-placeholder); color: #999; pointer-events: none; }
        input[type=datetime-local]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        button:hover { filter: brightness(1.12); }
        button:active { transform: scale(0.97); }
        @media (max-width:600px) { .desktop-sidebar { display: none !important; } }
        select option { background: #1e2430; color: #e8e0d5; }
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
          <span
            style={S.badge(
              SUBJECTS.find((s) => s.id === activeSubject)?.color || "#666",
            )}
          >
            {SUBJECTS.find((s) => s.id === activeSubject)?.icon}{" "}
            {SUBJECTS.find((s) => s.id === activeSubject)?.name}
          </span>
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
          v3.0
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
            <SidebarContent />
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
            <SidebarContent />
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
                ...SUBJECTS.map((s) => ({ id: s.id, l: s.icon, isSub: true })),
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
          <ErrorBoundary>
            {view === "dashboard" && (
              <Dashboard
                setView={setView}
                setActiveSubject={setActiveSubject}
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
            {view === "backup" && <BackupPanel />}
            {view === "subject" && activeSubject && (
              <SubjectView subjectId={activeSubject} />
            )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
