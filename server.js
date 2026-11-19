const express = require("express");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, "garda.db"));
db.exec(`
CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, signal TEXT, rw TEXT, due TEXT, status TEXT DEFAULT 'Baru');
CREATE TABLE IF NOT EXISTS visits(id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT, v1 TEXT, v2 TEXT, checklist TEXT, photos INTEGER, gps INTEGER, note TEXT, uploaded INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS referrals(id INTEGER PRIMARY KEY AUTOINCREMENT, visit_id INTEGER, services TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS complaints(id INTEGER PRIMARY KEY AUTOINCREMENT, kecamatan TEXT, jenis TEXT, status TEXT DEFAULT 'Diproses', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);

function seed() {
  const t = db.prepare("INSERT INTO tasks(id,signal,rw,due,status) VALUES(?,?,?,?,?)");
  [["012", "Sanggah masuk", "RW 03", "2 hari", "Baru"], ["013", "Lonjakan desil", "RW 05", "5 hari", "Dijadwalkan"], ["014", "Belum berdesil", "RW 01", "7 hari", "Baru"]].forEach(r => t.run(...r));
  const c = db.prepare("INSERT INTO complaints(kecamatan,jenis,status) VALUES(?,?,?)");
  [["Kec. B", "Dugaan pungutan oleh verifikator", "Ditindak"], ["Kec. D", "Kunjungan terlambat dari jadwal", "Selesai"], ["Kec. A", "Salah catat alamat pada formulir", "Diproses"]].forEach(r => c.run(...r));
}
if (db.prepare("SELECT COUNT(*) n FROM tasks").get().n === 0) seed();

const app = express();
app.use(express.json({ limit: "50kb" }));
app.use(express.static(path.join(__dirname, "public")));
const rw = s => (String(s).match(/RW \d+/) || [""])[0];
const count = (sql) => db.prepare(sql).get().n;

app.get("/api/tasks", (_req, res) => res.json(db.prepare("SELECT * FROM tasks ORDER BY id").all()));

// Verifikasi berpasangan: aturan yang sama dengan mockup (RW berbeda, >=3 butir, >=1 foto, koordinat).
app.post("/api/visits", (req, res) => {
  const { task_id, v1, v2, checklist = [], photos = 0, gps = false, note = "" } = req.body || {};
  const task = db.prepare("SELECT * FROM tasks WHERE id=?").get(String(task_id));
  if (!task) return res.status(404).json({ error: "Tugas tidak ditemukan" });
  if (!rw(v1) || !rw(v2) || rw(v1) === rw(v2)) return res.status(400).json({ error: "Dua verifikator harus dari RW berbeda" });
  if (checklist.filter(Boolean).length < 3) return res.status(400).json({ error: "Minimal 3 butir daftar periksa" });
  if (photos < 1 || !gps) return res.status(400).json({ error: "Foto dan koordinat wajib" });
  const r = db.prepare("INSERT INTO visits(task_id,v1,v2,checklist,photos,gps,note) VALUES(?,?,?,?,?,?,?)")
    .run(task.id, v1, v2, JSON.stringify(checklist), photos, 1, String(note).slice(0, 500));
  db.prepare("UPDATE tasks SET status='Terverifikasi' WHERE id=?").run(task.id);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

// Unggah ke operator desa. Garda tidak menetapkan desil; penetapan tetap oleh BPS.
app.post("/api/visits/:id/upload", (req, res) => {
  const v = db.prepare("SELECT * FROM visits WHERE id=?").get(Number(req.params.id));
  if (!v) return res.status(404).json({ error: "Kunjungan tidak ditemukan" });
  db.prepare("UPDATE visits SET uploaded=1 WHERE id=?").run(v.id);
  db.prepare("UPDATE tasks SET status='Terkirim' WHERE id=?").run(v.task_id);
  res.json({ ok: true, note: "Menunggu penetapan desil oleh BPS" });
});

app.post("/api/referrals", (req, res) => {
  const { visit_id, services = [] } = req.body || {};
  if (!db.prepare("SELECT id FROM visits WHERE id=?").get(Number(visit_id))) return res.status(404).json({ error: "Kunjungan tidak ditemukan" });
  db.prepare("INSERT INTO referrals(visit_id,services) VALUES(?,?)").run(Number(visit_id), JSON.stringify(services));
  res.status(201).json({ ok: true });
});

app.get("/api/complaints", (_req, res) => res.json(db.prepare("SELECT id,kecamatan,jenis,status FROM complaints ORDER BY id DESC").all()));
app.post("/api/complaints", (req, res) => {
  const { kecamatan, jenis } = req.body || {};
  if (!kecamatan || !jenis) return res.status(400).json({ error: "Kecamatan dan jenis keluhan wajib" });
  db.prepare("INSERT INTO complaints(kecamatan,jenis) VALUES(?,?)").run(String(kecamatan).slice(0, 40), String(jenis).slice(0, 200));
  res.status(201).json({ ok: true });
});

// Agregat tanpa identitas untuk dasbor publik.
app.get("/api/stats", (_req, res) => res.json({
  tasks: count("SELECT COUNT(*) n FROM tasks"),
  verified: count("SELECT COUNT(*) n FROM tasks WHERE status IN ('Terverifikasi','Terkirim')"),
  uploaded: count("SELECT COUNT(*) n FROM visits WHERE uploaded=1"),
  referrals: count("SELECT COUNT(*) n FROM referrals"),
  complaints: count("SELECT COUNT(*) n FROM complaints"),
  byStatus: db.prepare("SELECT status, COUNT(*) n FROM tasks GROUP BY status").all(),
}));

if (process.env.NODE_ENV !== "production") {
  app.post("/api/demo/reset", (_req, res) => {
    db.exec("DELETE FROM referrals; DELETE FROM visits; DELETE FROM tasks; DELETE FROM complaints;");
    seed(); res.json({ ok: true });
  });
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Garda Data Muda berjalan di http://localhost:${port}`));
