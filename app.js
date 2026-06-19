import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  onValue,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-K1paSxDiVE6h9MVS0vFYihvDzeu8yMc",
  authDomain: "easternwh-14c32.firebaseapp.com",
  databaseURL: "https://easternwh-14c32-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "easternwh-14c32",
  storageBucket: "easternwh-14c32.firebasestorage.app",
  messagingSenderId: "502894254948",
  appId: "1:502894254948:web:0f0dc2b98368fd1d323871",
  measurementId: "G-FWKGTVK2C5"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const recordsRef = ref(db, "heavyEquipmentRecords");
const equipmentRecordsRef = ref(db, "equipmentMasterRecords");

let records = [];
let equipmentRecords = [];
let editingKey = "";
let equipmentEditingKey = "";
let selectedEquipmentPhoto = "";

const pages = document.querySelectorAll(".page");
const navButtons = document.querySelectorAll(".nav-btn");
const recordForm = document.getElementById("recordForm");
const formTitle = document.getElementById("formTitle");
const editIndexInput = document.getElementById("editIndex");
const recordsTable = document.getElementById("recordsTable");
const recentRecords = document.getElementById("recentRecords");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");
const statusInput = document.getElementById("status");
const receivedDatePreview = document.getElementById("receivedDatePreview");
const installedDatePreview = document.getElementById("installedDatePreview");
const pageTitle = document.getElementById("pageTitle");
const quickAddBtn = document.getElementById("quickAddBtn");
const connectionStatus = document.getElementById("connectionStatus");
const recordCount = document.getElementById("recordCount");
const equipNoInput = document.getElementById("equipNo");
const transferToInput = document.getElementById("transferTo");

const equipmentForm = document.getElementById("equipmentForm");
const equipmentFormTitle = document.getElementById("equipmentFormTitle");
const equipmentEditKey = document.getElementById("equipmentEditKey");
const equipmentTable = document.getElementById("equipmentTable");
const clearEquipmentBtn = document.getElementById("clearEquipmentBtn");
const equipmentSearchInput = document.getElementById("equipmentSearchInput");
const equipmentPicture = document.getElementById("equipmentPicture");
const equipmentPhotoPreview = document.getElementById("equipmentPhotoPreview");
const equipmentPhotoPlaceholder = document.getElementById("equipmentPhotoPlaceholder");
const equipmentTransferToInput = document.getElementById("equipmentTransferTo");

function showPage(pageId) {
  if (typeof window.openEasternPage === "function") {
    window.openEasternPage(pageId);
  } else {
    pages.forEach(page => page.classList.remove("active-page"));
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add("active-page");

    navButtons.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.page === pageId);
    });
  }

  const titles = {
    dashboardPage: "Dashboard",
    addRecordPage: editingKey ? "Edit Equipment Part" : "Add Equipment Parts",
    recordsPage: "Equipment Parts Summary",
    equipmentRecordPage: "Equipment Record"
  };
  if (pageTitle) pageTitle.textContent = titles[pageId] || "Dashboard";
  renderAll();
}

