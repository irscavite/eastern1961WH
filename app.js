(() => {
  "use strict";

  const DB_URL = "https://easternwh-14c32-default-rtdb.asia-southeast1.firebasedatabase.app";

  const PATHS = {
    equipment: "equipmentMasterRecords",
    parts: "heavyEquipmentRecords",
    warehouseParts: "equipmentPartsWarehouse",
    warehousePartMovements: "equipmentPartsWarehouseMovements",
    consumables: "motorpoolConsumables",
    consumableDropdown: "motorpoolConsumableDropdown",
    mtpTools: "mtpToolsEquipment",
    mnrTools: "mnrToolsEquipment"
  };

  const PART_STATUSES = [
    "Pending Approval",
    "Pending for approval",
    "For Canvas",
    "Approved Waiting for Delivery",
    "Ready for Pickup",
    "For Machining / Fabrication",
    "Received Store at Warehouse",
    "Received stored at warehouse",
    "Preparing for installation",
    "Preparing for Installation",
    "Ongoing Repair",
    "Spare Parts",
    "Installed"
  ];

  const EQUIPMENT_STATUSES = [
    "Operational",
    "Ongoing Operational Repair",
    "Ongoing Emergency Repair",
    "Ongoing Rehabilitation",
    "Under Repair/Maintenance",
    "Inactive",
    "Spare Parts"
  ];

  const DEFAULT_PART_NAMES = [
    "Air Filter", "Oil Filter", "Fuel Filter", "Hydraulic Filter", "Fan Belt",
    "Battery", "Tire", "Brake Pad", "Brake Shoe", "Hydraulic Hose", "Bearing",
    "Seal Kit", "Starter", "Alternator", "Radiator", "Water Pump", "Fuel Pump",
    "Injector", "Clutch Assembly", "Other"
  ];

  const DEFAULT_LOCATIONS = ["Bacao", "Enlin", "Batangas", "Yard 2.1"];
  const DEFAULT_UNITS = ["PCS", "PC", "pcs", "pc", "Ltr", "LTR", "Set", "set", "Kg", "KG", "Box", "Roll"];

  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  let state = emptyState();
  let equipmentImageData = "";
  let firebaseReady = false;
  let rawConsumableRecords = {};
  let rawConsumableDropdown = {};

  function emptyState() {
    return { equipment: [], parts: [], warehouseParts: [], warehousePartMovements: [], consumables: [], mtpTools: [], mnrTools: [], activity: [] };
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function uniqueExact(values) {
    const out = [];
    const seen = new Set();
    values.forEach(value => {
      const text = String(value ?? "").trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      out.push(text);
    });
    return out;
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
    return Number.isNaN(d.getTime())
      ? value
      : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? value
      : d.toLocaleString("en-PH", {
          year: "numeric", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit"
        });
  }

  function todayValue() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }

  function dbNowText() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: true
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${map.month}/${map.day}/${map.year}, ${map.hour}:${map.minute} ${map.dayPeriod}`;
  }

  function nowText() {
    return new Date().toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    });
  }

  function dateTimeValue(value) {
    const n = new Date(value || "").getTime();
    return Number.isFinite(n) ? n : 0;
  }

  function logActivity(title, detail) {
    state.activity.unshift({ id: `${Date.now()}-${Math.random()}`, title, detail, time: nowText() });
    state.activity = state.activity.slice(0, 30);
  }

  function toast(message, isError = false) {
    const el = $("toast");
    el.textContent = message;
    el.style.background = isError ? "#b42318" : "#101828";
    el.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove("show"), 3000);
  }

  function badgeClass(status) {
    const s = String(status || "").toLowerCase();
    if (s.includes("operational") || s === "installed" || s.includes("received")) return "good";
    if (s.includes("inactive") || s.includes("under repair") || s.includes("emergency repair")) return "bad";
    if (s.includes("pending") || s.includes("waiting") || s.includes("ongoing") || s.includes("canvas") || s.includes("machining")) return "warn";
    return "info";
  }

  function normalizeEquipmentStatus(status) {
    const raw = String(status || "").trim();
    const s = raw.toLowerCase();
    if (s.includes("ongoing emergency repair")) return "Ongoing Emergency Repair";
    if (s === "operational") return "Operational";
    if (s === "refurbishing" || s.includes("ongoing rehabilitation")) return "Ongoing Rehabilitation";
    if (s.includes("under repair") || s.includes("repair/maintenance") || s.includes("repair / maintenance")) return "Under Repair/Maintenance";
    if (s === "inactive") return "Inactive";
    return raw || "Unspecified";
  }

  function isOperationalGroup(status) {
    const normalized = normalizeEquipmentStatus(status);
    return normalized === "Operational" || normalized === "Ongoing Emergency Repair";
  }

  function setConnectionStatus(mode, detail) {
    const title = $("dbStatusTitle");
    const text = $("dbStatusText");
    const note = $("dbStatusNote");
    if (!title || !text || !note) return;
    title.textContent = mode === "connected" ? "Firebase Connected" : mode === "error" ? "Firebase Offline" : "Connecting to Firebase";
    text.textContent = detail || "easternwh-14c32";
    note.classList.toggle("db-connected", mode === "connected");
    note.classList.toggle("db-error", mode === "error");
  }

  async function firebaseRequest(method, path, payload) {
    const url = `${DB_URL}/${path.replace(/^\/+|\/+$/g, "")}.json`;
    const options = { method, headers: { "Content-Type": "application/json" } };
    if (payload !== undefined) options.body = JSON.stringify(payload);

    let response;
    try {
      response = await fetch(url, options);
    } catch (err) {
      throw new Error(`Network error: ${err.message || err}`);
    }

    let body = null;
    const text = await response.text();
    if (text) {
      try { body = JSON.parse(text); } catch { body = text; }
    }

    if (!response.ok) {
      const message = body?.error || body || `Firebase request failed (${response.status})`;
      throw new Error(String(message));
    }
    return body;
  }

  const firebaseGet = (path) => firebaseRequest("GET", path);
  const firebasePost = (path, payload) => firebaseRequest("POST", path, payload);
  const firebasePut = (path, payload) => firebaseRequest("PUT", path, payload);
  const firebasePatch = (path, payload) => firebaseRequest("PATCH", path, payload);
  const firebaseDelete = (path) => firebaseRequest("DELETE", path);

  function isOutTransaction(type) {
    const t = String(type || "").trim().toLowerCase();
    return ["out", "release", "released", "issue", "issued", "issuance"].includes(t);
  }

  function normConsumableKey(name, unit, equipmentKey = "") {
    const eq = String(equipmentKey || "__all_equipment__").trim().toLowerCase();
    return `${String(name || "").trim().toLowerCase()}\u0001${String(unit || "").trim().toLowerCase()}\u0001${eq}`;
  }

  function consumableEquipmentKey(rec = {}) {
    return String(rec?.equipmentId || rec?.equipmentTag || "__all_equipment__").trim() || "__all_equipment__";
  }

  function consumableDisplayName(item = {}) {
    const original = String(item?.originalItemName || "").trim();
    if (original) return original;

    let name = String(item?.name || item?.sourceName || item?.itemName || "").trim();
    const partNumber = String(item?.partNumber || item?.partNo || "").trim();

    // Imported legacy data may have the part number embedded into the item name.
    // Keep the part number as data, but never show it inside the Item Name dropdown label.
    name = name.replace(/\s*\[PN:[^\]]*\]\s*$/i, "").trim();
    if (partNumber) {
      const escapedPart = partNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      name = name.replace(new RegExp(`\\s*[—–-]\\s*${escapedPart}\\s*$`, "i"), "").trim();
    }
    return name;
  }

  const NO_PART_NUMBER_VALUE = "__NO_PART_NUMBER__";

  function normalizeConsumableText(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function consumableIdentityKey(name, partNumber = "") {
    return `${normalizeConsumableText(name)}\u0001${normalizeConsumableText(partNumber)}`;
  }

  function cleanConsumableNameInput(name, partNumber = "") {
    return consumableDisplayName({ name: String(name || "").trim(), partNumber }).trim();
  }

  function buildConsumableStorageName(displayName, partNumber = "") {
    const cleanName = cleanConsumableNameInput(displayName, partNumber);
    const pn = String(partNumber || "").trim();
    return pn ? `${cleanName} [PN:${pn}]` : cleanName;
  }

  function activeConsumableVariants() {
    return state.consumables.filter(i => i.dropdownActive !== false && consumableDisplayName(i));
  }

  function consumableVariantsByDisplayName(displayName) {
    const key = normalizeConsumableText(displayName);
    return activeConsumableVariants().filter(i => normalizeConsumableText(consumableDisplayName(i)) === key);
  }

  function selectedPartNumber(selectId) {
    const value = $(selectId)?.value || "";
    if (!value) return null;
    return value === NO_PART_NUMBER_VALUE ? "" : value;
  }

  function deriveConsumables(recordsObj, dropdownObj = {}) {
    const groups = new Map();
    const entries = Object.entries(recordsObj || {}).sort(([a], [b]) => a.localeCompare(b));

    entries.forEach(([key, rec]) => {
      if (!rec || typeof rec !== "object") return;
      const name = String(rec.itemName || "").trim();
      const unit = String(rec.unit || "").trim() || "PCS";
      const partNumber = String(rec.partNumber || rec.partNo || "").trim();
      const equipmentId = String(rec.equipmentId || "").trim();
      const equipmentTag = String(rec.equipmentTag || "All Equipment").trim() || "All Equipment";
      const equipmentName = String(rec.equipmentName || "").trim();
      if (!name) return;
      const groupKey = normConsumableKey(name, unit, equipmentId || equipmentTag);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: groupKey,
          sourceName: name,
          originalItemName: String(rec.originalItemName || "").trim(),
          sourceUnit: unit,
          sourceEquipmentKey: equipmentId || equipmentTag,
          name,
          unit,
          partNumber,
          equipmentId,
          equipmentTag,
          equipmentName,
          stock: 0,
          totalIn: 0,
          totalOut: 0,
          lastReceived: "",
          sourceKeys: [],
          transactions: [],
          catalogId: "",
          dropdownActive: true
        });
      }
      const item = groups.get(groupKey);
      if (partNumber) item.partNumber = partNumber;
      if (rec.originalItemName) item.originalItemName = String(rec.originalItemName).trim();
      if (equipmentId) item.equipmentId = equipmentId;
      if (equipmentTag) item.equipmentTag = equipmentTag;
      if (equipmentName) item.equipmentName = equipmentName;
      const qty = Number(rec.qty) || 0;
      const out = isOutTransaction(rec.transactionType);
      const override = rec.isInventoryOverride === true;

      if (override) {
        item.stock = qty;
      } else if (out) {
        item.stock -= qty;
        item.totalOut += qty;
      } else {
        item.stock += qty;
        item.totalIn += qty;
        if (rec.date) item.lastReceived = rec.date;
      }

      item.sourceKeys.push(key);
      item.transactions.push({ key, ...rec });
    });

    const catalogEntries = Object.entries(dropdownObj || {}).map(([id, rec]) => ({
      id,
      sourceName: String(rec?.sourceName || rec?.name || "").trim(),
      originalItemName: String(rec?.originalItemName || "").trim(),
      sourceUnit: String(rec?.sourceUnit || rec?.unit || "PCS").trim() || "PCS",
      name: String(rec?.name || rec?.sourceName || "").trim(),
      unit: String(rec?.unit || rec?.sourceUnit || "PCS").trim() || "PCS",
      partNumber: String(rec?.partNumber || rec?.partNo || "").trim(),
      equipmentId: String(rec?.equipmentId || "").trim(),
      equipmentTag: String(rec?.equipmentTag || "All Equipment").trim() || "All Equipment",
      equipmentName: String(rec?.equipmentName || "").trim(),
      active: rec?.active !== false,
      createdAt: rec?.createdAt || "",
      updatedAt: rec?.updatedAt || ""
    })).filter(x => x.name);

    const bySource = new Map(catalogEntries.map(c => [normConsumableKey(c.sourceName, c.sourceUnit, c.equipmentId || c.equipmentTag), c]));
    const usedCatalogIds = new Set();
    const items = [...groups.values()].map(item => {
      const cat = bySource.get(normConsumableKey(item.sourceName, item.sourceUnit, item.equipmentId || item.equipmentTag));
      if (cat) {
        usedCatalogIds.add(cat.id);
        item.catalogId = cat.id;
        item.originalItemName = cat.originalItemName || item.originalItemName || "";
        item.name = cat.name || item.name;
        item.unit = cat.unit || item.unit;
        item.partNumber = cat.partNumber || item.partNumber || "";
        item.equipmentId = cat.equipmentId || item.equipmentId || "";
        item.equipmentTag = cat.equipmentTag || item.equipmentTag || "All Equipment";
        item.equipmentName = cat.equipmentName || item.equipmentName || "";
        item.dropdownActive = cat.active !== false;
      }
      item.stock = Number(item.stock.toFixed(4));
      return item;
    });

    catalogEntries.forEach(cat => {
      if (usedCatalogIds.has(cat.id)) return;
      items.push({
        id: `catalog:${cat.id}`,
        sourceName: cat.sourceName || cat.name,
        originalItemName: cat.originalItemName || "",
        sourceUnit: cat.sourceUnit || cat.unit,
        name: cat.name,
        unit: cat.unit,
        partNumber: cat.partNumber || "",
        equipmentId: cat.equipmentId || "",
        equipmentTag: cat.equipmentTag || "All Equipment",
        equipmentName: cat.equipmentName || "",
        stock: 0,
        totalIn: 0,
        totalOut: 0,
        lastReceived: "",
        sourceKeys: [],
        transactions: [],
        catalogId: cat.id,
        dropdownActive: cat.active !== false
      });
    });

    return items;
  }

  function mapFirebaseState(equipmentObj, partsObj, warehousePartsObj, warehousePartMovementsObj, consumablesObj, consumableDropdownObj = {}) {
    const equipment = Object.entries(equipmentObj || {}).map(([id, rec]) => ({
      id,
      equipmentName: rec?.equipment || "",
      equipmentNo: rec?.equipNo || "",
      location: rec?.location || "",
      company: rec?.company || "",
      model: rec?.model || "",
      yearModel: rec?.yearModel || "",
      serial: rec?.serialNo || "",
      status: rec?.status || "",
      etc: rec?.etc || "",
      picture: rec?.picture || "",
      remarks: rec?.remarks || "",
      transferTo: rec?.transferTo || "",
      createdAt: rec?.createdAt || "",
      updatedAt: rec?.updatedAt || ""
    }));

    const equipmentByNo = new Map(equipment.map(e => [String(e.equipmentNo).trim().toLowerCase(), e]));

    const parts = Object.entries(partsObj || {}).map(([id, rec]) => {
      const eq = equipmentByNo.get(String(rec?.equipNo || "").trim().toLowerCase());
      return {
        id,
        equipmentId: eq?.id || "",
        equipmentNo: rec?.equipNo || "",
        equipmentName: rec?.equipmentName || eq?.equipmentName || "",
        equipmentCompany: rec?.equipmentCompany || eq?.company || "",
        equipmentLocation: rec?.equipmentLocation || eq?.location || "",
        partName: rec?.partName || "",
        partNumber: rec?.partNumber || "",
        prNumber: rec?.prNo || "",
        supplier: rec?.supplier || "",
        prDate: rec?.prDate || "",
        qty: Number(rec?.qty) || 0,
        unit: rec?.unit || "PCS",
        status: rec?.status || "",
        receivedDate: rec?.receivedDate || "",
        installedDate: rec?.installedDate || "",
        remarks: rec?.remarks || "",
        transferDate: rec?.transferDate || "",
        transferTo: rec?.transferTo || "",
        createdAt: rec?.createdAt || "",
        updatedAt: rec?.updatedAt || ""
      };
    });

    const warehouseParts = Object.entries(warehousePartsObj || {}).map(([id, rec]) => ({
      id,
      equipment: rec?.equipment || "",
      itemName: rec?.itemName || "",
      partNumber: rec?.partNumber || "",
      quantity: Number(rec?.quantity) || 0,
      unit: rec?.unit || "PCS",
      remarks: rec?.remarks || "",
      updatedAt: rec?.updatedAt || ""
    }));

    const warehousePartMovements = Object.entries(warehousePartMovementsObj || {}).map(([id, rec]) => ({
      id,
      partId: rec?.partId || "",
      type: rec?.type || "",
      quantity: Number(rec?.quantity) || 0,
      date: rec?.date || "",
      remarks: rec?.remarks || "",
      createdAt: rec?.createdAt || ""
    }));

    const equipmentById = new Map(equipment.map(e => [String(e.id), e]));
    const consumables = deriveConsumables(consumablesObj, consumableDropdownObj).map(item => {
      const eq = item.equipmentId ? equipmentById.get(String(item.equipmentId)) : null;
      if (eq) {
        item.equipmentTag = eq.equipmentNo || item.equipmentTag || "All Equipment";
        item.equipmentName = eq.equipmentName || item.equipmentName || "";
      }
      if (!item.equipmentTag) item.equipmentTag = "All Equipment";
      return item;
    });

    rawConsumableRecords = consumablesObj || {};
    rawConsumableDropdown = consumableDropdownObj || {};
    return {
      equipment,
      parts,
      warehouseParts,
      warehousePartMovements,
      consumables,
      activity: state.activity || []
    };
  }

  function mapTools(obj = {}, type = "") {
    return Object.entries(obj || {}).map(([id, rec]) => {
      const base = {
        id,
        name: rec?.itemName || rec?.name || rec?.toolName || rec?.equipmentName || rec?.description || "Unnamed Item",
        qty: Number(rec?.quantity ?? rec?.qty ?? rec?.actualCount ?? 0) || 0,
        unit: rec?.unit || rec?.uom || "PCS",
        createdAt: rec?.createdAt || "",
        updatedAt: rec?.updatedAt || rec?.createdAt || ""
      };
      if (type === "mtp") {
        return {
          ...base,
          owner: rec?.owner || rec?.location || "",
          toolsOnHand: rec?.toolsOnHand || "",
          toolsDescription: rec?.toolsDescription || "",
          remarks: rec?.remarks || rec?.remark || "",
          sourceRow: rec?.sourceRow ?? ""
        };
      }
      return {
        ...base,
        location: rec?.location || "",
        area: rec?.area || "",
        size: rec?.size || "",
        stockWarehouse: Number(rec?.stockWarehouse ?? 0) || 0,
        used: Number(rec?.used ?? 0) || 0,
        source: rec?.source || "",
        sourceRow: rec?.sourceRow ?? ""
      };
    });
  }

  async function loadFirebaseData(showSuccessToast = false) {
    setConnectionStatus("connecting", "Loading live records...");
    try {
      const [equipmentObj, partsObj, warehousePartsObj, warehousePartMovementsObj, consumablesObj, consumableDropdownObj, mtpToolsObj, mnrToolsObj] = await Promise.all([
        firebaseGet(PATHS.equipment),
        firebaseGet(PATHS.parts),
        firebaseGet(PATHS.warehouseParts),
        firebaseGet(PATHS.warehousePartMovements),
        firebaseGet(PATHS.consumables),
        firebaseGet(PATHS.consumableDropdown),
        firebaseGet(PATHS.mtpTools),
        firebaseGet(PATHS.mnrTools)
      ]);
      state = mapFirebaseState(equipmentObj, partsObj, warehousePartsObj, warehousePartMovementsObj, consumablesObj, consumableDropdownObj);
      state.mtpTools = mapTools(mtpToolsObj, "mtp");
      state.mnrTools = mapTools(mnrToolsObj, "mnr");
      firebaseReady = true;
        setConnectionStatus("connected", "Live data: easternwh-14c32");
      refreshAll();
      if (showSuccessToast) toast("Firebase data refreshed.");
      return true;
    } catch (err) {
      firebaseReady = false;
      console.error(err);
      state = emptyState();
      rawConsumableRecords = {};
      rawConsumableDropdown = {};
      setConnectionStatus("error", "No local fallback — Firebase connection required");
      refreshAll();
      toast(`Firebase connection failed: ${err.message}`, true);
      return false;
    }
  }

  function requireFirebase() {
    if (firebaseReady) return true;
    toast("Firebase is not connected. Refresh the database connection first.", true);
    return false;
  }

  function selectOptions(select, values, placeholder = "") {
    if (!select) return;
    const current = select.value;
    const list = uniqueExact(values);
    select.innerHTML = (placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : "") +
      list.map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
    if ([...select.options].some(o => o.value === current)) select.value = current;
  }

  function populateDynamicOptions() {
    const partStatuses = uniqueExact([...PART_STATUSES, ...state.parts.map(p => p.status)]);
    selectOptions($("partStatus"), partStatuses);
    const statusFilterCurrent = $("partsStatusFilter").value;
    $("partsStatusFilter").innerHTML = `<option value="">All Statuses</option>` +
      partStatuses.map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
    if ([...$("partsStatusFilter").options].some(o => o.value === statusFilterCurrent)) $("partsStatusFilter").value = statusFilterCurrent;

    const equipmentStatuses = uniqueExact([...EQUIPMENT_STATUSES, ...state.equipment.map(e => e.status)]);
    selectOptions($("equipmentStatus"), equipmentStatuses);

    const partNames = uniqueExact([...state.parts.map(p => p.partName), ...DEFAULT_PART_NAMES]);
    const partNameInput = $("partName");
    const currentPartName = partNameInput.value;
    const partNameOptions = $("partNameOptions");
    if (partNameOptions) {
      partNameOptions.innerHTML = `<option value="＋ New Part Name"></option>` +
        partNames.map(x => `<option value="${escapeHtml(x)}"></option>`).join("");
    }
    partNameInput.value = currentPartName;
    updatePartNameSelection();

    const partUnits = uniqueExact([...state.parts.map(p => p.unit), ...DEFAULT_UNITS]);
    selectOptions($("partUnit"), partUnits);

    const consumableUnits = uniqueExact([...state.consumables.map(i => i.unit), ...DEFAULT_UNITS]);
    selectOptions($("consumableInUnit"), consumableUnits);
    selectOptions($("newConsumableUnit"), consumableUnits);

    const locations = uniqueExact([...state.equipment.map(e => e.location), ...DEFAULT_LOCATIONS]);
    selectOptions($("equipmentLocation"), locations);
    const currentFilter = $("equipmentLocationFilter").value;
    $("equipmentLocationFilter").innerHTML = `<option value="">All Locations</option>` +
      locations.map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
    if ([...$("equipmentLocationFilter").options].some(o => o.value === currentFilter)) $("equipmentLocationFilter").value = currentFilter;
  }

  function populateEquipmentDropdown() {
    const current = $("partEquipmentNo").value;
    const sorted = [...state.equipment].sort((a, b) => String(a.equipmentNo).localeCompare(String(b.equipmentNo)));
    $("partEquipmentNo").disabled = false;
    $("partEquipmentNo").innerHTML = `<option value="">Select Equipment No.</option>` +
      sorted.map(e => `<option value="${escapeHtml(e.id)}">${escapeHtml(e.equipmentNo)} — ${escapeHtml(e.equipmentName || "")}</option>`).join("");
    if ([...$("partEquipmentNo").options].some(o => o.value === current)) $("partEquipmentNo").value = current;
  }

  function updatePartNameSelection() {
    const value = String($("partName")?.value || "").trim();
    const isNew = value === "__new__" || value === "＋ New Part Name" || value === "+ New Part Name";
    const box = $("partNewPartNameFields");
    if (!box) return;
    box.classList.toggle("hidden", !isNew);
    if ($("partNewPartName")) {
      $("partNewPartName").required = isNew;
      if (!isNew) $("partNewPartName").value = "";
    }
  }

  function populateConsumableEquipmentTagOptions() {
    const sorted = [...state.equipment].sort((a, b) => String(a.equipmentNo).localeCompare(String(b.equipmentNo)));
    const html = `<option value="">All Equipment</option>` +
      sorted.map(e => `<option value="${escapeHtml(e.id)}">${escapeHtml(e.equipmentNo)} — ${escapeHtml(e.equipmentName || "")}</option>`).join("");

    [$("consumableInEquipmentTag"), $("newConsumableEquipmentTag")].forEach(select => {
      if (!select) return;
      const current = select.value;
      select.innerHTML = html;
      if ([...select.options].some(o => o.value === current)) select.value = current;
      else select.value = "";
    });
  }

  function consumablePairChoiceValue(name, partNumber = "") {
    return `${encodeURIComponent(String(name || "").trim())}||${encodeURIComponent(String(partNumber || "").trim())}`;
  }

  function parseConsumablePairChoice(value) {
    const raw = String(value || "");
    if (!raw || !raw.includes("||")) return null;
    const [encodedName, encodedPart] = raw.split("||", 2);
    try {
      return {
        name: decodeURIComponent(encodedName || ""),
        partNumber: decodeURIComponent(encodedPart || "")
      };
    } catch (_) {
      return null;
    }
  }

  function populateConsumableDropdown() {
    const currentReplenish = $("consumableReplenishItem")?.value || "";
    const currentOut = $("consumableOutItem")?.value || "";

    const allItems = activeConsumableVariants()
      .sort((a, b) => {
        const byName = consumableDisplayName(a).localeCompare(consumableDisplayName(b));
        if (byName) return byName;
        return String(a.partNumber || "").localeCompare(String(b.partNumber || ""));
      });

    const seenPairs = new Set();
    const pairs = [];
    allItems.forEach(item => {
      const name = consumableDisplayName(item);
      const partNumber = String(item.partNumber || "").trim();
      const key = consumableIdentityKey(name, partNumber);
      if (!name || seenPairs.has(key)) return;
      seenPairs.add(key);
      pairs.push({ name, partNumber });
    });

    const options = `<option value="">Select Item / Part Number</option>` +
      pairs.map(({ name, partNumber }) => {
        const label = `${name} — ${partNumber || "No Part Number"}`;
        const value = consumablePairChoiceValue(name, partNumber);
        return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
      }).join("");

    if ($("consumableReplenishItem")) {
      $("consumableReplenishItem").innerHTML = options;
      if ([...$("consumableReplenishItem").options].some(o => o.value === currentReplenish)) {
        $("consumableReplenishItem").value = currentReplenish;
      }
      populateVariantEquipmentOptions("replenish");
    }

    if ($("consumableOutItem")) {
      $("consumableOutItem").innerHTML = options;
      if ([...$("consumableOutItem").options].some(o => o.value === currentOut)) {
        $("consumableOutItem").value = currentOut;
      }
      populateVariantEquipmentOptions("out");
    }
  }

  function variantControlIds(mode) {
    return mode === "replenish"
      ? {
          item: "consumableReplenishItem",
          equipment: "consumableReplenishEquipmentTag",
          qty: "consumableReplenishQty",
          unit: "consumableReplenishUnit",
          stock: "consumableReplenishCurrentStock",
          date: "consumableReplenishDate",
          submit: "consumableReplenishSubmit"
        }
      : {
          item: "consumableOutItem",
          equipment: "consumableOutEquipmentTag",
          qty: "consumableOutQty",
          unit: "",
          stock: "selectedOutItemStock",
          date: "",
          submit: "consumableOutSubmit"
        };
  }

  function resetVariantSelection(mode) {
    const ids = variantControlIds(mode);
    const equipment = $(ids.equipment);
    const qty = $(ids.qty);
    const submit = $(ids.submit);

    if (equipment) {
      equipment.innerHTML = `<option value="">Select Item first</option>`;
      equipment.disabled = true;
    }

    if (ids.unit && $(ids.unit)) $(ids.unit).value = "";
    if (ids.stock && $(ids.stock)) {
      if (mode === "replenish") $(ids.stock).value = "";
      else $(ids.stock).textContent = "Select an Item / Part Number to view available stock.";
    }
    if (qty) {
      qty.value = "";
      qty.disabled = true;
    }
    if (ids.date && $(ids.date)) {
      $(ids.date).disabled = true;
      if (!$(ids.date).value) $(ids.date).value = todayValue();
    }
    if (submit) submit.disabled = true;
  }

  function populateVariantEquipmentOptions(mode) {
    const ids = variantControlIds(mode);
    const selectedPair = parseConsumablePairChoice($(ids.item)?.value || "");
    const equipmentSelect = $(ids.equipment);

    resetVariantSelection(mode);
    if (!selectedPair || !equipmentSelect) return;

    const variants = activeConsumableVariants()
      .filter(i =>
        normalizeConsumableText(consumableDisplayName(i)) === normalizeConsumableText(selectedPair.name) &&
        normalizeConsumableText(i.partNumber || "") === normalizeConsumableText(selectedPair.partNumber)
      )
      .sort((a, b) => {
        const aAll = normalizeConsumableText(a.equipmentTag) === "all equipment" ? 0 : 1;
        const bAll = normalizeConsumableText(b.equipmentTag) === "all equipment" ? 0 : 1;
        if (aAll !== bAll) return aAll - bAll;
        return String(a.equipmentTag || "").localeCompare(String(b.equipmentTag || ""));
      });

    equipmentSelect.innerHTML = `<option value="">Select Equipment Tag</option>` +
      variants.map(item => {
        const tag = item.equipmentTag || "All Equipment";
        const equipmentName = item.equipmentName ? ` — ${item.equipmentName}` : "";
        return `<option value="${escapeHtml(item.id)}">${escapeHtml(tag + equipmentName)}</option>`;
      }).join("");
    equipmentSelect.disabled = false;

    if (variants.length === 1) {
      equipmentSelect.value = variants[0].id;
      updateExactConsumableSelection(mode);
    }
  }

  function updateExactConsumableSelection(mode) {
    const ids = variantControlIds(mode);
    const item = state.consumables.find(i => i.id === ($(ids.equipment)?.value || ""));
    const qty = $(ids.qty);
    const submit = $(ids.submit);

    if (!item) {
      if (ids.unit && $(ids.unit)) $(ids.unit).value = "";
      if (ids.stock && $(ids.stock)) {
        if (mode === "replenish") $(ids.stock).value = "";
        else $(ids.stock).textContent = "Select the exact item to view available stock.";
      }
      if (qty) {
        qty.value = "";
        qty.disabled = true;
      }
      if (ids.date && $(ids.date)) $(ids.date).disabled = true;
      if (submit) submit.disabled = true;
      return null;
    }

    if (ids.unit && $(ids.unit)) $(ids.unit).value = item.unit || "";
    if (ids.stock && $(ids.stock)) {
      const stockText = `${Number(item.stock).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${item.unit}`;
      if (mode === "replenish") $(ids.stock).value = stockText;
      else $(ids.stock).textContent = `Equipment Tag: ${item.equipmentTag || "All Equipment"} • Part No: ${item.partNumber || "—"} • Available: ${stockText}`;
    }
    if (qty) qty.disabled = false;
    if (ids.date && $(ids.date)) {
      $(ids.date).disabled = false;
      if (!$(ids.date).value) $(ids.date).value = todayValue();
    }
    if (submit) submit.disabled = false;
    return item;
  }

  function refreshAll() {
    populateDynamicOptions();
    populateEquipmentDropdown();
    populateConsumableEquipmentTagOptions();
    populateConsumableDropdown();
    renderDashboard();
    renderParts();
    populateWarehousePartSelectors();
    renderWarehousePartsInventory();
    renderConsumables();
    renderConsumableDropdownManager();
    renderEquipment();
    renderToolsInventory("mtp");
    renderToolsInventory("mnr");
  }

  function renderDashboard() {
    $("statOperational").textContent = state.equipment.filter(e => isOperationalGroup(e.status)).length;
    $("statRehabilitation").textContent = state.equipment.filter(e => normalizeEquipmentStatus(e.status) === "Ongoing Rehabilitation").length;
    $("statRepair").textContent = state.equipment.filter(e => normalizeEquipmentStatus(e.status) === "Under Repair/Maintenance").length;
    $("statInactive").textContent = state.equipment.filter(e => normalizeEquipmentStatus(e.status) === "Inactive").length;
  }

  function renderParts() {
    const q = $("partsSearch").value.trim().toLowerCase();
    const status = $("partsStatusFilter").value;
    let rows = [...state.parts].sort((a,b) => dateTimeValue(b.updatedAt) - dateTimeValue(a.updatedAt) || b.id.localeCompare(a.id));
    if (q) {
      rows = rows.filter(p => [p.equipmentNo, p.equipmentName, p.partName, p.partNumber, p.prNumber, p.supplier, p.remarks]
        .some(v => String(v || "").toLowerCase().includes(q)));
    }
    if (status) rows = rows.filter(p => p.status === status);

    // Live filter totals for Equipment Part Request.
    // Record count is always meaningful. QTY is summed numerically and marked as mixed when units differ.
    const numericQty = rows.map(p => Number.parseFloat(String(p.qty ?? "").replace(/,/g, ""))).filter(Number.isFinite);
    const totalQty = numericQty.reduce((sum, value) => sum + value, 0);
    const units = [...new Set(rows.map(p => String(p.unit || "").trim().toUpperCase()).filter(Boolean))];
    const qtyLabel = Number.isInteger(totalQty) ? String(totalQty) : totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 });
    $("partsFilteredTotal").textContent = rows.length.toLocaleString();
    $("partsFilteredQty").textContent = units.length > 1 ? `${qtyLabel} (mixed units)` : `${qtyLabel}${units.length === 1 ? ` ${units[0]}` : ""}`;

    $("partsTable").innerHTML = rows.length ? rows.map(p => `
      <tr>
        <td><strong>${escapeHtml(p.equipmentNo)}</strong></td>
        <td>${escapeHtml(p.partName)}</td>
        <td>${escapeHtml(p.partNumber || "—")}</td>
        <td>${escapeHtml(p.prNumber || "—")}</td>
        <td>${escapeHtml(p.supplier || "—")}</td>
        <td>${formatDate(p.prDate)}</td>
        <td>${escapeHtml(p.qty)} ${escapeHtml(p.unit)}</td>
        <td><span class="badge ${badgeClass(p.status)}">${escapeHtml(p.status || "—")}</span></td>
        <td>${formatDate(p.receivedDate)}</td>
        <td>${formatDate(p.installedDate)}</td>
        <td>${escapeHtml(p.remarks || "—")}</td>
        <td><div class="action-group"><button class="action-btn edit" data-action="edit-part" data-id="${escapeHtml(p.id)}">Edit</button><button class="action-btn delete" data-action="delete-part" data-id="${escapeHtml(p.id)}">Delete</button></div></td>
      </tr>`).join("") : `<tr><td colspan="12" class="table-empty">No equipment parts found.</td></tr>`;
  }

  function warehousePartLabel(part) {
    const name = String(part?.itemName || "").trim() || "Unnamed Part";
    const pn = String(part?.partNumber || "").trim();
    const eq = String(part?.equipment || "").trim();
    return `${name}${pn ? ` • ${pn}` : ""}${eq ? ` • ${eq}` : ""}`;
  }

  function populateWarehousePartSelectors() {
    const parts = [...state.warehouseParts]
      .filter(p => String(p.itemName || "").trim())
      .sort((a,b) => warehousePartLabel(a).localeCompare(warehousePartLabel(b)));
    ["warehousePartInItem", "warehousePartOutItem"].forEach(id => {
      const select = $(id);
      if (!select) return;
      const current = select.value;
      // Keep zero-stock items available for IN/replenishment, but hide them from OUT.
      const selectableParts = id === "warehousePartOutItem"
        ? parts.filter(p => Number(p.quantity) > 0)
        : parts;
      const newItemOption = id === "warehousePartInItem" ? `<option value="__new__">＋ New Item</option>` : "";
      select.innerHTML = `<option value="">Select warehouse part...</option>${newItemOption}` + selectableParts.map(p =>
        `<option value="${escapeHtml(p.id)}">${escapeHtml(warehousePartLabel(p))}</option>`
      ).join("");
      if ([...select.options].some(o => o.value === current)) select.value = current;
    });
    updateWarehousePartSelection("in");
    updateWarehousePartSelection("out");
  }

  function updateWarehousePartSelection(mode) {
    const select = $(mode === "in" ? "warehousePartInItem" : "warehousePartOutItem");
    const stockEl = $(mode === "in" ? "warehousePartInStock" : "warehousePartOutStock");
    if (!select || !stockEl) return null;

    const isNew = mode === "in" && select.value === "__new__";
    const newFields = $("warehousePartNewItemFields");
    if (newFields) newFields.classList.toggle("hidden", !isNew);

    if (isNew) {
      stockEl.textContent = "New item: enter the item details below. QTY IN will be used as the initial stock.";
      setTimeout(() => $("warehousePartNewItemName")?.focus(), 0);
      return { __newItem: true };
    }

    const part = state.warehouseParts.find(p => p.id === select.value);
    stockEl.textContent = part
      ? `Current stock: ${Number(part.quantity).toLocaleString(undefined,{maximumFractionDigits:2})} ${part.unit || "PCS"}${part.remarks ? ` • ${part.remarks}` : ""}`
      : "Select an item to view current stock, or choose + New Item.";
    return part || null;
  }

  function renderWarehousePartsInventory() {
    const body = $("warehousePartsInventoryTable");
    if (!body) return;
    const q = ($("warehousePartsSearch")?.value || "").trim().toLowerCase();
    // Inventory should only show items with actual stock on hand.
    // Zero-stock records remain in Firebase so they can be replenished through IN later.
    let rows = [...state.warehouseParts]
      .filter(p => Number(p.quantity) > 0)
      .sort((a,b) => String(a.itemName || "").localeCompare(String(b.itemName || "")) || String(a.partNumber || "").localeCompare(String(b.partNumber || "")));
    if (q) rows = rows.filter(p => [p.itemName,p.partNumber,p.equipment,p.unit,p.remarks].some(v => String(v || "").toLowerCase().includes(q)));
    body.innerHTML = rows.length ? rows.map(p => `
      <tr>
        <td><strong>${escapeHtml(p.itemName || "—")}</strong></td>
        <td>${escapeHtml(p.partNumber || "—")}</td>
        <td>${escapeHtml(p.equipment || "—")}</td>
        <td><strong>${Number(p.quantity).toLocaleString(undefined,{maximumFractionDigits:2})}</strong></td>
        <td>${escapeHtml(p.unit || "PCS")}</td>
        <td>${escapeHtml(p.remarks || "—")}</td>
        <td><div class="action-group"><button type="button" class="action-btn edit" data-action="edit-warehouse-part" data-id="${escapeHtml(p.id)}">Edit</button><button type="button" class="action-btn delete" data-action="delete-warehouse-part" data-id="${escapeHtml(p.id)}">Delete</button></div></td>
      </tr>`).join("") : `<tr><td colspan="7" class="table-empty">No equipment parts warehouse items found.</td></tr>`;
  }

  async function deleteWarehousePart(id) {
    if (!requireFirebase()) return;
    const part = state.warehouseParts.find(p => p.id === id);
    if (!part) return toast("Equipment Parts Warehouse item not found.", true);

    const label = warehousePartLabel(part);
    if (!confirm(`Delete ${label} from Equipment Parts Warehouse Inventory?\n\nThis removes the item record from equipmentPartsWarehouse. Existing IN/OUT movement history will be preserved.`)) return;

    try {
      await firebaseDelete(`${PATHS.warehouseParts}/${part.id}`);
      logActivity("Warehouse part deleted", `${part.itemName || "Unnamed Part"} • ${part.partNumber || "No Part Number"}`);
      await loadFirebaseData();
      showView("equipmentpartswarehouse");
      showTab("equipmentpartswarehouse", "warehouse-parts-inventory");
      toast("Equipment Parts Warehouse item deleted.");
    } catch (err) {
      console.error(err);
      toast(`Firebase delete failed: ${err.message}`, true);
    }
  }

  function openWarehousePartEditModal(id) {
    const part = state.warehouseParts.find(p => p.id === id);
    if (!part) return toast("Equipment Parts Warehouse item not found.", true);

    $("warehousePartEditId").value = part.id;
    $("warehousePartEditEquipment").value = part.equipment || "";
    $("warehousePartEditItemName").value = part.itemName || "";
    $("warehousePartEditPartNumber").value = part.partNumber || "";
    $("warehousePartEditQuantity").value = Number.isFinite(Number(part.quantity)) ? Number(part.quantity) : 0;
    $("warehousePartEditUnit").value = part.unit || "";
    $("warehousePartEditRemarks").value = part.remarks || "";
    $("warehousePartEditModal").classList.remove("hidden");
    setTimeout(() => $("warehousePartEditItemName")?.focus(), 0);
  }

  function closeWarehousePartEditModal() {
    $("warehousePartEditModal")?.classList.add("hidden");
    $("warehousePartEditForm")?.reset();
    if ($("warehousePartEditId")) $("warehousePartEditId").value = "";
  }

  async function saveWarehousePartEdit() {
    if (!requireFirebase()) return;
    const id = $("warehousePartEditId").value;
    const part = state.warehouseParts.find(p => p.id === id);
    if (!part) return toast("Equipment Parts Warehouse item not found.", true);

    const itemName = $("warehousePartEditItemName").value.trim();
    const equipment = $("warehousePartEditEquipment").value.trim();
    const partNumber = $("warehousePartEditPartNumber").value.trim();
    const quantity = Number($("warehousePartEditQuantity").value);
    const unit = $("warehousePartEditUnit").value.trim();
    const remarks = $("warehousePartEditRemarks").value.trim();

    if (!itemName) return toast("Item Name is required.", true);
    if (!Number.isFinite(quantity) || quantity < 0) return toast("QTY must be 0 or greater.", true);
    if (!unit) return toast("Unit is required.", true);

    try {
      await firebasePatch(`${PATHS.warehouseParts}/${part.id}`, {
        equipment,
        itemName,
        partNumber,
        quantity,
        unit,
        remarks,
        updatedAt: dbNowText()
      });
      logActivity(
        "Warehouse part details edited",
        `${part.itemName || "Unnamed Part"} → ${itemName} • QTY ${Number(part.quantity) || 0} → ${quantity} ${unit}`
      );
      closeWarehousePartEditModal();
      await loadFirebaseData();
      showView("equipmentpartswarehouse");
      showTab("equipmentpartswarehouse", "warehouse-parts-inventory");
      toast("Equipment Parts Warehouse item updated.");
    } catch (err) {
      console.error(err);
      toast(`Firebase update failed: ${err.message}`, true);
    }
  }

  async function saveWarehousePartMovement(mode) {
    if (!requireFirebase()) return;
    const isIn = mode === "in";
    const selection = updateWarehousePartSelection(mode);
    const isNewItem = isIn && selection?.__newItem === true;
    if (!selection) return toast("Please select an Equipment Parts Warehouse item.", true);

    const qtyEl = $(isIn ? "warehousePartInQty" : "warehousePartOutQty");
    const dateEl = $(isIn ? "warehousePartInDate" : "warehousePartOutDate");
    const remarksEl = $(isIn ? "warehousePartInRemarks" : "warehousePartOutRemarks");
    const qty = Number(qtyEl?.value);
    if (!Number.isFinite(qty) || qty <= 0) return toast("Enter a valid quantity greater than 0.", true);

    if (isNewItem) {
      const itemName = $("warehousePartNewItemName")?.value.trim() || "";
      const equipment = $("warehousePartNewEquipment")?.value.trim() || "";
      const partNumber = $("warehousePartNewPartNumber")?.value.trim() || "";
      const unit = $("warehousePartNewUnit")?.value.trim() || "";
      const itemRemarks = $("warehousePartNewRemarks")?.value.trim() || "";

      if (!itemName) return toast("Item Name is required for a new warehouse item.", true);
      if (!unit) return toast("Unit is required for a new warehouse item.", true);

      const now = dbNowText();
      const newPart = {
        equipment,
        itemName,
        partNumber,
        quantity: qty,
        unit,
        remarks: itemRemarks,
        createdAt: now,
        updatedAt: now
      };

      try {
        const result = await firebasePost(PATHS.warehouseParts, newPart);
        const partId = result?.name;
        if (!partId) throw new Error("Firebase did not return the new item ID.");

        const movement = {
          partId,
          itemName,
          partNumber,
          equipment,
          unit,
          type: "IN",
          quantity: qty,
          previousQuantity: 0,
          balanceAfter: qty,
          date: dateEl?.value || todayValue(),
          remarks: remarksEl?.value.trim() || "",
          createdAt: now
        };
        await firebasePost(PATHS.warehousePartMovements, movement);
        logActivity("Warehouse part created + IN", `${itemName} • +${qty} ${unit} • Initial balance ${qty}`);
        await loadFirebaseData();
        $("warehousePartInForm")?.reset();
        if ($("warehousePartNewUnit")) $("warehousePartNewUnit").value = "PCS";
        if (dateEl) dateEl.value = todayValue();
        $("warehousePartNewItemFields")?.classList.add("hidden");
        showView("equipmentpartswarehouse");
        showTab("equipmentpartswarehouse", "warehouse-parts-inventory");
        toast(`New Equipment Parts Warehouse item created. Initial stock: ${qty} ${unit}.`);
      } catch (err) {
        console.error(err);
        toast(`Firebase write failed: ${err.message}`, true);
      }
      return;
    }

    const part = selection;
    if (!isIn && qty > Number(part.quantity)) return toast(`Not enough stock. Available: ${part.quantity} ${part.unit}.`, true);
    const newQty = Number(part.quantity) + (isIn ? qty : -qty);
    const movement = {
      partId: part.id,
      itemName: part.itemName,
      partNumber: part.partNumber || "",
      equipment: part.equipment || "",
      unit: part.unit || "PCS",
      type: isIn ? "IN" : "OUT",
      quantity: qty,
      previousQuantity: Number(part.quantity) || 0,
      balanceAfter: newQty,
      date: dateEl?.value || todayValue(),
      remarks: remarksEl?.value.trim() || "",
      createdAt: dbNowText()
    };
    try {
      await firebasePatch(`${PATHS.warehouseParts}/${part.id}`, { quantity: newQty, updatedAt: dbNowText() });
      await firebasePost(PATHS.warehousePartMovements, movement);
      logActivity(`Warehouse part ${movement.type}`, `${part.itemName} • ${isIn ? "+" : "-"}${qty} ${part.unit} • Balance ${newQty}`);
      await loadFirebaseData();
      const form = $(isIn ? "warehousePartInForm" : "warehousePartOutForm");
      form?.reset();
      if (isIn && $("warehousePartNewUnit")) $("warehousePartNewUnit").value = "PCS";
      if (dateEl) dateEl.value = todayValue();
      if (isIn) $("warehousePartNewItemFields")?.classList.add("hidden");
      showView("equipmentpartswarehouse");
      showTab("equipmentpartswarehouse", "warehouse-parts-inventory");
      toast(`Equipment Parts Warehouse ${movement.type} saved. New balance: ${newQty} ${part.unit}.`);
    } catch (err) {
      console.error(err);
      toast(`Firebase write failed: ${err.message}`, true);
    }
  }

  function renderConsumables() {
    const q = $("consumableSearch").value.trim().toLowerCase();
    let items = [...state.consumables].sort((a,b) => a.name.localeCompare(b.name) || a.unit.localeCompare(b.unit));
    if (q) items = items.filter(i => `${i.name} ${i.equipmentTag || "All Equipment"} ${i.equipmentName || ""} ${i.partNumber || ""} ${i.unit}`.toLowerCase().includes(q));

    $("consumablesTable").innerHTML = items.length ? items.map(i => `
      <tr>
        <td><strong>${escapeHtml(consumableDisplayName(i))}</strong></td>
        <td>${escapeHtml(i.equipmentTag || "All Equipment")}</td>
        <td>${escapeHtml(i.partNumber || "—")}</td>
        <td><span class="qty-chip">${Number(i.stock).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></td>
        <td>${escapeHtml(i.unit)}</td>
        <td>${formatDate(i.lastReceived)}</td>
      </tr>`).join("") : `<tr><td colspan="6" class="table-empty">No consumable items found.</td></tr>`;

    if ($("consumableOutEquipmentTag")?.value) updateExactConsumableSelection("out");
    if ($("consumableReplenishEquipmentTag")?.value) updateExactConsumableSelection("replenish");
  }

  function renderEquipment() {
    const q = $("equipmentSearch").value.trim().toLowerCase();
    const loc = $("equipmentLocationFilter").value;
    const statusFilter = $("equipmentStatusFilter").value;
    let rows = [...state.equipment].sort((a,b) => a.equipmentNo.localeCompare(b.equipmentNo));
    if (q) {
      rows = rows.filter(e => [e.equipmentName, e.equipmentNo, e.company, e.model, e.serial, e.status, e.etc, e.remarks]
        .some(v => String(v || "").toLowerCase().includes(q)));
    }
    if (statusFilter === "Operational Group") rows = rows.filter(e => isOperationalGroup(e.status));
    else if (statusFilter) rows = rows.filter(e => normalizeEquipmentStatus(e.status) === statusFilter);
    if (loc) rows = rows.filter(e => e.location === loc);

    $("equipmentTable").innerHTML = rows.length ? rows.map(e => `
      <tr>
        <td>${e.picture ? `<img src="${e.picture}" class="equipment-thumb" alt="">` : `<div class="no-image">No image</div>`}</td>
        <td><strong>${escapeHtml(e.equipmentName)}</strong></td>
        <td>${escapeHtml(e.equipmentNo)}</td>
        <td>${escapeHtml(e.location)}</td>
        <td>${escapeHtml(e.company || "—")}</td>
        <td>${escapeHtml(e.model || "—")}</td>
        <td>${escapeHtml(e.yearModel || "—")}</td>
        <td>${escapeHtml(e.serial || "—")}</td>
        <td><span class="badge ${badgeClass(e.status)}">${escapeHtml(e.status || "—")}</span></td>
        <td>${escapeHtml(formatDateTime(e.etc))}</td>
        <td>${escapeHtml(e.remarks || "—")}</td>
        <td><div class="action-group"><button class="action-btn edit" data-action="edit-equipment" data-id="${escapeHtml(e.id)}">Edit</button><button class="action-btn delete" data-action="delete-equipment" data-id="${escapeHtml(e.id)}">Delete</button></div></td>
      </tr>`).join("") : `<tr><td colspan="12" class="table-empty">No equipment records found.</td></tr>`;
  }

  function toolConfig(type) {
    return type === "mtp"
      ? { path: PATHS.mtpTools, list: state.mtpTools, prefix: "mtp" }
      : { path: PATHS.mnrTools, list: state.mnrTools, prefix: "mnr" };
  }

  function toolPayload(type) {
    if (type === "mtp") {
      return {
        itemName: $("mtpToolName").value.trim(),
        owner: $("mtpToolOwner").value.trim(),
        quantity: Number($("mtpToolQty").value) || 0,
        unit: $("mtpToolUnit").value || "PCS",
        toolsOnHand: $("mtpToolOnHand").value.trim(),
        toolsDescription: $("mtpToolDescription").value.trim(),
        remarks: $("mtpToolRemarks").value.trim(),
        updatedAt: dbNowText()
      };
    }
    return {
      itemName: $("mnrToolName").value.trim(),
      location: $("mnrToolLocation").value.trim(),
      area: $("mnrToolArea").value.trim(),
      size: $("mnrToolSize").value.trim(),
      quantity: Number($("mnrToolQty").value) || 0,
      unit: $("mnrToolUnit").value || "PCS",
      stockWarehouse: Number($("mnrToolStockWarehouse").value) || 0,
      used: Number($("mnrToolUsed").value) || 0,
      updatedAt: dbNowText()
    };
  }

  async function saveTool(type) {
    if (!requireFirebase()) return;
    const c = toolConfig(type);
    const p = c.prefix;
    const id = $(`${p}ToolId`).value;
    const payload = toolPayload(type);
    if (!payload.itemName) return toast("Tool / Equipment Name is required.", true);
    try {
      if (id) await firebasePatch(`${c.path}/${id}`, payload);
      else await firebasePost(c.path, { ...payload, createdAt: dbNowText() });
      await loadFirebaseData();
      resetToolForm(type);
      showView("toolsinventory");
      showTab("toolsinventory", `tools-inventory-${type}`);
      toast(`${type.toUpperCase()} tool / equipment saved.`);
    } catch (err) {
      console.error(err);
      toast(`Firebase write failed: ${err.message}`, true);
    }
  }

  function resetToolForm(type) {
    const p = toolConfig(type).prefix;
    $(`${p}ToolsForm`).reset();
    $(`${p}ToolId`).value = "";
    $(`${p}ToolQty`).value = 1;
  }

  function editTool(type, id) {
    const c = toolConfig(type);
    const item = c.list.find(x => x.id === id);
    if (!item) return;
    showView("toolsinput");
    showTab("toolsinput", `tools-input-${type}`);
    if (type === "mtp") {
      $("mtpToolId").value = item.id;
      $("mtpToolName").value = item.name || "";
      $("mtpToolOwner").value = item.owner || "";
      $("mtpToolQty").value = item.qty ?? 0;
      $("mtpToolUnit").value = [...$("mtpToolUnit").options].some(o => o.value === item.unit) ? item.unit : "PCS";
      $("mtpToolOnHand").value = item.toolsOnHand || "";
      $("mtpToolDescription").value = item.toolsDescription || "";
      $("mtpToolRemarks").value = item.remarks || "";
    } else {
      $("mnrToolId").value = item.id;
      $("mnrToolName").value = item.name || "";
      $("mnrToolLocation").value = item.location || "";
      $("mnrToolArea").value = item.area || "";
      $("mnrToolSize").value = item.size || "";
      $("mnrToolQty").value = item.qty ?? 0;
      $("mnrToolUnit").value = [...$("mnrToolUnit").options].some(o => o.value === item.unit) ? item.unit : "PCS";
      $("mnrToolStockWarehouse").value = item.stockWarehouse ?? 0;
      $("mnrToolUsed").value = item.used ?? 0;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderToolsInventory(type) {
    const c = toolConfig(type);
    const p = c.prefix;
    const search = $(`${p}ToolsSearch`);
    const table = $(`${p}ToolsTable`);
    if (!search || !table) return;
    const q = search.value.trim().toLowerCase();
    let rows = [...c.list].sort((a,b) => a.name.localeCompare(b.name));
    if (q) {
      rows = rows.filter(i => {
        const fields = type === "mtp"
          ? [i.name, i.owner, i.unit, i.toolsOnHand, i.toolsDescription, i.remarks]
          : [i.name, i.location, i.area, i.size, i.unit, i.stockWarehouse, i.used];
        return fields.some(v => String(v ?? "").toLowerCase().includes(q));
      });
    }

    if (type === "mtp") {
      table.innerHTML = rows.length ? rows.map(i => `
        <tr>
          <td><strong>${escapeHtml(i.name)}</strong></td>
          <td>${escapeHtml(i.owner || "—")}</td>
          <td><span class="qty-chip">${escapeHtml(i.qty)}</span></td>
          <td>${escapeHtml(i.unit || "PCS")}</td>
          <td>${escapeHtml(i.toolsOnHand || "—")}</td>
          <td>${escapeHtml(i.toolsDescription || "—")}</td>
          <td>${escapeHtml(i.remarks || "—")}</td>
          <td><div class="action-group"><button class="action-btn edit" data-action="edit-mtp-tool" data-id="${escapeHtml(i.id)}">Edit</button><button class="action-btn delete" data-action="delete-mtp-tool" data-id="${escapeHtml(i.id)}">Delete</button></div></td>
        </tr>`).join("") : `<tr><td colspan="8" class="table-empty">No MTP tools or equipment found.</td></tr>`;
      return;
    }

    table.innerHTML = rows.length ? rows.map(i => `
      <tr>
        <td><strong>${escapeHtml(i.name)}</strong></td>
        <td>${escapeHtml(i.location || "—")}</td>
        <td>${escapeHtml(i.area || "—")}</td>
        <td>${escapeHtml(i.size || "—")}</td>
        <td><span class="qty-chip">${escapeHtml(i.qty)}</span></td>
        <td>${escapeHtml(i.unit || "PCS")}</td>
        <td>${escapeHtml(i.stockWarehouse)}</td>
        <td>${escapeHtml(i.used)}</td>
        <td><div class="action-group"><button class="action-btn edit" data-action="edit-mnr-tool" data-id="${escapeHtml(i.id)}">Edit</button><button class="action-btn delete" data-action="delete-mnr-tool" data-id="${escapeHtml(i.id)}">Delete</button></div></td>
      </tr>`).join("") : `<tr><td colspan="9" class="table-empty">No MNR tools or equipment found.</td></tr>`;
  }

  function showView(view) {
    $$(".view").forEach(v => v.classList.remove("active"));
    const target = document.querySelector(`#view-${view}`);
    if (target) target.classList.add("active");
    $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === view));
    const meta = {
      dashboard: ["Dashboard", "Equipment status overview"],
      parts: ["Equipment Parts", "Add or update equipment part records"],
      consumables: ["Consumables Movement", "Record consumable stock IN and OUT"],
      warehouse: ["Equipment Part Request", "Equipment parts request and consumables inventory"],
      equipmentpartswarehouse: ["Equipment Parts Warehouse", "Stock IN, OUT and live inventory from equipmentPartsWarehouse"],
      toolsinput: ["Tools Input", "Input MTP and MNR tools & equipment"],
      toolsinventory: ["Tools Inventory", "Separate MTP and MNR tools inventory"],
      equipment: ["Equipment Records", "Master list used by the Equipment No. dropdown"]
    };
    $("pageTitle").textContent = meta[view][0];
    $("pageSubtitle").textContent = meta[view][1];
    $("sidebar").classList.remove("open");
  }

  function showTab(group, tabId) {
    $$(`.tab-btn[data-tab-group="${group}"]`).forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
    const groupIds = {
      consumables: ["consumables-in", "consumables-replenish", "consumables-out"],
      warehouse: ["warehouse-parts", "warehouse-consumables"],
      equipmentpartswarehouse: ["warehouse-parts-in", "warehouse-parts-out", "warehouse-parts-inventory"],
      toolsinput: ["tools-input-mtp", "tools-input-mnr"],
      toolsinventory: ["tools-inventory-mtp", "tools-inventory-mnr"],
      equipment: ["equipment-list", "equipment-form"]
    };
    if (!groupIds[group]) return;
    groupIds[group].forEach(id => $(id).classList.toggle("active", id === tabId));
  }

  function resetPartForm() {
    $("partsForm").reset();
    $("partRecordId").value = "";
    $("partsFormTitle").textContent = "Add Equipment Part";
    populateDynamicOptions();
    populateEquipmentDropdown();
    $("partNewPartNameFields")?.classList.add("hidden");
    if ($("partNewPartName")) $("partNewPartName").value = "";
    $("partUnit").value = [...$("partUnit").options].some(o => o.value === "PCS") ? "PCS" : $("partUnit").options[0]?.value || "";
    const preferred = [...$("partStatus").options].find(o => o.value === "Pending Approval") || [...$("partStatus").options].find(o => o.value === "Pending for approval");
    if (preferred) $("partStatus").value = preferred.value;
  }

  function editPart(id) {
    const p = state.parts.find(x => x.id === id);
    if (!p) return;
    showView("parts");
    populateDynamicOptions();
    populateEquipmentDropdown();
    $("partRecordId").value = p.id;
    const linked = state.equipment.find(e => e.id === p.equipmentId) || state.equipment.find(e => e.equipmentNo === p.equipmentNo);
    $("partEquipmentNo").value = linked?.id || "";
    $("partName").value = p.partName;
    updatePartNameSelection();
    $("partNumber").value = p.partNumber || "";
    $("partPrNumber").value = p.prNumber || "";
    $("partSupplier").value = p.supplier || "";
    $("partPrDate").value = p.prDate || "";
    $("partQty").value = p.qty;
    $("partUnit").value = p.unit;
    $("partStatus").value = p.status;
    $("partReceivedDate").value = p.receivedDate || "";
    $("partInstalledDate").value = p.installedDate || "";
    $("partRemarks").value = p.remarks || "";
    $("partsFormTitle").textContent = "Edit Equipment Part";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetEquipmentForm() {
    $("equipmentForm").reset();
    $("equipmentRecordId").value = "";
    $("equipmentFormTitle").textContent = "Add New Equipment";
    populateDynamicOptions();
    if ([...$("equipmentLocation").options].some(o => o.value === "Bacao")) $("equipmentLocation").value = "Bacao";
    if ([...$("equipmentStatus").options].some(o => o.value === "Operational")) $("equipmentStatus").value = "Operational";
    $("equipmentEtc").value = "";
    equipmentImageData = "";
    hideEquipmentImagePreview();
  }

  function showEquipmentImagePreview(src) {
    equipmentImageData = src || "";
    if (!src) return hideEquipmentImagePreview();
    $("equipmentImagePreview").src = src;
    $("equipmentImagePreviewWrap").classList.remove("hidden");
  }

  function hideEquipmentImagePreview() {
    $("equipmentImagePreview").removeAttribute("src");
    $("equipmentImagePreviewWrap").classList.add("hidden");
  }

  function editEquipment(id) {
    const e = state.equipment.find(x => x.id === id);
    if (!e) return;
    showView("equipment");
    showTab("equipment", "equipment-form");
    populateDynamicOptions();
    $("equipmentRecordId").value = e.id;
    $("equipmentName").value = e.equipmentName;
    $("equipmentNo").value = e.equipmentNo;
    $("equipmentLocation").value = e.location;
    $("equipmentCompany").value = e.company || "";
    $("equipmentModel").value = e.model || "";
    $("equipmentYear").value = e.yearModel || "";
    $("equipmentSerial").value = e.serial || "";
    $("equipmentStatus").value = e.status;
    $("equipmentEtc").value = e.etc || "";
    $("equipmentRemarks").value = e.remarks || "";
    showEquipmentImagePreview(e.picture || "");
    $("equipmentFormTitle").textContent = "Edit Equipment";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function consumablePayload(itemName, qty, unit, type, date, extras = {}) {
    const now = dbNowText();
    return {
      category: "",
      createdAt: now,
      date: date || todayValue(),
      itemName,
      qty: Number(qty) || 0,
      referenceNo: "",
      remarks: extras.remarks || "",
      requestedBy: "",
      transactionType: type,
      unit,
      updatedAt: now,
      ...extras
    };
  }

  async function savePartFromForm() {
    if (!requireFirebase()) return;
    const id = $("partRecordId").value;
    const equipmentId = $("partEquipmentNo").value;
    const selectedEquipment = state.equipment.find(eq => eq.id === equipmentId);
    if (!selectedEquipment) return toast("Please select an Equipment No.", true);

    let partName = String($("partName").value || "").trim();
    if (!partName) return toast("Please search/select a Part Name or choose + New Part Name.", true);
    const existingPartNames = uniqueExact([...state.parts.map(p => p.partName), ...DEFAULT_PART_NAMES]);
    const isNewPartName = partName === "__new__" || partName === "＋ New Part Name" || partName === "+ New Part Name";
    if (isNewPartName) {
      partName = $("partNewPartName").value.trim();
      if (!partName) return toast("Please enter the New Part Name.", true);
      const duplicatePartName = existingPartNames
        .some(name => String(name).trim().toLowerCase() === partName.toLowerCase());
      if (duplicatePartName) return toast("That Part Name already exists. Please search and select it instead.", true);
    } else {
      const exactPartName = existingPartNames.find(name => String(name).trim().toLowerCase() === partName.toLowerCase());
      if (!exactPartName) return toast("Please select a matching Part Name from the suggestions, or choose + New Part Name.", true);
      partName = exactPartName;
    }

    const old = state.parts.find(x => x.id === id);
    const payload = {
      createdAt: old?.createdAt || dbNowText(),
      equipNo: selectedEquipment.equipmentNo,
      equipmentCompany: selectedEquipment.company || "",
      equipmentLocation: selectedEquipment.location || "",
      equipmentName: selectedEquipment.equipmentName || "",
      installedDate: $("partInstalledDate").value,
      partName,
      partNumber: $("partNumber").value.trim(),
      prDate: $("partPrDate").value,
      prNo: $("partPrNumber").value.trim(),
      qty: String(Number($("partQty").value)),
      receivedDate: $("partReceivedDate").value,
      remarks: $("partRemarks").value.trim(),
      status: $("partStatus").value,
      supplier: $("partSupplier").value.trim(),
      transferDate: old?.transferDate || "",
      transferTo: old?.transferTo || "",
      unit: $("partUnit").value,
      updatedAt: dbNowText()
    };

    try {
      if (id) await firebasePut(`${PATHS.parts}/${id}`, payload);
      else await firebasePost(PATHS.parts, payload);
      logActivity(id ? "Equipment part updated" : "Equipment part added", `${payload.equipNo} • ${payload.partName}`);
      await loadFirebaseData();
      resetPartForm();
      showView("warehouse");
      showTab("warehouse", "warehouse-parts");
      toast(id ? "Equipment part updated in Firebase." : "Equipment part saved to Firebase.");
    } catch (err) {
      console.error(err);
      toast(`Firebase write failed: ${err.message}`, true);
    }
  }

  async function saveEquipmentFromForm() {
    if (!requireFirebase()) return;
    const id = $("equipmentRecordId").value;
    const old = state.equipment.find(x => x.id === id);
    const equipmentNo = $("equipmentNo").value.trim();
    const equipmentName = $("equipmentName").value.trim();
    if (!equipmentName || !equipmentNo) return toast("Equipment and Equip No. are required.", true);

    const duplicate = state.equipment.some(x => x.equipmentNo.toLowerCase() === equipmentNo.toLowerCase() && x.id !== id);
    if (duplicate) return toast("Equipment No. already exists.", true);

    const payload = {
      company: $("equipmentCompany").value.trim(),
      createdAt: old?.createdAt || dbNowText(),
      equipNo: equipmentNo,
      equipment: equipmentName,
      location: $("equipmentLocation").value,
      model: $("equipmentModel").value.trim(),
      picture: equipmentImageData,
      serialNo: $("equipmentSerial").value.trim(),
      status: $("equipmentStatus").value,
      etc: $("equipmentEtc").value,
      transferTo: old?.transferTo || "",
      updatedAt: dbNowText(),
      yearModel: $("equipmentYear").value.trim()
    };
    const remarks = $("equipmentRemarks").value.trim();
    if (remarks) payload.remarks = remarks;

    try {
      let savedId = id;
      if (id) {
        await firebasePut(`${PATHS.equipment}/${id}`, payload);
        if (old && old.equipmentNo !== equipmentNo) {
          const linked = state.parts.filter(p => p.equipmentId === id || p.equipmentNo === old.equipmentNo);
          await Promise.all(linked.map(p => firebasePatch(`${PATHS.parts}/${p.id}`, {
            equipNo: equipmentNo,
            equipmentCompany: payload.company,
            equipmentLocation: payload.location,
            equipmentName: payload.equipment,
            updatedAt: dbNowText()
          })));
        }
      } else {
        const result = await firebasePost(PATHS.equipment, payload);
        savedId = result?.name || "";
      }
      logActivity(id ? "Equipment updated" : "Equipment added", `${equipmentNo} • ${equipmentName}`);
      await loadFirebaseData();
      resetEquipmentForm();
      showTab("equipment", "equipment-list");
      toast(id ? "Equipment updated in Firebase." : "Equipment saved to Firebase.");
      return savedId;
    } catch (err) {
      console.error(err);
      toast(`Firebase write failed: ${err.message}`, true);
    }
  }

  function activeConsumableItems() {
    return state.consumables.filter(i => i.dropdownActive !== false)
      .sort((a,b) => consumableDisplayName(a).localeCompare(consumableDisplayName(b)) || String(a.partNumber || "").localeCompare(String(b.partNumber || "")));
  }

  function renderConsumableDropdownManager() {
    const body = $("consumableDropdownManagerBody");
    if (!body) return;
    const rows = activeConsumableItems();
    body.innerHTML = rows.length ? rows.map(i => `
      <tr>
        <td><strong>${escapeHtml(consumableDisplayName(i))}</strong></td>
        <td>${escapeHtml(i.equipmentTag || "All Equipment")}</td>
        <td>${escapeHtml(i.partNumber || "—")}</td>
        <td>${escapeHtml(i.unit)}</td>
        <td>${Number(i.stock).toLocaleString(undefined,{maximumFractionDigits:2})}</td>
        <td><div class="action-group"><button type="button" class="action-btn edit" data-action="edit-consumable-dropdown" data-id="${escapeHtml(i.id)}">Edit</button><button type="button" class="action-btn delete" data-action="delete-consumable-dropdown" data-id="${escapeHtml(i.id)}">Delete</button></div></td>
      </tr>`).join("") : `<tr><td colspan="6" class="table-empty">No dropdown items.</td></tr>`;
  }

  function resetConsumableCatalogForm() {
    $("consumableCatalogItemId").value = "";
    $("newConsumableName").value = "";
    $("newConsumablePartNumber").value = "";
    $("newConsumableEquipmentTag").value = "";
    $("newConsumableUnit").value = $("newConsumableUnit").options[0]?.value || "PCS";
    $("consumableModalTitle").textContent = "Manage Existing Consumables";
    $("consumableModalSubtitle").textContent = "Edit or remove existing consumable records. New items must be created from the IN tab.";
    $("consumableItemSubmit").textContent = "Save Changes";
  }

  function openConsumableModal(item = null) {
    populateConsumableEquipmentTagOptions();
    renderConsumableDropdownManager();
    resetConsumableCatalogForm();
    $("consumableItemForm").classList.toggle("hidden", !item);
    if (item) {
      $("consumableCatalogItemId").value = item.id;
      $("newConsumableName").value = consumableDisplayName(item);
      $("newConsumablePartNumber").value = item.partNumber || "";
      if (item.equipmentId && [...$("newConsumableEquipmentTag").options].some(o => o.value === item.equipmentId)) {
        $("newConsumableEquipmentTag").value = item.equipmentId;
      } else {
        $("newConsumableEquipmentTag").value = "";
      }
      if (![...$("newConsumableUnit").options].some(o => o.value === item.unit)) {
        $("newConsumableUnit").insertAdjacentHTML("beforeend", `<option value="${escapeHtml(item.unit)}">${escapeHtml(item.unit)}</option>`);
      }
      $("newConsumableUnit").value = item.unit;
      $("consumableModalTitle").textContent = "Edit Consumable Dropdown Item";
      $("consumableModalSubtitle").textContent = "Editing the name/unit keeps quantities and dates in the transaction history.";
      $("consumableItemSubmit").textContent = "Save Changes";
    }
    $("consumableModal").classList.remove("hidden");
  }

  async function upsertConsumableCatalog(item, name, unit, partNumber = "", equipment = null, options = {}) {
    const now = dbNowText();
    const equipmentId = equipment?.id || "";
    const equipmentTag = equipment?.equipmentNo || "All Equipment";
    const equipmentName = equipment?.equipmentName || "";
    const displayName = cleanConsumableNameInput(name, partNumber);
    const sourceName = String(options.sourceName || item?.sourceName || buildConsumableStorageName(displayName, partNumber)).trim();
    const payload = {
      sourceName,
      sourceUnit: unit,
      name: displayName,
      originalItemName: String(options.originalItemName || displayName).trim(),
      unit,
      partNumber: String(partNumber || "").trim(),
      equipmentId,
      equipmentTag,
      equipmentName,
      active: true,
      updatedAt: now
    };
    if (item?.catalogId) {
      await firebasePatch(`${PATHS.consumableDropdown}/${item.catalogId}`, payload);
      return item.catalogId;
    }
    payload.createdAt = now;
    const res = await firebasePost(PATHS.consumableDropdown, payload);
    return res?.name || "";
  }

  async function setConsumableDropdownActive(item, active) {
    const now = dbNowText();
    const payload = {
      sourceName: item.sourceName || buildConsumableStorageName(consumableDisplayName(item), item.partNumber || ""),
      sourceUnit: item.sourceUnit || item.unit,
      name: consumableDisplayName(item),
      originalItemName: consumableDisplayName(item),
      unit: item.unit,
      partNumber: item.partNumber || "",
      equipmentId: item.equipmentId || "",
      equipmentTag: item.equipmentTag || "All Equipment",
      equipmentName: item.equipmentName || "",
      active,
      updatedAt: now
    };
    if (item.catalogId) {
      await firebasePatch(`${PATHS.consumableDropdown}/${item.catalogId}`, payload);
    } else {
      payload.createdAt = now;
      await firebasePost(PATHS.consumableDropdown, payload);
    }
  }

  function closeConsumableModal() {
    $("consumableModal").classList.add("hidden");
    $("consumableItemForm").classList.add("hidden");
    resetConsumableCatalogForm();
  }

  function exportBackup() {
    const payload = {
      firebaseDatabase: DB_URL,
      exportedAt: dbNowText(),
      mappedState: state,
      rawConsumableRecords,
      rawConsumableDropdown
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `firebase-inventory-backup-${todayValue()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Firebase view backup exported.");
  }

  function setupEvents() {
    $$(".nav-item").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view)));
    $("menuBtn").addEventListener("click", () => $("sidebar").classList.toggle("open"));
    $$(".tab-btn").forEach(btn => btn.addEventListener("click", () => showTab(btn.dataset.tabGroup, btn.dataset.tab)));

    $("mtpToolsForm").addEventListener("submit", async e => { e.preventDefault(); await saveTool("mtp"); });
    $("mnrToolsForm").addEventListener("submit", async e => { e.preventDefault(); await saveTool("mnr"); });
    $("resetMtpToolBtn").addEventListener("click", () => resetToolForm("mtp"));
    $("resetMnrToolBtn").addEventListener("click", () => resetToolForm("mnr"));
    $("mtpToolsSearch").addEventListener("input", () => renderToolsInventory("mtp"));
    $("mnrToolsSearch").addEventListener("input", () => renderToolsInventory("mnr"));

    $("partsForm").addEventListener("submit", async e => { e.preventDefault(); await savePartFromForm(); });
    $("partName").addEventListener("input", updatePartNameSelection);
    $("partName").addEventListener("change", updatePartNameSelection);
    $("resetPartBtn").addEventListener("click", resetPartForm);
    $("partsSearch").addEventListener("input", renderParts);
    $("partsStatusFilter").addEventListener("change", renderParts);
    $("warehousePartInItem")?.addEventListener("change", () => updateWarehousePartSelection("in"));
    $("warehousePartOutItem")?.addEventListener("change", () => updateWarehousePartSelection("out"));
    $("warehousePartInForm")?.addEventListener("submit", async e => { e.preventDefault(); await saveWarehousePartMovement("in"); });
    $("warehousePartOutForm")?.addEventListener("submit", async e => { e.preventDefault(); await saveWarehousePartMovement("out"); });
    $("warehousePartsSearch")?.addEventListener("input", renderWarehousePartsInventory);

    $("consumableReplenishItem").addEventListener("change", () => populateVariantEquipmentOptions("replenish"));
    $("consumableReplenishEquipmentTag").addEventListener("change", () => updateExactConsumableSelection("replenish"));

    $("consumableOutItem").addEventListener("change", () => populateVariantEquipmentOptions("out"));
    $("consumableOutEquipmentTag").addEventListener("change", () => updateExactConsumableSelection("out"));

    $("consumableInForm").addEventListener("submit", async e => {
      e.preventDefault();
      if (!requireFirebase()) return;

      const rawName = $("consumableInName").value.trim();
      const partNumber = $("consumableInPartNumber").value.trim();
      const displayName = cleanConsumableNameInput(rawName, partNumber);
      const qty = Number($("consumableInQty").value);
      const date = $("consumableInDate").value;
      const unit = $("consumableInUnit").value;
      const equipmentId = $("consumableInEquipmentTag").value;
      const selectedEquipment = equipmentId ? state.equipment.find(equipment => equipment.id === equipmentId) : null;
      const equipmentTag = selectedEquipment?.equipmentNo || "All Equipment";

      if (!displayName) return toast("Item Name is required.", true);
      if (!(qty > 0)) return toast("QTY must be greater than 0.", true);

      const identity = consumableIdentityKey(displayName, partNumber);
      const duplicate = state.consumables.find(i =>
        consumableIdentityKey(consumableDisplayName(i), i.partNumber || "") === identity
      );
      if (duplicate) {
        if (duplicate.dropdownActive === false) {
          return toast("This Item Name + Part Number already exists but is inactive. Restore it in Manage Existing Items.", true);
        }
        return toast("This Item Name + Part Number already exists. Please use Replenish.", true);
      }

      const storageName = buildConsumableStorageName(displayName, partNumber);

      try {
        await firebasePost(PATHS.consumables, consumablePayload(storageName, qty, unit, "IN", date, {
          originalItemName: displayName,
          partNumber,
          equipmentId: selectedEquipment?.id || "",
          equipmentTag,
          equipmentName: selectedEquipment?.equipmentName || "",
          remarks: "Initial stock for new consumable item."
        }));

        await upsertConsumableCatalog(null, displayName, unit, partNumber, selectedEquipment, {
          sourceName: storageName,
          originalItemName: displayName
        });

        logActivity("New consumable item received", `${displayName} • ${partNumber || "No Part Number"} • +${qty} ${unit}`);
        await loadFirebaseData();
        $("consumableInForm").reset();
        $("consumableInEquipmentTag").value = "";
        $("consumableInDate").value = todayValue();
        showView("warehouse");
        showTab("warehouse", "warehouse-consumables");
        toast("New consumable item saved to Firebase.");
      } catch (err) {
        console.error(err);
        toast(`Firebase write failed: ${err.message}`, true);
      }
    });

    $("consumableReplenishForm").addEventListener("submit", async e => {
      e.preventDefault();
      if (!requireFirebase()) return;

      const item = state.consumables.find(i => i.id === $("consumableReplenishEquipmentTag").value);
      const qty = Number($("consumableReplenishQty").value);
      const date = $("consumableReplenishDate").value;
      if (!item) return toast("Please select the existing Item / Part Number and Equipment Tag.", true);
      if (!(qty > 0)) return toast("QTY must be greater than 0.", true);

      try {
        await firebasePost(PATHS.consumables, consumablePayload(item.sourceName || item.name, qty, item.unit, "Replenishment", date, {
          originalItemName: consumableDisplayName(item),
          partNumber: item.partNumber || "",
          equipmentId: item.equipmentId || "",
          equipmentTag: item.equipmentTag || "All Equipment",
          equipmentName: item.equipmentName || "",
          remarks: "Stock replenishment for existing consumable item."
        }));
        logActivity("Consumable replenished", `${consumableDisplayName(item)} • ${item.partNumber || "No Part Number"} • +${qty} ${item.unit}`);
        await loadFirebaseData();
        $("consumableReplenishForm").reset();
        $("consumableReplenishDate").value = todayValue();
        populateConsumableDropdown();
        showView("warehouse");
        showTab("warehouse", "warehouse-consumables");
        toast("Existing consumable stock replenished.");
      } catch (err) {
        console.error(err);
        toast(`Firebase write failed: ${err.message}`, true);
      }
    });

    $("consumableOutForm").addEventListener("submit", async e => {
      e.preventDefault();
      if (!requireFirebase()) return;

      const item = state.consumables.find(i => i.id === $("consumableOutEquipmentTag").value);
      const qty = Number($("consumableOutQty").value);
      if (!item) return toast("Please select the exact Item / Part Number and Equipment Tag.", true);
      if (!(qty > 0)) return toast("QTY must be greater than 0.", true);
      if (qty > Number(item.stock)) return toast(`Insufficient stock. Available: ${item.stock} ${item.unit}`, true);

      try {
        await firebasePost(PATHS.consumables, consumablePayload(item.sourceName || item.name, qty, item.unit, "OUT", todayValue(), {
          originalItemName: consumableDisplayName(item),
          partNumber: item.partNumber || "",
          equipmentId: item.equipmentId || "",
          equipmentTag: item.equipmentTag || "All Equipment",
          equipmentName: item.equipmentName || "",
          remarks: "Stock released from Equipment Inventory System."
        }));
        logActivity("Consumable stock released", `${consumableDisplayName(item)} • ${item.partNumber || "No Part Number"} • -${qty} ${item.unit}`);
        await loadFirebaseData();
        $("consumableOutForm").reset();
        populateConsumableDropdown();
        showView("warehouse");
        showTab("warehouse", "warehouse-consumables");
        toast("Stock release saved to Firebase.");
      } catch (err) {
        console.error(err);
        toast(`Firebase write failed: ${err.message}`, true);
      }
    });

    $("consumableSearch").addEventListener("input", renderConsumables);
    $("addConsumableItemBtn").addEventListener("click", () => {
      showView("consumables");
      showTab("consumables", "consumables-in");
      $("consumableInName").focus();
    });
    $("manageConsumableDropdownBtn").addEventListener("click", () => openConsumableModal());
    $("closeConsumableModal").addEventListener("click", closeConsumableModal);
    $("cancelConsumableModal").addEventListener("click", closeConsumableModal);
    $("consumableModal").addEventListener("click", e => { if (e.target === $("consumableModal")) closeConsumableModal(); });

    $("closeWarehousePartEditModal").addEventListener("click", closeWarehousePartEditModal);
    $("cancelWarehousePartEditModal").addEventListener("click", closeWarehousePartEditModal);
    $("warehousePartEditModal").addEventListener("click", e => { if (e.target === $("warehousePartEditModal")) closeWarehousePartEditModal(); });
    $("warehousePartEditForm").addEventListener("submit", async e => {
      e.preventDefault();
      await saveWarehousePartEdit();
    });

    $("consumableItemForm").addEventListener("submit", async e => {
      e.preventDefault();
      if (!requireFirebase()) return;
      const editId = $("consumableCatalogItemId").value;
      const editing = state.consumables.find(i => i.id === editId);
      const name = $("newConsumableName").value.trim();
      const partNumber = $("newConsumablePartNumber").value.trim();
      const unit = $("newConsumableUnit").value;
      const equipmentId = $("newConsumableEquipmentTag").value;
      const selectedEquipment = equipmentId ? state.equipment.find(equipment => equipment.id === equipmentId) : null;
      const equipmentTag = selectedEquipment?.equipmentNo || "All Equipment";
      if (!name) return toast("Item Name is required.", true);

      const displayName = cleanConsumableNameInput(name, partNumber);
      const identity = consumableIdentityKey(displayName, partNumber);
      const duplicate = state.consumables.find(i => i.id !== editId && consumableIdentityKey(consumableDisplayName(i), i.partNumber || "") === identity);
      if (duplicate && duplicate.dropdownActive !== false) return toast("This Item Name + Part Number already exists.", true);

      try {
        if (editing) {
          const storageName = buildConsumableStorageName(displayName, partNumber);
          const changed = consumableDisplayName(editing) !== displayName || editing.unit !== unit || (editing.partNumber || "") !== partNumber || (editing.equipmentId || "") !== (equipmentId || "");
          if (changed && editing.sourceKeys.length) {
            await Promise.all(editing.sourceKeys.map(key => firebasePatch(`${PATHS.consumables}/${key}`, {
              itemName: storageName,
              originalItemName: displayName,
              unit,
              partNumber,
              equipmentId: selectedEquipment?.id || "",
              equipmentTag,
              equipmentName: selectedEquipment?.equipmentName || "",
              updatedAt: dbNowText()
            })));
          }
          await upsertConsumableCatalog(editing, displayName, unit, partNumber, selectedEquipment, { sourceName: storageName, originalItemName: displayName });
          logActivity("Consumable dropdown item updated", `${consumableDisplayName(editing)} → ${displayName} • ${equipmentTag} • ${unit}`);
          toast("Consumable dropdown item updated.");
        } else {
          const hiddenMatch = state.consumables.find(i => i.dropdownActive === false && consumableIdentityKey(consumableDisplayName(i), i.partNumber || "") === identity);
          if (hiddenMatch) {
            await setConsumableDropdownActive(hiddenMatch, true);
            logActivity("Consumable dropdown item restored", `${displayName} • ${partNumber || "No Part Number"}`);
            toast("Consumable dropdown item restored.");
          } else {
            await upsertConsumableCatalog(null, displayName, unit, partNumber, selectedEquipment, { sourceName: buildConsumableStorageName(displayName, partNumber), originalItemName: displayName });
            logActivity("Consumable dropdown item created", `${displayName} • ${partNumber || "No Part Number"} • ${equipmentTag} • ${unit}`);
            toast("Consumable dropdown item added.");
          }
        }
        await loadFirebaseData();
        renderConsumableDropdownManager();
        resetConsumableCatalogForm();
      } catch (err) {
        console.error(err);
        toast(`Firebase write failed: ${err.message}`, true);
      }
    });

    $("equipmentPicture").addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 1500000) {
        e.target.value = "";
        return toast("Please use an image smaller than 1.5 MB.", true);
      }
      const reader = new FileReader();
      reader.onload = () => showEquipmentImagePreview(reader.result);
      reader.readAsDataURL(file);
    });

    $("removeEquipmentImageBtn").addEventListener("click", () => {
      equipmentImageData = "";
      $("equipmentPicture").value = "";
      hideEquipmentImagePreview();
    });

    $("equipmentForm").addEventListener("submit", async e => { e.preventDefault(); await saveEquipmentFromForm(); });
    $("resetEquipmentBtn").addEventListener("click", resetEquipmentForm);
    $("equipmentSearch").addEventListener("input", renderEquipment);
    $("equipmentStatusFilter").addEventListener("change", renderEquipment);
    $("equipmentLocationFilter").addEventListener("change", renderEquipment);

    $$('[data-dashboard-status]').forEach(card => card.addEventListener('click', () => {
      const status = card.dataset.dashboardStatus || '';
      showView('equipment');
      showTab('equipment', 'equipment-list');
      $("equipmentSearch").value = '';
      $("equipmentLocationFilter").value = '';
      $("equipmentStatusFilter").value = status === 'Operational' ? 'Operational Group' : status;
      renderEquipment();
    }));

    document.addEventListener("click", async e => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const { action, id } = btn.dataset;

      if (action === "edit-mtp-tool") return editTool("mtp", id);
      if (action === "edit-mnr-tool") return editTool("mnr", id);
      if (action === "delete-mtp-tool" || action === "delete-mnr-tool") {
        if (!requireFirebase()) return;
        const type = action.includes("mtp") ? "mtp" : "mnr";
        const c = toolConfig(type);
        const item = c.list.find(x => x.id === id);
        if (!item || !confirm(`Delete ${item.name} from ${type.toUpperCase()} Tools Inventory?`)) return;
        try {
          await firebaseDelete(`${c.path}/${id}`);
          await loadFirebaseData();
          toast(`${type.toUpperCase()} tool / equipment deleted.`);
        } catch (err) { toast(`Firebase delete failed: ${err.message}`, true); }
        return;
      }

      if (action === "edit-part") return editPart(id);
      if (action === "edit-warehouse-part") return openWarehousePartEditModal(id);
      if (action === "delete-warehouse-part") return deleteWarehousePart(id);
      if (action === "edit-equipment") return editEquipment(id);
      if (action === "edit-consumable-dropdown") {
        const item = state.consumables.find(x => x.id === id);
        if (item) openConsumableModal(item);
        return;
      }
      if (action === "delete-consumable-dropdown") {
        if (!requireFirebase()) return;
        const item = state.consumables.find(x => x.id === id);
        if (!item || !confirm(`Remove "${item.name}" from the Consumables Movement dropdown? Existing IN/OUT history will be preserved.`)) return;
        try {
          await setConsumableDropdownActive(item, false);
          logActivity("Consumable dropdown item removed", `${item.name} • ${item.unit}`);
          await loadFirebaseData();
          renderConsumableDropdownManager();
          toast("Item removed from Consumables Movement dropdown. History was preserved.");
        } catch (err) { toast(`Firebase update failed: ${err.message}`, true); }
        return;
      }
      if (action === "restore-consumable-dropdown") {
        if (!requireFirebase()) return;
        const item = state.consumables.find(x => x.id === id);
        if (!item) return;
        try {
          await setConsumableDropdownActive(item, true);
          await loadFirebaseData();
          toast("Item restored to Consumables Movement dropdown.");
        } catch (err) { toast(`Firebase update failed: ${err.message}`, true); }
        return;
      }

      if (action === "delete-part") {
        if (!requireFirebase()) return;
        const p = state.parts.find(x => x.id === id);
        if (!p || !confirm(`Delete ${p.partName} for ${p.equipmentNo} from Firebase?`)) return;
        try {
          await firebaseDelete(`${PATHS.parts}/${id}`);
          logActivity("Equipment part deleted", `${p.equipmentNo} • ${p.partName}`);
          await loadFirebaseData();
          toast("Equipment part deleted from Firebase.");
        } catch (err) { toast(`Firebase delete failed: ${err.message}`, true); }
      }

      if (action === "delete-equipment") {
        if (!requireFirebase()) return;
        const rec = state.equipment.find(x => x.id === id);
        if (!rec) return;
        const linked = state.parts.filter(p => p.equipmentId === rec.id || p.equipmentNo === rec.equipmentNo).length;
        if (linked) return toast(`Cannot delete ${rec.equipmentNo}. It has ${linked} linked Equipment Part record(s).`, true);
        if (!confirm(`Delete ${rec.equipmentNo} - ${rec.equipmentName} from Firebase?`)) return;
        try {
          await firebaseDelete(`${PATHS.equipment}/${id}`);
          logActivity("Equipment deleted", `${rec.equipmentNo} • ${rec.equipmentName}`);
          await loadFirebaseData();
          toast("Equipment deleted from Firebase.");
        } catch (err) { toast(`Firebase delete failed: ${err.message}`, true); }
      }

    });

    $("exportBtn").addEventListener("click", exportBackup);
    $("refreshFirebaseBtn").addEventListener("click", () => loadFirebaseData(true));
  }

  async function init() {
    setupEvents();
    $("consumableInDate").value = todayValue();
    $("consumableReplenishDate").value = todayValue();
    if ($("warehousePartInDate")) $("warehousePartInDate").value = todayValue();
    if ($("warehousePartOutDate")) $("warehousePartOutDate").value = todayValue();
    refreshAll();
    resetPartForm();
    resetEquipmentForm();
    resetToolForm("mtp");
    resetToolForm("mnr");
    await loadFirebaseData();
  }

  init();
})();
