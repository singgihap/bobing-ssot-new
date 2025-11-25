"use client";
import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, getDocs, collection } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import Skeleton from '@/components/Skeleton'; // Import Skeleton

// Konfigurasi Cache
const CACHE_KEY = 'lumina_settings_v2';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

export default function SettingsPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('store');
    const [loading, setLoading] = useState(true); // Default loading true agar skeleton muncul
    const [saving, setSaving] = useState(false);

    // State Default
    const [storeProfile, setStoreProfile] = useState({
        name: '',
        address: '',
        phone: '',
        footerMsg: ''
    });

    const [posConfig, setPosConfig] = useState({
        paperSize: '58mm',
        enableTax: false,
        taxRate: 11,
        autoPrint: true
    });

    // Load Settings
    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            // 1. Cek Cache LocalStorage
            if (typeof window !== 'undefined') {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    try {
                        const { storeProfile: cStore, posConfig: cPos, timestamp } = JSON.parse(cached);
                        if (Date.now() - timestamp < CACHE_DURATION) {
                            if(cStore) setStoreProfile(cStore);
                            if(cPos) setPosConfig(cPos);
                            setLoading(false);
                            return;
                        }
                    } catch(e) {}
                }
            }

            // 2. Fetch Firestore
            try {
                const docRef = doc(db, "settings", "general");
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setStoreProfile(data.storeProfile || storeProfile);
                    setPosConfig(data.posConfig || posConfig);

                    // Update Cache
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(CACHE_KEY, JSON.stringify({
                            storeProfile: data.storeProfile,
                            posConfig: data.posConfig,
                            timestamp: Date.now()
                        }));
                    }
                }
            } catch (e) {
                console.error("Gagal memuat pengaturan:", e);
                toast.error("Gagal memuat data");
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        const toastId = toast.loading("Menyimpan pengaturan...");
        try {
            await setDoc(doc(db, "settings", "general"), { 
                storeProfile, 
                posConfig, 
                updated_at: serverTimestamp(),
                updated_by: user?.email
            }, { merge: true });

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
            setSaving(false);
        }
    };

    const handleRecalculateInventory = async () => {
        if(!confirm("Hitung ulang total aset? Ini akan membaca semua data stok (Heavy Operation).")) return;
        
        const tId = toast.loading("Menghitung ulang total aset...");
        try {
            const varSnap = await getDocs(collection(db, "product_variants"));
            const costMap = {};
            varSnap.forEach(d => { costMap[d.id] = d.data().cost || 0; });

            const stockSnap = await getDocs(collection(db, "stock_snapshots"));
            let totalQty = 0;
            let totalValue = 0;

            stockSnap.forEach(d => {
                const s = d.data();
                const qty = s.qty || 0;
                const cost = costMap[s.variant_id] || 0;
                totalQty += qty;
                totalValue += (qty * cost);
            });

            await setDoc(doc(db, "stats_inventory", "general"), {
                total_qty: totalQty,
                total_value: totalValue,
                last_calculated: serverTimestamp(),
                updated_by: user?.email
            });

            toast.success(`Selesai! Total Qty: ${totalQty}, Value: ${totalValue}`, { id: tId });
            localStorage.removeItem('lumina_dash_master_v3');
        } catch (e) {
            toast.error("Gagal: " + e.message, { id: tId });
        }
    };

    // --- COMPONENTS ---
    const TabButton = ({ id, label, icon, description }) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-start gap-4 p-4 rounded-xl transition-all duration-300 text-left border ${
                activeTab === id 
                ? 'bg-lumina-highlight/80 border-lumina-gold/50 shadow-[0_0_15px_rgba(212,175,55,0.1)]' 
                : 'bg-transparent border-transparent hover:bg-grey/5 hover:border-grey/10'
            }`}
        >
            <div className={`p-2 rounded-lg ${activeTab === id ? 'bg-lumina-gold text-black' : 'bg-grey/10 text-lumina-muted'}`}>
                {icon}
            </div>
            <div>
                <span className={`block text-sm font-bold ${activeTab === id ? 'text-lumina-text' : 'text-lumina-text'}`}>{label}</span>
                <span className="text-[10px] text-lumina-muted line-clamp-1">{description}</span>
            </div>
        </button>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-lumina-border/50 pb-6">
                <div>
                    <h2 className="text-3xl font-display font-bold text-lumina-text tracking-tight">Settings</h2>
                    <p className="text-sm text-lumina-muted mt-1 font-light">Manage your store preferences and system configuration.</p>
                </div>
                <button onClick={handleSave} className="btn-gold w-full md:w-auto min-w-[140px]" disabled={saving || loading}>
                    {saving ? (
                        <div className="flex items-center gap-2">
                             <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                             Saving...
                        </div>
                    ) : 'Save Changes'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* SIDEBAR */}
                <div className="col-span-1 space-y-2">
                    <TabButton 
                        id="store" 
                        label="Store Profile" 
                        description="Address, Phone, Receipt Header"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>} 
                    />
                    <TabButton 
                        id="pos" 
                        label="POS Config" 
                        description="Printer, Tax, Auto-print"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>} 
                    />
                    <TabButton 
                        id="account" 
                        label="Account" 
                        description="Profile & Security"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>} 
                    />
                    <TabButton 
                        id="system" 
                        label="System & Data" 
                        description="Backup, Reset, Recalculate"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>} 
                    />
                </div>

                {/* CONTENT AREA */}
                <div className="col-span-1 lg:col-span-3">
                    <div className="card-luxury p-8 min-h-[500px]">
                        
                        {/* TAB 1: STORE PROFILE */}
                        {activeTab === 'store' && (
                            <div className="space-y-8 animate-fade-in">
                                <div>
                                    <h3 className="text-lg font-bold text-lumina-text">Store Identity</h3>
                                    <p className="text-xs text-lumina-muted mt-1">Information that appears on your receipts.</p>
                                </div>
                                <div className="grid grid-cols-1 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-lumina-muted uppercase tracking-wider">Store Name</label>
                                        {loading ? <Skeleton className="h-12 w-full" /> : (
                                            <input className="input-luxury" value={storeProfile.name} onChange={e => setStoreProfile({...storeProfile, name: e.target.value})} placeholder="e.g. Bobing Store" />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-lumina-muted uppercase tracking-wider">Full Address</label>
                                        {loading ? <Skeleton className="h-24 w-full" /> : (
                                            <textarea rows="3" className="input-luxury" value={storeProfile.address} onChange={e => setStoreProfile({...storeProfile, address: e.target.value})} placeholder="Complete store address..." />
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-lumina-muted uppercase tracking-wider">Phone / WhatsApp</label>
                                            {loading ? <Skeleton className="h-12 w-full" /> : (
                                                <input className="input-luxury" value={storeProfile.phone} onChange={e => setStoreProfile({...storeProfile, phone: e.target.value})} placeholder="08..." />
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-lumina-muted uppercase tracking-wider">Receipt Footer Message</label>
                                            {loading ? <Skeleton className="h-12 w-full" /> : (
                                                <input className="input-luxury" value={storeProfile.footerMsg} onChange={e => setStoreProfile({...storeProfile, footerMsg: e.target.value})} placeholder="e.g. No Refund / Exchange" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: POS CONFIG */}
                        {activeTab === 'pos' && (
                            <div className="space-y-8 animate-fade-in">
                                <div>
                                    <h3 className="text-lg font-bold text-lumina-text">POS Configuration</h3>
                                    <p className="text-xs text-lumina-muted mt-1">Tailor the checkout experience.</p>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between bg-lumina-surface/20 p-4 rounded-xl border border-lumina-border/30">
                                        <div>
                                            <div className="text-sm font-bold text-lumina-text">Receipt Paper Size</div>
                                            <div className="text-xs text-lumina-muted mt-0.5">Match your thermal printer width.</div>
                                        </div>
                                        {loading ? <Skeleton className="h-10 w-32" /> : (
                                            <select className="input-luxury w-32 py-2" value={posConfig.paperSize} onChange={e => setPosConfig({...posConfig, paperSize: e.target.value})}>
                                                <option value="58mm">58mm (Small)</option>
                                                <option value="80mm">80mm (Large)</option>
                                            </select>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between bg-lumina-surface/20 p-4 rounded-xl border border-lumina-border/30">
                                        <div>
                                            <div className="text-sm font-bold text-lumina-text">Enable Tax (PPN)</div>
                                            <div className="text-xs text-lumina-muted mt-0.5">Automatically calculate tax at checkout.</div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {loading ? <Skeleton className="h-6 w-12" /> : (
                                                <>
                                                    {posConfig.enableTax && (
                                                        <div className="flex items-center bg-lumina-surface rounded-lg border border-lumina-border overflow-hidden">
                                                            <input type="number" className="bg-transparent w-12 py-1 px-2 text-center text-sm text-lumina-text outline-none" value={posConfig.taxRate} onChange={e => setPosConfig({...posConfig, taxRate: e.target.value})} />
                                                            <span className="text-xs text-lumina-muted pr-2">%</span>
                                                        </div>
                                                    )}
                                                    <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                                        <input type="checkbox" name="toggle" id="tax-toggle" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-300" checked={posConfig.enableTax} onChange={e => setPosConfig({...posConfig, enableTax: e.target.checked})} style={{ right: posConfig.enableTax ? '0' : 'auto', left: posConfig.enableTax ? 'auto' : '0', borderColor: posConfig.enableTax ? '#D4AF37' : '#2A2E3B' }}/>
                                                        <label htmlFor="tax-toggle" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${posConfig.enableTax ? 'bg-lumina-gold' : 'bg-gray-700'}`}></label>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between bg-lumina-surface/20 p-4 rounded-xl border border-lumina-border/30">
                                        <div>
                                            <div className="text-sm font-bold text-lumina-text">Auto-Print Receipt</div>
                                            <div className="text-xs text-lumina-muted mt-0.5">Open print dialog immediately after payment.</div>
                                        </div>
                                        {loading ? <Skeleton className="h-6 w-12" /> : (
                                            <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                                <input type="checkbox" name="toggle" id="print-toggle" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-300" checked={posConfig.autoPrint} onChange={e => setPosConfig({...posConfig, autoPrint: e.target.checked})} style={{ right: posConfig.autoPrint ? '0' : 'auto', left: posConfig.autoPrint ? 'auto' : '0', borderColor: posConfig.autoPrint ? '#D4AF37' : '#2A2E3B' }}/>
                                                <label htmlFor="print-toggle" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${posConfig.autoPrint ? 'bg-lumina-gold' : 'bg-gray-700'}`}></label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: ACCOUNT */}
                        {activeTab === 'account' && (
                            <div className="space-y-8 animate-fade-in">
                                <div>
                                    <h3 className="text-lg font-bold text-lumina-text">Admin Account</h3>
                                    <p className="text-xs text-lumina-muted mt-1">Security settings for current session.</p>
                                </div>
                                
                                <div className="flex items-center gap-5 p-6 bg-gradient-to-r from-lumina-gold/10 to-transparent rounded-2xl border border-lumina-gold/20">
                                    <div className="w-20 h-20 bg-lumina-gold rounded-full flex items-center justify-center text-black font-bold text-3xl shadow-gold-glow">
                                        {user?.email?.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-lumina-text">{user?.email}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="badge-luxury badge-success bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Super Admin</span>
                                            <span className="text-xs text-lumina-muted">Last login: Today</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="max-w-md space-y-4 pt-4">
                                    <h4 className="text-sm font-bold text-lumina-text uppercase tracking-wider">Change Password</h4>
                                    <div>
                                        <input type="password" className="input-luxury" placeholder="New Password" />
                                    </div>
                                    <div>
                                        <input type="password" className="input-luxury" placeholder="Confirm New Password" />
                                    </div>
                                    <button className="btn-ghost-dark w-full border-grey/10 hover:bg-grey/5">Update Security Credentials</button>
                                </div>
                            </div>
                        )}

                        {/* TAB 4: SYSTEM */}
                        {activeTab === 'system' && (
                            <div className="space-y-8 animate-fade-in">
                                <div>
                                    <h3 className="text-lg font-bold text-lumina-text">System Maintenance</h3>
                                    <p className="text-xs text-lumina-muted mt-1">Manage data integrity and backups.</p>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="p-5 rounded-xl bg-indigo-500/5 border border-indigo-500/20 flex justify-between items-center hover:bg-indigo-500/10 transition-colors">
                                        <div>
                                            <h4 className="text-indigo-400 font-bold text-sm mb-1">Recalculate Inventory Assets</h4>
                                            <p className="text-xs text-lumina-muted max-w-md">
                                                Force recalculation of total inventory value and quantity from all stock snapshots. Use this if dashboard numbers seem out of sync.
                                            </p>
                                        </div>
                                        <button onClick={handleRecalculateInventory} className="px-4 py-2 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 hover:text-lumina-text text-xs font-bold transition-all">
                                            Run Calculation
                                        </button>
                                    </div>

                                    <div className="p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex justify-between items-center hover:bg-emerald-500/10 transition-colors">
                                        <div>
                                            <h4 className="text-emerald-400 font-bold text-sm mb-1">Data Backup</h4>
                                            <p className="text-xs text-lumina-muted max-w-md">
                                                Export all transactions, products, and customer data to a local JSON file for safekeeping.
                                            </p>
                                        </div>
                                        <button className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 hover:text-lumina-text text-xs font-bold transition-all">
                                            Download Backup
                                        </button>
                                    </div>

                                    <div className="p-5 rounded-xl bg-rose-500/5 border border-rose-500/20 flex justify-between items-center hover:bg-rose-500/10 transition-colors mt-8">
                                        <div>
                                            <h4 className="text-rose-400 font-bold text-sm mb-1">Factory Reset</h4>
                                            <p className="text-xs text-lumina-muted max-w-md">
                                                <span className="text-rose-500 font-bold">DANGER ZONE:</span> Permanently delete all transactions and reset stock counts to zero.
                                            </p>
                                        </div>
                                        <button className="px-4 py-2 rounded-lg bg-rose-600 text-lumina-text hover:bg-rose-700 shadow-lg shadow-rose-900/20 text-xs font-bold transition-all">
                                            Reset All Data
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}