/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

// Trigger: Berjalan setiap kali dokumen di 'stock_snapshots' dibuat, diupdate, atau dihapus
exports.aggregateInventoryStats = onDocumentWritten("stock_snapshots/{docId}", async (event) => {
    const before = event.data.before.exists ? event.data.before.data() : null;
    const after = event.data.after.exists ? event.data.after.data() : null;

    // Tidak ada perubahan qty, skip
    if (before && after && before.qty === after.qty) return;

    const variantId = after ? after.variant_id : before.variant_id;
    
    // Hitung selisih Qty
    const oldQty = before ? (before.qty || 0) : 0;
    const newQty = after ? (after.qty || 0) : 0;
    const qtyDiff = newQty - oldQty;

    if (qtyDiff === 0) return;

    try {
        // Kita butuh harga modal (cost) dari variant untuk hitung nilai aset
        const variantSnap = await db.collection("product_variants").doc(variantId).get();
        
        let cost = 0;
        if (variantSnap.exists) {
            cost = variantSnap.data().cost || 0;
        }

        const valueDiff = qtyDiff * cost;

        // Update dokumen agregasi 'stats_inventory/general' secara atomic
        const statsRef = db.collection("stats_inventory").doc("general");

        await statsRef.set({
            total_qty: FieldValue.increment(qtyDiff),
            total_value: FieldValue.increment(valueDiff),
            last_updated: FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`Updated stats: Qty ${qtyDiff}, Value ${valueDiff}`);

    } catch (error) {
        console.error("Failed to aggregate inventory:", error);
    }
});