navButtons.forEach(button => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

if (quickAddBtn) {
  quickAddBtn.addEventListener("click", () => {
    resetForm();
    showPage("addRecordPage");
  });
}

function getCurrentDateTime() {
  const now = new Date();
  return now.toLocaleString("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getStatusBadge(status) {
  const normalizedStatus = normalizeStatus(status);
  const safeStatus = escapeHTML(normalizedStatus);
  const className = normalizedStatus
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `<span class="status-badge status-${className}">${safeStatus}</span>`;
}

function normalizeDate(value) {
  return value && String(value).trim() !== "" ? value : "-";
}

function normalizeStatus(status) {
  const statusMap = {
    "Pending": "Pending for approval",
    "Received": "Received stored at warehouse"
  };
  return statusMap[status] || status || "Pending for approval";
}

function getDaysPending(record) {
  const status = normalizeStatus(record.status);
  if (!record.prDate || status === "Installed") return "-";
  const start = new Date(record.prDate + "T00:00:00");
  const end = record.receivedDate && status !== "Pending for approval" && status !== "Approved waiting for delivery" ? new Date(record.receivedDate) : new Date();
  if (Number.isNaN(start.getTime())) return "-";
  const diff = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
  return `${diff} day${diff === 1 ? "" : "s"}`;
}

function getRecordByKey(key) {
  return records.find(record => record.id === key) || null;
}

function updateDatePreview() {
  const status = statusInput.value;
  const existingRecord = editingKey ? getRecordByKey(editingKey) : null;

  let receivedText = existingRecord?.receivedDate || "Automatic";
  let installedText = existingRecord?.installedDate || "Automatic";

  if (!existingRecord) {
    if (status === "Received stored at warehouse") receivedText = "Will auto-save when submitted";
    if (status === "Installed") {
      receivedText = "Will auto-save when submitted";
      installedText = "Will auto-save when submitted";
    }
  } else {
    if ((status === "Received stored at warehouse" || status === "Installed") && !existingRecord.receivedDate) {
      receivedText = "Will auto-save when submitted";
    }
    if (status === "Installed" && !existingRecord.installedDate) {
      installedText = "Will auto-save when submitted";
    }
  }

  receivedDatePreview.textContent = receivedText;
  installedDatePreview.textContent = installedText;
}

statusInput.addEventListener("change", updateDatePreview);

recordForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const oldRecord = editingKey ? getRecordByKey(editingKey) : null;
  const selectedStatus = statusInput.value;

  let receivedDate = oldRecord?.receivedDate || "";
  let installedDate = oldRecord?.installedDate || "";

  if ((selectedStatus === "Received stored at warehouse" || selectedStatus === "Installed") && !receivedDate) {
    receivedDate = getCurrentDateTime();
  }

  if (selectedStatus === "Installed" && !installedDate) {
    installedDate = getCurrentDateTime();
  }

  const selectedEquipment = getEquipmentByEquipNo(equipNoInput.value);
  const newTransferTo = transferToInput?.value || "";
  let transferDate = oldRecord?.transferDate || "";

  if (newTransferTo && newTransferTo !== (oldRecord?.transferTo || "")) {
    transferDate = getCurrentDateTime();
  }

  if (!newTransferTo) {
    transferDate = "";
  }

  const record = {
    equipNo: equipNoInput.value || "",
    transferTo: newTransferTo,
    transferDate,
    equipmentName: selectedEquipment?.equipment || oldRecord?.equipmentName || "",
    equipmentLocation: selectedEquipment?.location || oldRecord?.equipmentLocation || "",
    equipmentCompany: selectedEquipment?.company || oldRecord?.equipmentCompany || "",
    partName: document.getElementById("partName").value.trim(),
    partNumber: document.getElementById("partNumber").value.trim(),
    prNo: document.getElementById("prNo").value.trim(),
    supplier: document.getElementById("supplier").value.trim(),
    prDate: document.getElementById("prDate").value,
    qty: document.getElementById("qty").value,
    unit: document.getElementById("unit").value.trim(),
    remarks: document.getElementById("remarks").value.trim(),
    status: selectedStatus,
    receivedDate,
    installedDate,
    updatedAt: getCurrentDateTime()
  };

  try {
    if (editingKey) {
      await update(ref(db, `heavyEquipmentRecords/${editingKey}`), record);
    } else {
      record.createdAt = getCurrentDateTime();
      const newRecordRef = push(recordsRef);
      await set(newRecordRef, record);
    }

    resetForm();
    showPage("recordsPage");
  } catch (error) {
    alert("Firebase save failed: " + error.message);
  }
});

function resetForm() {
  recordForm.reset();
  renderEquipmentDropdown();
  renderTransferToDropdown();
  editIndexInput.value = "";
  editingKey = "";
  formTitle.textContent = "Add Equipment Parts";
  pageTitle.textContent = "Add Equipment Parts";
  statusInput.value = "Pending for approval";
  receivedDatePreview.textContent = "Automatic";
  installedDatePreview.textContent = "Automatic";
}

clearBtn.addEventListener("click", resetForm);

function editRecord(key) {
  const record = getRecordByKey(key);
  if (!record) return;

  setEquipNoSelection(record.equipNo || "");
  setTransferToSelection(record.transferTo || "");
  document.getElementById("partName").value = record.partName || "";
  document.getElementById("partNumber").value = record.partNumber || "";
  document.getElementById("prNo").value = record.prNo || "";
  document.getElementById("supplier").value = record.supplier || "";
  document.getElementById("prDate").value = record.prDate || "";
  document.getElementById("qty").value = record.qty || "";
  document.getElementById("unit").value = record.unit || "";
  document.getElementById("remarks").value = record.remarks || "";
  statusInput.value = normalizeStatus(record.status);

  editIndexInput.value = key;
  editingKey = key;
  formTitle.textContent = "Edit Equipment Part";
  pageTitle.textContent = "Edit Equipment Part";
  receivedDatePreview.textContent = normalizeDate(record.receivedDate);
  installedDatePreview.textContent = normalizeDate(record.installedDate);

  showPage("addRecordPage");
}

