const {onDocumentWritten} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

exports.aggregateInventoryStats = onDocumentWritten(
    "stock_snapshots/{docId}",
    async (event) => {
      const before = event.data.before.exists ?
            event.data.before.data() : null;
      const after = event.data.after.exists ?
            event.data.after.data() : null;

      if (before && after && before.qty === after.qty) return;

      const variantId = after ? after.variant_id : before.variant_id;

      const oldQty = before ? (before.qty || 0) : 0;
      const newQty = after ? (after.qty || 0) : 0;
      const qtyDiff = newQty - oldQty;

      if (qtyDiff === 0) return;

      try {
        const variantSnap = await db.collection("product_variants")
            .doc(variantId).get();

        let cost = 0;
        if (variantSnap.exists) {
          cost = variantSnap.data().cost || 0;
        }

        const valueDiff = qtyDiff * cost;

        const statsRef = db.collection("stats_inventory").doc("general");

        await statsRef.set({
          total_qty: FieldValue.increment(qtyDiff),
          total_value: FieldValue.increment(valueDiff),
          last_updated: FieldValue.serverTimestamp(),
        }, {merge: true});

        console.log(`Updated stats: Qty ${qtyDiff}, Value ${valueDiff}`);
      } catch (error) {
        console.error("Failed to aggregate inventory:", error);
      }
    },
);
