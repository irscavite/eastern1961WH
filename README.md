# Equipment Inventory System — v13

Firebase-only desktop inventory system.

## Consumables workflow
- **IN** is only for a brand-new consumable Item Name + Part Number.
- The IN form uses a free-text Item Name and blocks an Item Name + Part Number that already exists.
- **Replenish** is only for existing consumables already in Firebase.
- In Replenish, the first dropdown shows **Item Name — Part Number** (example: `Baldwin Filter — BF7644`).
- After selecting the exact Item + Part Number, the user selects the Equipment Tag and enters the quantity to add.
- **OUT** uses the same **Item Name — Part Number** dropdown so users can verify the exact consumable before releasing stock.
- Duplicate Item Name + Part Number pairs are shown only once; different Part Numbers remain separate options.
- Equipment Tag continues to use Equipment Records, with **All Equipment** first for new-item IN.
- Part Number remains stored separately in Firebase even though it is displayed beside Item Name in Replenish/OUT.
- Existing Firebase transaction history and stock calculations are preserved.