async function deleteRecord(key) {
  if (!confirm("Are you sure you want to delete this record?")) return;

  try {
    await remove(ref(db, `heavyEquipmentRecords/${key}`));
  } catch (error) {
    alert("Firebase delete failed: " + error.message);
  }
}

window.editRecord = editRecord;
window.deleteRecord = deleteRecord;

function getFilteredRecords() {
  const searchTerm = searchInput.value.toLowerCase();
  const selectedStatus = statusFilter.value;

  // Do not display records until the user selects a status filter.
  if (!selectedStatus) return [];

  return records.filter(record => {
    const matchesSearch =
      String(record.equipNo || "").toLowerCase().includes(searchTerm) ||
      String(record.transferTo || "").toLowerCase().includes(searchTerm) ||
      String(record.partName || "").toLowerCase().includes(searchTerm) ||
      String(record.partNumber || "").toLowerCase().includes(searchTerm) ||
      String(record.prNo || "").toLowerCase().includes(searchTerm) ||
      String(record.supplier || "").toLowerCase().includes(searchTerm) ||
      String(record.remarks || "").toLowerCase().includes(searchTerm);

    const matchesStatus = selectedStatus === "All" || normalizeStatus(record.status) === selectedStatus;
    return matchesSearch && matchesStatus;
  });
}

function renderRecordsTable() {
  const selectedStatus = statusFilter.value;

  if (!selectedStatus) {
    if(recordCount) recordCount.textContent='Total Records: 0';
    recordsTable.innerHTML = `<tr><td class="empty-row" colspan="15">Please select a status to view records.</td></tr>`;
    return;
  }

  const filteredRecords = getFilteredRecords();

  if (filteredRecords.length === 0) {
    if(recordCount) recordCount.textContent='Total Records: 0';
    recordsTable.innerHTML = `<tr><td class="empty-row" colspan="15">No records found.</td></tr>`;
    return;
  }

  if(recordCount) recordCount.textContent = `Total Records: ${filteredRecords.length}`;

  recordsTable.innerHTML = filteredRecords.map(record => `
    <tr>
      <td>${escapeHTML(record.equipNo || "")}</td>
      <td>${escapeHTML(record.partName || "")}</td>
      <td>${escapeHTML(record.partNumber || "-")}</td>
      <td>${escapeHTML(record.prNo)}</td>
      <td>${escapeHTML(record.supplier || "-")}</td>
      <td>${escapeHTML(record.prDate)}</td>
      <td>${escapeHTML(record.qty)}</td>
      <td>${escapeHTML(record.unit)}</td>
      <td>${escapeHTML(record.remarks || "-")}</td>
      <td>${getStatusBadge(record.status)}</td>
      <td>${escapeHTML(normalizeDate(record.receivedDate))}</td>
      <td>${escapeHTML(normalizeDate(record.installedDate))}</td>
      <td>${escapeHTML(normalizeDate(record.transferDate))}</td>
      <td>${escapeHTML(record.transferTo || "")}</td>
      <td>
        <button class="edit-btn" onclick="editRecord('${record.id}')">Edit</button>
        <button class="danger-btn" onclick="deleteRecord('${record.id}')">Delete</button>
      </td>
    </tr>
  `).join("");
}

function renderDashboard() {
  const pendingApproval = records.filter(r => normalizeStatus(r.status) === "Pending for approval").length;
  const approvedWaiting = records.filter(r => normalizeStatus(r.status) === "Approved waiting for delivery").length;
  const receivedWarehouse = records.filter(r => normalizeStatus(r.status) === "Received stored at warehouse").length;
  const installed = records.filter(r => normalizeStatus(r.status) === "Installed").length;

  const pendingApprovalEl = document.getElementById("pendingApprovalCount");
  const approvedWaitingEl = document.getElementById("approvedWaitingCount");
  const receivedWarehouseEl = document.getElementById("receivedWarehouseCount");
  const installedEl = document.getElementById("installedCount");

  if (pendingApprovalEl) pendingApprovalEl.textContent = pendingApproval;
  if (approvedWaitingEl) approvedWaitingEl.textContent = approvedWaiting;
  if (receivedWarehouseEl) receivedWarehouseEl.textContent = receivedWarehouse;
  if (installedEl) installedEl.textContent = installed;

  const latest = [...records].slice(-5).reverse();

  if (latest.length === 0) {
    recentRecords.innerHTML = `<tr><td class="empty-row" colspan="7">No recent records yet.</td></tr>`;
    return;
  }

  recentRecords.innerHTML = latest.map(record => `
    <tr>
      <td>${escapeHTML(record.equipNo || "")}</td>
      <td>${escapeHTML(record.transferTo || "")}</td>
      <td>${escapeHTML(record.partName || "")}</td>
      <td>${escapeHTML(record.prNo)}</td>
      <td>${getStatusBadge(record.status)}</td>
      <td>${escapeHTML(normalizeDate(record.receivedDate))}</td>
      <td>${escapeHTML(normalizeDate(record.installedDate))}</td>
    </tr>
  `).join("");
}

