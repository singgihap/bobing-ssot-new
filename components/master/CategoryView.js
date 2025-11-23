"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch } from "firebase/firestore";

export default function CategoryView() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({});
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const q = query(collection(db, "categories"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setCategories(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openModal = (cat = null) => {
    if (cat) setFormData({ ...cat });
    else setFormData({ name: "" });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { name: formData.name, updated_at: serverTimestamp() };
      if (formData.id) await updateDoc(doc(db, "categories", formData.id), payload);
      else { payload.created_at = serverTimestamp(); await addDoc(collection(db, "categories"), payload); }
      setModalOpen(false); fetchData();
    } catch (err) { alert(err.message); }
  };

  const deleteCategory = async (id) => {
    if (confirm("Hapus kategori ini?")) { await deleteDoc(doc(db, "categories", id)); fetchData(); }
  };

  // Sync from products (optional ERP utility, bisa skip kalau tidak perlu)
  const syncFromProducts = async () => {
    setSyncing(true);
    try {
      const pSnap = await getDocs(collection(db, "products"));
      const uniqueNames = new Set();
      pSnap.forEach(d => {
        const cat = d.data().category;
        if (cat) uniqueNames.add(cat.trim());
      });
      const existingNames = new Set(categories.map(c => c.name));
      const batch = writeBatch(db);
      let count = 0;
      uniqueNames.forEach(name => {
        if (!existingNames.has(name)) {
          batch.set(doc(collection(db, "categories")), { name, created_at: serverTimestamp() });
          count++;
        }
      });
      if (count) await batch.commit();
      fetchData(); alert(count ? `${count} kategori disinkronisasi.` : "Tidak ada kategori baru.");
    } catch (e) { alert("Gagal sync: " + e.message); }
    finally { setSyncing(false); }
  };

  return (
    <div className="max-w-2xl mx-auto fade-in pb-20">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black text-brand-800 tracking-tight">Kategori</h2>
          <p className="text-base text-brand-400 mt-1">Kelola kategori produk untuk katalog dan filtering.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openModal()} className="btn-primary whitespace-nowrap">Tambah Kategori</button>
          <button onClick={syncFromProducts} className="btn-ghost" disabled={syncing}>{syncing ? "Syncing..." : "Sync Produk"}</button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        <div className="table-wrapper">
          <table className="table-modern w-full text-sm">
            <thead>
              <tr>
                <th className="pl-6 text-left">Nama Kategori</th>
                <th className="text-right pr-6">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={2} className="py-10 text-center text-brand-200 font-mono animate-pulse">Memuat data…</td></tr>
                : categories.length === 0
                  ? <tr><td colSpan={2} className="py-14 text-center text-brand-200">Belum ada kategori.</td></tr>
                  : categories.map(c => (
                    <tr key={c.id} className="group hover:bg-brand-50/40 rounded-xl transition">
                      <td className="pl-6 font-bold text-brand-700">{c.name}</td>
                      <td className="text-right pr-6">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openModal(c)} className="btn-ghost">Edit</button>
                          <button onClick={() => deleteCategory(c.id)} className="btn-ghost text-red-600 border-red-200 hover:bg-red-50">Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-lg p-4">
          <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl border border-brand-100 max-w-md w-full px-7 py-8 fade-in-up overflow-y-auto max-h-[95vh]">
            <h3 className="text-2xl font-bold text-brand-700 mb-6">{formData.id ? "Edit Kategori" : "Tambah Kategori"}</h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-brand-700 mb-2">Nama Kategori</label>
                <input required className="input-modern" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="flex justify-end gap-4 pt-5 border-t border-brand-100 mt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost">Batal</button>
                <button type="submit" className="btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
