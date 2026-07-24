const { useState, useEffect, useMemo, useCallback } = React;

/* ---------------------------------------------------------------
   Ledger — Agent Performance Console (static, GitHub Pages build)

   How data publishing works on a static host:
   - The site reads data/app-data.json and data/dis-data.json at
     load time. Whatever is committed to the repo is what every
     visitor (admin or sales) sees.
   - Admin can upload a fresh .xlsx in the Upload tab. That parses
     it and shows a LOCAL PREVIEW (saved to this browser's
     localStorage only). To make it visible to everyone, download
     the generated JSON and commit it into /data in the repo, then
     push — GitHub Pages redeploys automatically in ~1 minute.
--------------------------------------------------------------- */

const USERS = {
  admin: { password: "admin1234", role: "admin", label: "Admin" },
  sales: { password: "12345678", role: "sales", label: "Sales" },
};

const STATUS_ORDER = [
  "3. KYC Pending",
  "4. Selfie Pending",
  "5. IMPS Pending",
  "6. Submit Pending",
  "7. Waiting for document upload",
  "8. NACH Pending",
  "9. Agreement Pending",
  "10. Disbursal initiated",
  "11. Disbursed",
  "12. Closed",
  "Pre-Submit Rejected",
  "Post-Submit Rejected",
  "Cancelled",
];

const RANK_COLORS = ["#C9932B", "#9AA5A0", "#A9764B"];

/* ----------------------------- helpers ----------------------------- */

function excelSerialToDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

function isoFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toISODate(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v)) return isoFromDate(v);
  if (typeof v === "number") return isoFromDate(excelSerialToDate(v));
  if (typeof v === "string") {
    const s = v.trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(s);
    if (!isNaN(d)) return isoFromDate(d);
    return null;
  }
  return null;
}

function monthKey(iso) {
  return iso ? iso.slice(0, 7) : null;
}

function monthLabel(key) {
  if (!key) return "";
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function fmtINR(n) {
  const num = Number(n) || 0;
  return "₹" + num.toLocaleString("en-IN");
}

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
}

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ----------------------- xlsx parsing --------------------------- */

async function parseWorkbook(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
}

function toAppRecords(rows) {
  return rows
    .map((r) => ({
      agent: r["Name"] ? String(r["Name"]).trim() : null,
      date: toISODate(r["applied_date"]),
      status: r["current_status"] || "Unknown",
      number: r["number"] !== null && r["number"] !== undefined ? String(r["number"]) : "",
    }))
    .filter((r) => r.agent && r.date);
}

function toDisRecords(rows) {
  return rows
    .map((r) => ({
      agent: r["Name"] ? String(r["Name"]).trim() : null,
      date: toISODate(r["disbursal_date"]),
      amt: Number(r["disbursed_amt"]) || 0,
      number: r["number"] !== null && r["number"] !== undefined ? String(r["number"]) : "",
    }))
    .filter((r) => r.agent && r.date);
}

/* ------------------------ aggregation ---------------------------- */

function availableMonths(appRecords, disRecords) {
  const set = new Set();
  appRecords.forEach((r) => set.add(monthKey(r.date)));
  disRecords.forEach((r) => set.add(monthKey(r.date)));
  return Array.from(set).filter(Boolean).sort().reverse();
}

