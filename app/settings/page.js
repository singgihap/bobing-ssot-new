"use client";
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

// Konfigurasi Cache (Optimized)
const CACHE_KEY = 'lumina_settings_v2';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 Jam (Data setting sangat jarang berubah)

export default function SettingsPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('store');
    const [loading, setLoading] = useState(false);

    // State untuk Data Settings (Default Values)
    const [storeProfile, setStoreProfile] = useState({
        name: 'Bobing Store',
        address: 'Jl. Raya No. 123, Jakarta',
        phone: '0812-3456-7890',
        footerMsg: 'Terima kasih telah berbelanja. Barang tidak dapat ditukar.'
    });

    const [posConfig, setPosConfig] = useState({
        paperSize: '58mm', // 58mm or 80mm
        enableTax: false,
        taxRate: 11,
        autoPrint: true
    });

    // Load Settings (Optimized)
    useEffect(() => {
        const fetchSettings = async () => {
            // 1. Cek Cache LocalStorage (Hemat Biaya)
            if (typeof window !== 'undefined') {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    try {
                        const { storeProfile: cStore, posConfig: cPos, timestamp } = JSON.parse(cached);
                        if (Date.now() - timestamp < CACHE_DURATION) {
                            if(cStore) setStoreProfile(cStore);
                            if(cPos) setPosConfig(cPos);
                            return; // Skip Read ke Firestore
                        }
                    } catch(e) {}
                }
            }

            // 2. Fetch Firestore (Hanya jika cache expired/kosong)
            try {
                const docRef = doc(db, "settings", "general");
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const newStore = data.storeProfile || storeProfile;
                    const newPos = data.posConfig || posConfig;

                    setStoreProfile(newStore);
                    setPosConfig(newPos);

                    // Update Cache
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(CACHE_KEY, JSON.stringify({
                            storeProfile: newStore,
                            posConfig: newPos,
                            timestamp: Date.now()
                        }));
                    }
                }
            } catch (e) {
                console.error("Gagal memuat pengaturan:", e);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setLoading(true);
        const toastId = toast.loading("Menyimpan pengaturan...");
        try {
            // Simpan ke Firestore (Merge true agar tidak menimpa field lain jika ada)
            await setDoc(doc(db, "settings", "general"), { 
                storeProfile, 
                posConfig, 
                updated_at: serverTimestamp(),
                updated_by: user?.email
            }, { merge: true });

            // Update Cache Lokal Langsung (Optimistic Update)
            if (typeof window !== 'undefined') {
                localStorage.setItem(CACHE_KEY, JSON.stringify({ 
                    storeProfile, 
                    posConfig,
                    timestamp: Date.now() 
                }));
            }

            toast.success("Pengaturan berhasil disimpan!", { id: toastId });
        } catch (e) {
            console.error(e);
            toast.error(`Gagal: ${e.message}`, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    // --- COMPONENTS ---
    const TabButton = ({ id, label, icon }) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
                activeTab === id 
                ? 'bg-lumina-gold/10 text-lumina-gold border border-lumina-gold/20 shadow-gold-glow' 
                : 'text-lumina-muted hover:text-white hover:bg-lumina-highlight'
            }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-6 fade-in pb-20">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-display font-bold text-lumina-text">Settings</h2>
                    <p className="text-sm text-lumina-muted mt-1">Konfigurasi sistem dan profil toko.</p>
                </div>
                <button onClick={handleSave} className="btn-gold w-32" disabled={loading}>
                    {loading ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* SIDEBAR TABS */}
                <div className="col-span-1 space-y-2">
                    <TabButton 
                        id="store" 
                        label="Profil Toko" 
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>} 
                    />
                    <TabButton 
                        id="pos" 
                        label="Konfigurasi POS" 
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>} 
                    />
                    <TabButton 
                        id="account" 
                        label="Akun & Keamanan" 
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>} 
                    />
                    <TabButton 
                        id="system" 
                        label="System & Data" 
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>} 
                    />
                </div>

                {/* CONTENT AREA */}
                <div className="col-span-1 md:col-span-3">
                    
                    {/* TAB 1: STORE PROFILE */}
                    {activeTab === 'store' && (
                        <div className="card-luxury p-6 space-y-6 fade-in">
                            <h3 className="text-lg font-bold text-white border-b border-lumina-border pb-4">Identitas Toko (Header Struk)</h3>
                            <div className="grid grid-cols-1 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-lumina-muted uppercase mb-2">Nama Toko</label>
                                    <input className="input-luxury" value={storeProfile.name} onChange={e => setStoreProfile({...storeProfile, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-lumina-muted uppercase mb-2">Alamat Lengkap</label>
                                    <textarea rows="3" className="input-luxury" value={storeProfile.address} onChange={e => setStoreProfile({...storeProfile, address: e.target.value})} />
                                    <p className="text-[10px] text-lumina-muted mt-1">Akan muncul di bagian atas struk.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-lumina-muted uppercase mb-2">Nomor Telepon / WA</label>
                                    <input className="input-luxury" value={storeProfile.phone} onChange={e => setStoreProfile({...storeProfile, phone: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-lumina-muted uppercase mb-2">Pesan Footer Struk</label>
                                    <input className="input-luxury" value={storeProfile.footerMsg} onChange={e => setStoreProfile({...storeProfile, footerMsg: e.target.value})} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: POS CONFIG */}
                    {activeTab === 'pos' && (
                        <div className="card-luxury p-6 space-y-6 fade-in">
                            <h3 className="text-lg font-bold text-white border-b border-lumina-border pb-4">Konfigurasi Kasir</h3>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between bg-lumina-base p-4 rounded-xl border border-lumina-border">
                                    <div>
                                        <div className="text-sm font-bold text-white">Ukuran Kertas Printer</div>
                                        <div className="text-xs text-lumina-muted">Sesuaikan dengan printer thermal Anda.</div>
                                    </div>
                                    <select className="input-luxury w-32" value={posConfig.paperSize} onChange={e => setPosConfig({...posConfig, paperSize: e.target.value})}>
                                        <option value="58mm">58mm (Small)</option>
                                        <option value="80mm">80mm (Standard)</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-between bg-lumina-base p-4 rounded-xl border border-lumina-border">
                                    <div>
                                        <div className="text-sm font-bold text-white">Aktifkan PPN (Tax)</div>
                                        <div className="text-xs text-lumina-muted">Hitung pajak otomatis saat checkout.</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="checkbox" 
                                            className="w-5 h-5 accent-lumina-gold bg-lumina-surface border-lumina-border rounded"
                                            checked={posConfig.enableTax}
                                            onChange={e => setPosConfig({...posConfig, enableTax: e.target.checked})}
                                        />
                                        {posConfig.enableTax && (
                                            <div className="flex items-center gap-1">
                                                <input type="number" className="input-luxury w-16 py-1 px-2 text-center" value={posConfig.taxRate} onChange={e => setPosConfig({...posConfig, taxRate: e.target.value})} />
                                                <span className="text-lumina-muted">%</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between bg-lumina-base p-4 rounded-xl border border-lumina-border">
                                    <div>
                                        <div className="text-sm font-bold text-white">Auto Print Struk</div>
                                        <div className="text-xs text-lumina-muted">Otomatis buka dialog print setelah bayar.</div>
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 accent-lumina-gold bg-lumina-surface border-lumina-border rounded"
                                        checked={posConfig.autoPrint}
                                        onChange={e => setPosConfig({...posConfig, autoPrint: e.target.checked})}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: ACCOUNT */}
                    {activeTab === 'account' && (
                        <div className="card-luxury p-6 space-y-6 fade-in">
                            <h3 className="text-lg font-bold text-white border-b border-lumina-border pb-4">Akun Admin</h3>
                            
                            <div className="flex items-center gap-4 p-4 bg-lumina-base rounded-xl border border-lumina-border">
                                <div className="w-16 h-16 bg-lumina-gold rounded-full flex items-center justify-center text-black font-bold text-2xl shadow-gold-glow">
                                    {user?.email?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-white font-bold">{user?.email}</p>
                                    <p className="text-xs text-lumina-muted">Super Administrator</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-lumina-muted uppercase mb-2">Ganti Password Baru</label>
                                    <input type="password" className="input-luxury" placeholder="••••••••" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-lumina-muted uppercase mb-2">Konfirmasi Password</label>
                                    <input type="password" className="input-luxury" placeholder="••••••••" />
                                </div>
                                <button className="btn-ghost-dark w-full">Update Password</button>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: SYSTEM */}
                    {activeTab === 'system' && (
                        <div className="card-luxury p-6 space-y-6 fade-in border-rose-900/30">
                            <h3 className="text-lg font-bold text-white border-b border-lumina-border pb-4">System & Data Management</h3>
                            
                            <div className="p-4 rounded-xl bg-emerald-900/10 border border-emerald-500/20">
                                <h4 className="text-emerald-400 font-bold text-sm mb-1">Backup Data</h4>
                                <p className="text-xs text-lumina-muted mb-3">Download seluruh data transaksi & produk ke file JSON.</p>
                                <button className="btn-ghost-dark text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500">Download Backup</button>
                            </div>

                            <div className="p-4 rounded-xl bg-rose-900/10 border border-rose-500/20">
                                <h4 className="text-rose-400 font-bold text-sm mb-1">Danger Zone</h4>
                                <p className="text-xs text-lumina-muted mb-3">Hapus seluruh data transaksi (Reset Pabrik). Tindakan ini tidak bisa dibatalkan.</p>
                                <button className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 shadow-lg shadow-rose-900/20">Reset All Data</button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}