function renderAll() {
  renderEquipmentDropdown();
  renderDashboard();
  renderRecordsTable();
  renderEquipmentTable();
}

searchInput.addEventListener("input", renderRecordsTable);
statusFilter.addEventListener("change", renderRecordsTable);

exportBtn.addEventListener("click", function () {
  if (records.length === 0) {
    alert("No records to export.");
    return;
  }

  const headers = [
    "Equip No", "Part Name", "Part Number", "PR No", "Supplier", "PR Date",
    "Days Pending", "QTY", "Unit", "Remarks", "Status", "Received Date", "Installed Date",
    "Transfer Date", "Transfer To"
  ];

  const rows = records.map(record => [
    record.equipNo || "",
    record.partName || "",
    record.partNumber,
    record.prNo,
    record.supplier,
    record.prDate,
    getDaysPending(record),
    record.qty,
    record.unit,
    record.remarks,
    normalizeStatus(record.status),
    record.receivedDate,
    record.installedDate,
    record.transferDate || "",
    record.transferTo || ""
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(value => `"${String(value || "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "heavy_equipment_records.csv";
  link.click();
});


function getEquipmentByEquipNo(equipNo) {
  return equipmentRecords.find(record => String(record.equipNo || "") === String(equipNo || "")) || null;
}

function renderEquipmentDropdown(selectedValue = equipNoInput?.value || "") {
  if (!equipNoInput) return;

  const uniqueEquipment = [];
  const seen = new Set();

  equipmentRecords
    .filter(record => record.equipNo)
    .sort((a, b) => String(a.equipNo).localeCompare(String(b.equipNo)))
    .forEach(record => {
      const key = String(record.equipNo);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEquipment.push(record);
      }
    });

  const options = [
    `<option value="">${uniqueEquipment.length ? "Select equipment from Equipment Record" : "No equipment record yet - add equipment first"}</option>`
  ];

  uniqueEquipment.forEach(record => {
    const labelParts = [record.equipNo, record.equipment, record.location].filter(Boolean);
    options.push(`<option value="${escapeHTML(record.equipNo)}">${escapeHTML(labelParts.join(" - "))}</option>`);
  });

  if (selectedValue && !seen.has(String(selectedValue))) {
    options.push(`<option value="${escapeHTML(selectedValue)}">${escapeHTML(selectedValue)} - not in Equipment Record</option>`);
  }

  equipNoInput.innerHTML = options.join("");
  equipNoInput.value = selectedValue || "";
}

function setEquipNoSelection(value) {
  renderEquipmentDropdown(value);
}

function buildEquipmentOptions(selectedValue = "", emptyLabel = "Select transfer equipment from Equipment Record") {
  const uniqueEquipment = [];
  const seen = new Set();

  equipmentRecords
    .filter(record => record.equipNo)
    .sort((a, b) => String(a.equipNo).localeCompare(String(b.equipNo)))
    .forEach(record => {
      const key = String(record.equipNo);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEquipment.push(record);
      }
    });

  const options = [
    `<option value="">${uniqueEquipment.length ? emptyLabel : "No equipment record yet - add equipment first"}</option>`
  ];

  uniqueEquipment.forEach(record => {
    const labelParts = [record.equipNo, record.equipment, record.location].filter(Boolean);
    options.push(`<option value="${escapeHTML(record.equipNo)}">${escapeHTML(labelParts.join(" - "))}</option>`);
  });

  if (selectedValue && !seen.has(String(selectedValue))) {
    options.push(`<option value="${escapeHTML(selectedValue)}">${escapeHTML(selectedValue)} - not in Equipment Record</option>`);
  }

  return options.join("");
}

function renderTransferToDropdown(selectedValue = transferToInput?.value || "") {
  if (!transferToInput) return;
  transferToInput.innerHTML = buildEquipmentOptions(selectedValue, "Select transfer equipment from Equipment Record");
  transferToInput.value = selectedValue || "";
}

function setTransferToSelection(value) {
  renderTransferToDropdown(value);
}

function renderEquipmentTransferToDropdown(selectedValue = equipmentTransferToInput?.value || "") {
  if (!equipmentTransferToInput) return;
  equipmentTransferToInput.innerHTML = buildEquipmentOptions(selectedValue, "Select transfer equipment from Equipment Record");
  equipmentTransferToInput.value = selectedValue || "";
}

function setEquipmentTransferToSelection(value) {
  renderEquipmentTransferToDropdown(value);
}

function getEquipmentByKey(key) {
  return equipmentRecords.find(record => record.id === key) || null;
}

function setEquipmentPhotoPreview(photoData) {
  selectedEquipmentPhoto = photoData || "";
  if (!equipmentPhotoPreview || !equipmentPhotoPlaceholder) return;

  if (selectedEquipmentPhoto) {
    equipmentPhotoPreview.src = selectedEquipmentPhoto;
    equipmentPhotoPreview.classList.remove("hidden");
    equipmentPhotoPlaceholder.style.display = "none";
  } else {
    equipmentPhotoPreview.removeAttribute("src");
    equipmentPhotoPreview.classList.add("hidden");
    equipmentPhotoPlaceholder.style.display = "block";
  }
}

function resetEquipmentForm() {
  if (!equipmentForm) return;
  equipmentForm.reset();
  equipmentEditingKey = "";
  if (equipmentEditKey) equipmentEditKey.value = "";
  if (equipmentFormTitle) equipmentFormTitle.textContent = "Equipment Record Input";
  setEquipmentPhotoPreview("");
  renderEquipmentTransferToDropdown();
}

if (equipmentPicture) {
  equipmentPicture.addEventListener("change", function () {
    const file = equipmentPicture.files && equipmentPicture.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file only.");
      equipmentPicture.value = "";
      return;
    }

    if (file.size > 750 * 1024) {
      alert("Photo is too large. Please upload an image below 750 KB for Firebase Realtime Database.");
      equipmentPicture.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
      setEquipmentPhotoPreview(event.target.result);
    };
    reader.readAsDataURL(file);
  });
}

if (equipmentForm) {
  equipmentForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const oldRecord = equipmentEditingKey ? getEquipmentByKey(equipmentEditingKey) : null;
    const equipmentRecord = {
      equipment: document.getElementById("equipmentName").value.trim(),
      equipNo: document.getElementById("equipmentNo").value.trim(),
      location: document.getElementById("equipmentLocation").value.trim(),
      transferTo: equipmentTransferToInput?.value || "",
      company: document.getElementById("equipmentCompany").value.trim(),
      picture: selectedEquipmentPhoto || oldRecord?.picture || "",
      model: document.getElementById("equipmentModel").value.trim(),
      yearModel: document.getElementById("equipmentYearModel").value,
      serialNo: document.getElementById("equipmentSerialNo").value.trim(),
      status: document.getElementById("equipmentStatus").value,
      updatedAt: getCurrentDateTime()
    };

    try {
      if (equipmentEditingKey) {
        await update(ref(db, `equipmentMasterRecords/${equipmentEditingKey}`), equipmentRecord);
      } else {
        equipmentRecord.createdAt = getCurrentDateTime();
        const newEquipmentRef = push(equipmentRecordsRef);
        await set(newEquipmentRef, equipmentRecord);
      }
      resetEquipmentForm();
      showPage("equipmentRecordPage");
    } catch (error) {
      alert("Firebase equipment save failed: " + error.message);
    }
  });
}

if (clearEquipmentBtn) clearEquipmentBtn.addEventListener("click", resetEquipmentForm);
if (equipmentSearchInput) equipmentSearchInput.addEventListener("input", renderEquipmentTable);

function editEquipmentRecord(key) {
  const record = getEquipmentByKey(key);
  if (!record) return;

  document.getElementById("equipmentName").value = record.equipment || "";
  document.getElementById("equipmentNo").value = record.equipNo || "";
  document.getElementById("equipmentLocation").value = record.location || "";
  setEquipmentTransferToSelection(record.transferTo || "");
  document.getElementById("equipmentCompany").value = record.company || "";
  document.getElementById("equipmentModel").value = record.model || "";
  document.getElementById("equipmentYearModel").value = record.yearModel || "";
  document.getElementById("equipmentSerialNo").value = record.serialNo || "";
  document.getElementById("equipmentStatus").value = normalizeEquipmentStatus(record.status);

  equipmentEditingKey = key;
  if (equipmentEditKey) equipmentEditKey.value = key;
  if (equipmentFormTitle) equipmentFormTitle.textContent = "Edit Equipment Record";
  setEquipmentPhotoPreview(record.picture || "");
  showPage("equipmentRecordPage");
}

async function deleteEquipmentRecord(key) {
  if (!confirm("Are you sure you want to delete this equipment record?")) return;
  try {
    await remove(ref(db, `equipmentMasterRecords/${key}`));
  } catch (error) {
    alert("Firebase equipment delete failed: " + error.message);
  }
}

window.editEquipmentRecord = editEquipmentRecord;
window.deleteEquipmentRecord = deleteEquipmentRecord;

function normalizeEquipmentStatus(status) {
  const map = {
    "Standby": "Refurbishing",
    "Under Repair": "Under Repair/Maintenance",
    "Maintenance": "Under Repair/Maintenance"
  };
  return map[status] || status || "Operational";
}

function getEquipmentStatusBadge(status) {
  const safeStatus = escapeHTML(normalizeEquipmentStatus(status));
  const slug = safeStatus.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `<span class="status-badge equipment-status-${slug}">${safeStatus}</span>`;
}

function getFilteredEquipmentRecords() {
  const searchTerm = (equipmentSearchInput?.value || "").toLowerCase();
  return equipmentRecords.filter(record => {
    return String(record.equipment || "").toLowerCase().includes(searchTerm) ||
      String(record.equipNo || "").toLowerCase().includes(searchTerm) ||
      String(record.location || "").toLowerCase().includes(searchTerm) ||
      String(record.transferTo || "").toLowerCase().includes(searchTerm) ||
      String(record.company || "").toLowerCase().includes(searchTerm) ||
      String(record.model || "").toLowerCase().includes(searchTerm) ||
      String(record.serialNo || "").toLowerCase().includes(searchTerm) ||
      String(record.status || "").toLowerCase().includes(searchTerm);
  });
}

function renderEquipmentTable() {
  if (!equipmentTable) return;
  const filtered = getFilteredEquipmentRecords();
  if (filtered.length === 0) {
    equipmentTable.innerHTML = `<tr><td class="empty-row" colspan="11">No equipment records found.</td></tr>`;
    return;
  }

  equipmentTable.innerHTML = filtered.map(record => `
    <tr>
      <td>${record.picture ? `<img class="equipment-thumb" src="${record.picture}" alt="Equipment photo">` : `<span class="no-photo">No photo</span>`}</td>
      <td>${escapeHTML(record.equipment)}</td>
      <td>${escapeHTML(record.equipNo)}</td>
      <td>${escapeHTML(record.location || "")}</td>
      <td>${escapeHTML(record.transferTo || "")}</td>
      <td>${escapeHTML(record.company || "")}</td>
      <td>${escapeHTML(record.model)}</td>
      <td>${escapeHTML(record.yearModel)}</td>
      <td>${escapeHTML(record.serialNo)}</td>
      <td>${getEquipmentStatusBadge(record.status)}</td>
      <td>
        <button class="edit-btn" onclick="editEquipmentRecord('${record.id}')">Edit</button>
        <button class="danger-btn" onclick="deleteEquipmentRecord('${record.id}')">Delete</button>
      </td>
    </tr>
  `).join("");
}


onValue(recordsRef, snapshot => {
  const data = snapshot.val() || {};
  records = Object.entries(data).map(([id, value]) => ({ id, ...value }));
  connectionStatus.textContent = "Connected";
  connectionStatus.style.color = "#86efac";
  renderAll();
  updateDatePreview();
}, error => {
  connectionStatus.textContent = "Connection failed";
  connectionStatus.style.color = "#fca5a5";
  alert("Firebase connection failed: " + error.message);
});

onValue(equipmentRecordsRef, snapshot => {
  const data = snapshot.val() || {};
  equipmentRecords = Object.entries(data).map(([id, value]) => ({ id, ...value }));
  renderEquipmentDropdown();
  renderTransferToDropdown();
  renderEquipmentTransferToDropdown();
  renderEquipmentTable();
}, error => {
  alert("Firebase equipment records connection failed: " + error.message);
});

renderAll();
updateDatePreview();


// record count helper
function updateRecordCounter(count){ if(recordCount) recordCount.textContent = `Total Records: ${count}`; }