function leaderboard(records, month, withAmount) {
  const filtered = month ? records.filter((r) => monthKey(r.date) === month) : records;
  const map = new Map();
  filtered.forEach((r) => {
    if (!map.has(r.agent)) map.set(r.agent, { agent: r.agent, count: 0, amt: 0 });
    const entry = map.get(r.agent);
    entry.count += 1;
    if (withAmount) entry.amt += r.amt || 0;
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function statusBreakdown(records, month) {
  const filtered = month ? records.filter((r) => monthKey(r.date) === month) : records;
  const map = new Map();
  filtered.forEach((r) => {
    map.set(r.status, (map.get(r.status) || 0) + 1);
  });
  const entries = Array.from(map.entries());
  entries.sort((a, b) => {
    const ia = STATUS_ORDER.indexOf(a[0]);
    const ib = STATUS_ORDER.indexOf(b[0]);
    if (ia === -1 && ib === -1) return b[1] - a[1];
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return entries;
}

/* --------------------------- inline icons --------------------------- */
/* Small hand-built line icons so the site has zero icon-library
   dependency — everything runs from three CDN scripts total. */

function Icon({ children, size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const IconLayout = (p) => <Icon {...p}><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></Icon>;
const IconUpload = (p) => <Icon {...p}><path d="M12 15V4"/><path d="M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></Icon>;
const IconFile = (p) => <Icon {...p}><path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M8 13h8M8 17h5"/></Icon>;
const IconWallet = (p) => <Icon {...p}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1"/></Icon>;
const IconLogout = (p) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></Icon>;
const IconChevron = (p) => <Icon {...p}><path d="M6 9l6 6 6-6"/></Icon>;
const IconTrophy = (p) => <Icon {...p}><circle cx="12" cy="9" r="5.5"/><path d="M9.5 14.2L8 21h8l-1.5-6.8"/><path d="M6.5 6H3a4 4 0 0 0 4 5"/><path d="M17.5 6H21a4 4 0 0 1-4 5"/></Icon>;
const IconLock = (p) => <Icon {...p}><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></Icon>;
const IconUser = (p) => <Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6.5 8-6.5S20 17 20 21"/></Icon>;
const IconCheck = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.3 2.3L16 9.5"/></Icon>;
const IconAlert = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.2v.1"/></Icon>;
const IconRefresh = (p) => <Icon {...p}><path d="M3 12a9 9 0 0 1 15.3-6.4L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.3 6.4L3 16"/><path d="M3 21v-5h5"/></Icon>;
const IconBars = (p) => <Icon {...p}><path d="M4 20V10"/><path d="M12 20V4"/><path d="M20 20v-7"/></Icon>;

/* ============================= APP ============================= */

function App() {
  const [session, setSession] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [appRecords, setAppRecords] = useState([]);
  const [disRecords, setDisRecords] = useState([]);
  const [appMeta, setAppMeta] = useState(null);
  const [disMeta, setDisMeta] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [tab, setTab] = useState("overview");
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [salesDataset, setSalesDataset] = useState("app");

  const loadData = useCallback(async () => {
    setDataLoading(true);
    let usedPreview = false;

    // Published data (what's committed in the repo) — the source of
    // truth for everyone visiting the site.
    let a = [];
    let d = [];
    let am = null;
    let dm = null;
    try {
      const res = await fetch("data/app-data.json", { cache: "no-store" });
      if (res.ok) a = await res.json();
    } catch (e) {}
    try {
      const res = await fetch("data/dis-data.json", { cache: "no-store" });
      if (res.ok) d = await res.json();
    } catch (e) {}
    try {
      const res = await fetch("data/app-meta.json", { cache: "no-store" });
      if (res.ok) am = await res.json();
    } catch (e) {}
    try {
      const res = await fetch("data/dis-meta.json", { cache: "no-store" });
      if (res.ok) dm = await res.json();
    } catch (e) {}

    // Admin-only local preview layer: an upload that hasn't been
    // committed to the repo yet. Never shown to the sales role.
    if (session && session.role === "admin") {
      try {
        const pa = localStorage.getItem("preview-app-records");
        if (pa) {
          a = JSON.parse(pa);
          am = JSON.parse(localStorage.getItem("preview-app-meta") || "null");
          usedPreview = true;
        }
      } catch (e) {}
      try {
        const pd = localStorage.getItem("preview-dis-records");
        if (pd) {
          d = JSON.parse(pd);
          dm = JSON.parse(localStorage.getItem("preview-dis-meta") || "null");
          usedPreview = true;
        }
      } catch (e) {}
    }

    setAppRecords(a || []);
    setDisRecords(d || []);
    setAppMeta(am);
    setDisMeta(dm);
    setPreviewing(usedPreview);
    setDataLoading(false);
  }, [session]);

  useEffect(() => {
    if (session) loadData();
  }, [session, loadData]);

  const months = useMemo(() => availableMonths(appRecords, disRecords), [appRecords, disRecords]);

  useEffect(() => {
    if (months.length && !selectedMonth) setSelectedMonth(months[0]);
    if (months.length && selectedMonth && !months.includes(selectedMonth)) {
      setSelectedMonth(months[0]);
    }
  }, [months, selectedMonth]);

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  const isAdmin = session.role === "admin";

  return (
    <div className="shell">
      <Sidebar tab={tab} setTab={setTab} isAdmin={isAdmin} onLogout={() => setSession(null)} />
      <div className="main">
        <TopBar
          session={session}
          months={months}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          onRefresh={loadData}
          loading={dataLoading}
          previewing={previewing}
        />
        <div className="content">
          {isAdmin ? (
            <>
              {tab === "overview" && (
                <OverviewTab
                  appRecords={appRecords}
                  disRecords={disRecords}
                  month={selectedMonth}
                  appMeta={appMeta}
                  disMeta={disMeta}
                />
              )}
              {tab === "applications" && (
                <DatasetTab
                  title="Applications"
                  subtitle="Grouped by applied date"
                  icon={<IconFile size={18} />}
                  records={appRecords}
                  month={selectedMonth}
                  withAmount={false}
                  showStatus
                  emptyHint="Upload the APP incentive file to see application leaderboards."
                />
              )}
              {tab === "disbursals" && (
                <DatasetTab
                  title="Disbursals"
                  subtitle="Grouped by disbursal date"
                  icon={<IconWallet size={18} />}
                  records={disRecords}
                  month={selectedMonth}
                  withAmount
                  emptyHint="Upload the Dis incentive file to see disbursal leaderboards."
                />
              )}
              {tab === "upload" && (
                <UploadTab
                  appMeta={appMeta}
                  disMeta={disMeta}
                  onUploaded={loadData}
                />
              )}
            </>
          ) : (
            <SalesTab
              appRecords={appRecords}
              disRecords={disRecords}
              month={selectedMonth}
              dataset={salesDataset}
              setDataset={setSalesDataset}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Login --------------------------- */

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const key = username.trim().toLowerCase();
    const user = USERS[key];
    if (user && user.password === password) {
      setError("");
      onLogin({ username: key, role: user.role, label: user.label });
    } else {
      setError("Incorrect username or password.");
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-mark">AP</div>
        <h1 className="login-title">Agent Performance Ledger</h1>
        <p className="login-sub">Sign in to view application and disbursal leaderboards.</p>
        <form onSubmit={submit} className="login-form">
          <label className="field">
            <span className="field-label">Username</span>
            <div className="field-input">
              <IconUser size={16} />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin or sales"
                autoFocus
              />
            </div>
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <div className="field-input">
              <IconLock size={16} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </label>
          {error && (
            <div className="login-error">
              <IconAlert size={14} /> {error}
            </div>
          )}
          <button type="submit" className="btn-primary login-btn">
            Sign in
          </button>
        </form>
        <div className="login-foot">
          This is a front-end gate, not real security — anyone with the repo can read the passwords in the source.
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Sidebar --------------------------- */

function Sidebar({ tab, setTab, isAdmin, onLogout }) {
  const items = isAdmin
    ? [
        { id: "overview", label: "Overview", icon: <IconLayout size={17} /> },
        { id: "applications", label: "Applications", icon: <IconFile size={17} /> },
        { id: "disbursals", label: "Disbursals", icon: <IconWallet size={17} /> },
        { id: "upload", label: "Upload Data", icon: <IconUpload size={17} /> },
      ]
    : [{ id: "leaderboard", label: "Leaderboard", icon: <IconTrophy size={17} /> }];

  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">AP</div>
        <div className="brand-text">
          <div className="brand-name">Ledger</div>
          <div className="brand-sub">Agent performance</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {items.map((it) => (
          <button
            key={it.id}
            className={"nav-item" + (!isAdmin || tab === it.id ? " active" : "")}
            onClick={() => setTab(it.id)}
          >
            {it.icon}
            <span>{it.label}</span>
          </button>
        ))}
      </nav>
      <button className="nav-item logout" onClick={onLogout}>
        <IconLogout size={17} />
        <span>Log out</span>
      </button>
    </div>
  );
}

/* --------------------------- TopBar --------------------------- */

function TopBar({ session, months, selectedMonth, setSelectedMonth, onRefresh, loading, previewing }) {
  return (
    <div className="topbar">
      <div className="topbar-title">
        <span className="eyebrow">Current period</span>
        <h2>{selectedMonth ? monthLabel(selectedMonth) : "No data yet"}</h2>
        {previewing && <div className="preview-flag">Local preview — not yet published</div>}
      </div>
      <div className="topbar-controls">
        {months.length > 0 && (
          <div className="select-wrap">
            <select value={selectedMonth || ""} onChange={(e) => setSelectedMonth(e.target.value)}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <IconChevron size={14} className="select-chevron" />
          </div>
        )}
        <button className="icon-btn" onClick={onRefresh} title="Refresh data">
          <IconRefresh size={15} className={loading ? "spin" : ""} />
        </button>
        <div className="role-pill">{session.label}</div>
      </div>
    </div>
  );
}

/* --------------------------- Stat Card --------------------------- */

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

/* --------------------------- Leaderboard --------------------------- */

function LeaderboardTable({ rows, withAmount, emptyHint }) {
  if (!rows.length) {
    return <div className="empty-state">{emptyHint || "No records for this period."}</div>;
  }
  const max = rows[0].count || 1;
  return (
    <div className="lb-table">
      {rows.map((r, i) => (
        <div className="lb-row" key={r.agent}>
          <div
            className="lb-rank"
            style={{
              borderColor: i < 3 ? RANK_COLORS[i] : "#D7DEDC",
              color: i < 3 ? RANK_COLORS[i] : "#6B7280",
            }}
          >
            {i + 1}
          </div>
          <div className="lb-avatar">{initials(r.agent)}</div>
          <div className="lb-body">
            <div className="lb-name">{r.agent}</div>
            <div className="lb-bar-track">
              <div
                className="lb-bar-fill"
                style={{
                  width: `${Math.max(4, (r.count / max) * 100)}%`,
                  background: i < 3 ? RANK_COLORS[i] : "#0B4F4A",
                }}
              />
            </div>
          </div>
          <div className="lb-metrics">
            <div className="lb-count">{r.count}</div>
            {withAmount && <div className="lb-amt">{fmtINR(r.amt)}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------- Overview (admin) --------------------------- */

function OverviewTab({ appRecords, disRecords, month, appMeta, disMeta }) {
  const appLb = useMemo(() => leaderboard(appRecords, month, false), [appRecords, month]);
  const disLb = useMemo(() => leaderboard(disRecords, month, true), [disRecords, month]);
  const totalApps = useMemo(
    () => appRecords.filter((r) => monthKey(r.date) === month).length,
    [appRecords, month]
  );
  const totalDis = useMemo(
    () => disRecords.filter((r) => monthKey(r.date) === month).length,
    [disRecords, month]
  );
  const totalAmt = useMemo(
    () =>
      disRecords
        .filter((r) => monthKey(r.date) === month)
        .reduce((s, r) => s + (r.amt || 0), 0),
    [disRecords, month]
  );

  if (!appRecords.length && !disRecords.length) {
    return (
      <div className="empty-state large">
        <IconUpload size={28} />
        <div className="empty-title">No data published yet</div>
        <div>Head to Upload Data to bring in the APP and Dis incentive files.</div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="stat-grid">
        <StatCard label="Applications this month" value={totalApps.toLocaleString("en-IN")} />
        <StatCard label="Disbursals this month" value={totalDis.toLocaleString("en-IN")} accent="#0B4F4A" />
        <StatCard label="Disbursed amount" value={fmtINR(totalAmt)} accent="#C9932B" />
        <StatCard
          label="Top agent (disbursals)"
          value={disLb[0] ? disLb[0].agent : "—"}
          sub={disLb[0] ? `${disLb[0].count} disbursals` : ""}
        />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <IconFile size={17} />
            <h3>Applications leaderboard</h3>
          </div>
          <LeaderboardTable rows={appLb.slice(0, 6)} withAmount={false} emptyHint="No applications this period." />
        </div>
        <div className="card">
          <div className="card-head">
            <IconWallet size={17} />
            <h3>Disbursals leaderboard</h3>
          </div>
          <LeaderboardTable rows={disLb.slice(0, 6)} withAmount emptyHint="No disbursals this period." />
        </div>
      </div>

      <div className="meta-row">
        {appMeta && (
          <div className="meta-chip">
            <IconCheck size={13} /> APP file: {appMeta.fileName} · {appMeta.rows} rows · uploaded{" "}
            {new Date(appMeta.uploadedAt).toLocaleString()}
          </div>
        )}
        {disMeta && (
          <div className="meta-chip">
            <IconCheck size={13} /> Dis file: {disMeta.fileName} · {disMeta.rows} rows · uploaded{" "}
            {new Date(disMeta.uploadedAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Dataset tab (admin) --------------------------- */

function DatasetTab({ title, subtitle, icon, records, month, withAmount, showStatus, emptyHint }) {
  const rows = useMemo(() => leaderboard(records, month, withAmount), [records, month, withAmount]);
  const statuses = useMemo(
    () => (showStatus ? statusBreakdown(records, month) : []),
    [records, month, showStatus]
  );
  const total = rows.reduce((s, r) => s + r.count, 0);

  if (!records.length) {
    return (
      <div className="empty-state large">
        <IconUpload size={28} />
        <div className="empty-title">No data published yet</div>
        <div>{emptyHint}</div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="section-head">
        {icon}
        <div>
          <h3>{title}</h3>
          <div className="section-sub">{subtitle}</div>
        </div>
        <div className="section-total">{total.toLocaleString("en-IN")} total</div>
      </div>

      <div className={showStatus ? "grid-2" : ""}>
        <div className="card">
          <div className="card-head">
            <IconTrophy size={17} />
            <h3>Agent leaderboard</h3>
          </div>
          <LeaderboardTable rows={rows} withAmount={withAmount} emptyHint="No records for this period." />
        </div>
        {showStatus && (
          <div className="card">
            <div className="card-head">
              <IconBars size={17} />
              <h3>Status breakdown</h3>
            </div>
            <StatusList entries={statuses} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatusList({ entries }) {
  if (!entries.length) return <div className="empty-state">No records for this period.</div>;
  const max = Math.max(...entries.map((e) => e[1]));
  return (
    <div className="status-list">
      {entries.map(([status, count]) => (
        <div className="status-row" key={status}>
          <div className="status-name">{status}</div>
          <div className="status-track">
            <div
              className="status-fill"
              style={{
                width: `${Math.max(4, (count / max) * 100)}%`,
                background: status === "11. Disbursed" ? "#0B4F4A" : /Reject|Cancel/.test(status) ? "#C0392B" : "#C9932B",
              }}
            />
          </div>
          <div className="status-count">{count}</div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------- Upload (admin) --------------------------- */

function UploadTab({ appMeta, disMeta, onUploaded }) {
  return (
    <div className="stack">
      <div className="card publish-note">
        <IconAlert size={16} />
        <div>
          This site is static (GitHub Pages), so uploads here only preview in <b>this browser</b>.
          To publish for everyone, download the JSON files below, replace the matching files in{" "}
          <code>/data</code> in your repo, then commit &amp; push. Pages redeploys automatically in about a minute.
        </div>
      </div>
      <UploadCard
        title="Applications file (APP)"
        description="Expects columns including Name, applied_date, current_status, number. Publishes to data/app-data.json."
        meta={appMeta}
        expectedKey="applied_date"
        transform={toAppRecords}
        previewKey="preview-app-records"
        previewMetaKey="preview-app-meta"
        downloadName="app-data.json"
        onSaved={onUploaded}
      />
      <UploadCard
        title="Disbursals file (Dis)"
        description="Expects columns including Name, disbursal_date, disbursed_amt, number. Publishes to data/dis-data.json."
        meta={disMeta}
        expectedKey="disbursal_date"
        transform={toDisRecords}
        previewKey="preview-dis-records"
        previewMetaKey="preview-dis-meta"
        downloadName="dis-data.json"
        onSaved={onUploaded}
      />
    </div>
  );
}

function UploadCard({ title, description, meta, expectedKey, transform, previewKey, previewMetaKey, downloadName, onSaved }) {
  const [status, setStatus] = useState("idle"); // idle | working | done | error
  const [message, setMessage] = useState("");
  const [lastRecords, setLastRecords] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setStatus("working");
    setMessage("Reading workbook…");
    try {
      const rows = await parseWorkbook(file);
      if (!rows.length || !(expectedKey in rows[0])) {
        setStatus("error");
        setMessage(`This file doesn't look right — missing "${expectedKey}" column.`);
        return;
      }
      const records = transform(rows);
      if (!records.length) {
        setStatus("error");
        setMessage("No usable rows found in this file.");
        return;
      }
      const metaObj = { fileName: file.name, uploadedAt: new Date().toISOString(), rows: records.length };
      localStorage.setItem(previewKey, JSON.stringify(records));
      localStorage.setItem(previewMetaKey, JSON.stringify(metaObj));
      setLastRecords(records);
      setStatus("done");
      setMessage(`Parsed ${records.length} rows — previewing in this browser only.`);
      onSaved();
    } catch (err) {
      setStatus("error");
      setMessage("Couldn't read that file. Make sure it's a valid .xlsx export.");
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <IconUpload size={17} />
        <h3>{title}</h3>
      </div>
      <p className="upload-desc">{description}</p>
      {meta && (
        <div className="meta-chip">
          <IconCheck size={13} /> Current: {meta.fileName} · {meta.rows} rows · uploaded{" "}
          {new Date(meta.uploadedAt).toLocaleString()}
        </div>
      )}
      <label className="upload-drop">
        <IconUpload size={20} />
        <span>{status === "working" ? "Processing…" : "Click to choose an .xlsx file"}</span>
        <input type="file" accept=".xlsx,.xls" onChange={handleFile} disabled={status === "working"} />
      </label>
      {message && (
        <div className={"upload-msg " + (status === "error" ? "error" : status === "done" ? "success" : "")}>
          {status === "error" ? <IconAlert size={14} /> : <IconCheck size={14} />}
          {message}
        </div>
      )}
      {lastRecords && (
        <button className="btn-secondary" onClick={() => downloadJSON(downloadName, lastRecords)}>
          Download {downloadName}
        </button>
      )}
    </div>
  );
}

/* --------------------------- Sales view --------------------------- */

function SalesTab({ appRecords, disRecords, month, dataset, setDataset }) {
  const records = dataset === "app" ? appRecords : disRecords;
  const rows = useMemo(() => leaderboard(records, month, false), [records, month]);
  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <div className="stack">
      <div className="section-head">
        <IconTrophy size={18} />
        <div>
          <h3>Agent leaderboard</h3>
          <div className="section-sub">Counts grouped by agent for the selected month</div>
        </div>
        <div className="section-total">{total.toLocaleString("en-IN")} total</div>
      </div>

      <div className="toggle-row">
        <button
          className={"toggle-btn" + (dataset === "app" ? " active" : "")}
          onClick={() => setDataset("app")}
        >
          Applications <span className="toggle-sub">by applied date</span>
        </button>
        <button
          className={"toggle-btn" + (dataset === "dis" ? " active" : "")}
          onClick={() => setDataset("dis")}
        >
          Disbursals <span className="toggle-sub">by disbursal date</span>
        </button>
      </div>

      <div className="card">
        <LeaderboardTable
          rows={rows}
          withAmount={false}
          emptyHint="No data available for this period yet."
        />
      </div>
    </div>
  );
}

/* --------------------------- mount --------------------------- */

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
