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
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
const auth = getAuth(app);
const recordsRef = ref(db, "heavyEquipmentRecords");
const equipmentRecordsRef = ref(db, "equipmentMasterRecords");
const motorpoolConsumablesRef = ref(db, "motorpoolConsumables");
const motorpoolToolsRef = ref(db, "motorpoolTools");

let records = [];
let equipmentRecords = [];
let motorpoolConsumables = [];
let motorpoolTools = [];
let editingKey = "";
let equipmentEditingKey = "";
let selectedEquipmentPhoto = "";
let consumableEditingKey = "";
let consumableInventoryEditContext = null;
let toolEditingKey = "";
let selectedToolPhoto = "";

const loginScreen = document.getElementById("loginScreen");
const appShell = document.getElementById("appShell");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");
const logoutBtn = document.getElementById("logoutBtn");
const loggedUser = document.getElementById("loggedUser");
let firebaseListenersStarted = false;
let firebaseUnsubscribers = [];

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
const equipmentNameFilter = document.getElementById("equipmentNameFilter");
const equipmentLocationFilter = document.getElementById("equipmentLocationFilter");
const equipmentStatusFilter = document.getElementById("equipmentStatusFilter");
const equipmentRecordCount = document.getElementById("equipmentRecordCount");
const equipmentPicture = document.getElementById("equipmentPicture");
const equipmentPhotoPreview = document.getElementById("equipmentPhotoPreview");
const equipmentPhotoPlaceholder = document.getElementById("equipmentPhotoPlaceholder");
const equipmentTransferToInput = document.getElementById("equipmentTransferTo");

const consumableForm = document.getElementById("consumableForm");
const consumableFormTitle = document.getElementById("consumableFormTitle");
const consumableEditKey = document.getElementById("consumableEditKey");
const consumableTable = document.getElementById("consumableTable");
const consumableSummaryTable = document.getElementById("consumableSummaryTable");
const consumableInventorySearchInput = document.getElementById("consumableInventorySearchInput");
const consumableSearchInput = document.getElementById("consumableSearchInput");
const consumableTypeFilter = document.getElementById("consumableTypeFilter");
const consumableDateFrom = document.getElementById("consumableDateFrom");
const consumableDateTo = document.getElementById("consumableDateTo");
const consumableCount = document.getElementById("consumableCount");
const clearConsumableBtn = document.getElementById("clearConsumableBtn");
const exportConsumablesBtn = document.getElementById("exportConsumablesBtn");
const newConsumableItemBtn = document.getElementById("newConsumableItemBtn");
const consumableTransactionPanel = document.getElementById("consumableTransactionPanel");
const consumableTypeDisplay = document.getElementById("consumableTypeDisplay");
const saveConsumableBtn = document.getElementById("saveConsumableBtn");

const toolForm = document.getElementById("toolForm");
const toolFormTitle = document.getElementById("toolFormTitle");
const toolEditKey = document.getElementById("toolEditKey");
const toolTable = document.getElementById("toolTable");
const clearToolBtn = document.getElementById("clearToolBtn");
const toolSearchInput = document.getElementById("toolSearchInput");
const toolCategoryFilter = document.getElementById("toolCategoryFilter");
const toolLocationFilter = document.getElementById("toolLocationFilter");
const toolStatusFilter = document.getElementById("toolStatusFilter");
const toolRecordCount = document.getElementById("toolRecordCount");
const toolPicture = document.getElementById("toolPicture");
const toolPhotoPreview = document.getElementById("toolPhotoPreview");
const toolPhotoPlaceholder = document.getElementById("toolPhotoPlaceholder");

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
    equipmentRecordPage: "Equipment Record",
    motorpoolConsumablesPage: "Motorpool Consumables"
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


function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showDateError(input) {
  alert("Error in date. Future dates are not allowed. Please enter today's date or an earlier date.");
  input.value = "";
  input.focus();
}

function validateNoFutureDateInput(input) {
  if (!input || !input.value) return true;
  const today = getTodayDateString();
  if (input.value > today) {
    showDateError(input);
    return false;
  }
  return true;
}

function validateNoFutureDatesInForm(form) {
  const dateInputs = form ? Array.from(form.querySelectorAll('input[type="date"]')) : [];
  for (const input of dateInputs) {
    if (!validateNoFutureDateInput(input)) return false;
  }
  return true;
}

function applyNoFutureDateRules() {
  const today = getTodayDateString();
  document.querySelectorAll('input[type="date"]').forEach(input => {
    input.max = today;
    input.removeEventListener("change", input._noFutureDateHandler || (() => {}));
    input._noFutureDateHandler = function () {
      validateNoFutureDateInput(this);
    };
    input.addEventListener("change", input._noFutureDateHandler);
    input.addEventListener("blur", input._noFutureDateHandler);
  });
}

document.addEventListener("DOMContentLoaded", applyNoFutureDateRules);

function normalizeDate(value) {
  return value && String(value).trim() !== "" ? value : "-";
}

function normalizeStatus(status) {
  const statusMap = {
    "Pending": "Pending for approval",
    "Received": "Received stored at warehouse"
  };
  return statusMap[status] || status || "";
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
  if (receivedDatePreview) receivedDatePreview.textContent = document.getElementById("receivedDateInput")?.value || "Manual calendar";
  if (installedDatePreview) installedDatePreview.textContent = document.getElementById("installedDateInput")?.value || "Manual calendar";
}

if (statusInput) statusInput.addEventListener("change", updateDatePreview);

recordForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  if (!validateNoFutureDatesInForm(recordForm)) return;

  const oldRecord = editingKey ? getRecordByKey(editingKey) : null;
  const selectedStatus = statusInput.value;

  const receivedDate = document.getElementById("receivedDateInput")?.value || "";
  const installedDate = document.getElementById("installedDateInput")?.value || "";

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
    const first=document.querySelector("#recordForm input, #recordForm select, #recordForm textarea"); if(first) first.focus();
    showPage("addRecordPage");
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
  const receivedDateInput = document.getElementById("receivedDateInput");
  const installedDateInput = document.getElementById("installedDateInput");
  if (receivedDateInput) receivedDateInput.value = "";
  if (installedDateInput) installedDateInput.value = "";
  if (receivedDatePreview) receivedDatePreview.textContent = "Manual calendar";
  if (installedDatePreview) installedDatePreview.textContent = "Manual calendar";
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
  if(receivedDateInput) receivedDateInput.value = (record.receivedDate || "").split(" ")[0];
  if(installedDateInput) installedDateInput.value = (record.installedDate || "").split(" ")[0];

  editIndexInput.value = key;
  editingKey = key;
  formTitle.textContent = "Edit Equipment Part";
  pageTitle.textContent = "Edit Equipment Part";
  if (receivedDatePreview) receivedDatePreview.textContent = normalizeDate(record.receivedDate);
  if (installedDatePreview) installedDatePreview.textContent = normalizeDate(record.installedDate);

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
  const readyPickup = records.filter(r => normalizeStatus(r.status) === "Ready for Pick Up").length;
  const machiningFabrication = records.filter(r => normalizeStatus(r.status) === "For Machining/Fabrication").length;
  const receivedWarehouse = records.filter(r => normalizeStatus(r.status) === "Received stored at warehouse").length;
  const installed = records.filter(r => normalizeStatus(r.status) === "Installed").length;

  const pendingApprovalEl = document.getElementById("pendingApprovalCount");
  const approvedWaitingEl = document.getElementById("approvedWaitingCount");
  const readyPickupEl = document.getElementById("readyPickupCount");
  const machiningFabricationEl = document.getElementById("machiningFabricationCount");
  const receivedWarehouseEl = document.getElementById("receivedWarehouseCount");
  const installedEl = document.getElementById("installedCount");

  if (pendingApprovalEl) pendingApprovalEl.textContent = pendingApproval;
  if (approvedWaitingEl) approvedWaitingEl.textContent = approvedWaiting;
  if (readyPickupEl) readyPickupEl.textContent = readyPickup;
  if (machiningFabricationEl) machiningFabricationEl.textContent = machiningFabrication;
  if (receivedWarehouseEl) receivedWarehouseEl.textContent = receivedWarehouse;
  if (installedEl) installedEl.textContent = installed;

  const latest = records.filter(r => normalizeStatus(r.status) !== "Spare Parts").slice(-5).reverse();

  if (latest.length === 0) {
    recentRecords.innerHTML = `<tr><td class="empty-row" colspan="5">No recent records yet.</td></tr>`;
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
  renderConsumables();
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
    if (!validateNoFutureDatesInForm(equipmentForm)) return;

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
if (equipmentNameFilter) equipmentNameFilter.addEventListener("change", renderEquipmentTable);
if (equipmentLocationFilter) equipmentLocationFilter.addEventListener("change", renderEquipmentTable);
if (equipmentStatusFilter) equipmentStatusFilter.addEventListener("change", renderEquipmentTable);

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
    "Standby": "Ongoing Rehabilitation",
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

function setSelectOptions(selectElement, values, defaultLabel, currentValue = "") {
  if (!selectElement) return;
  const uniqueValues = [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  selectElement.innerHTML = [`<option value="">${escapeHTML(defaultLabel)}</option>`,
    ...uniqueValues.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`)]
    .join("");
  if (currentValue && uniqueValues.includes(currentValue)) selectElement.value = currentValue;
}

function populateEquipmentReportFilters() {
  setSelectOptions(
    equipmentNameFilter,
    equipmentRecords.map(record => record.equipment),
    "All Equipment",
    equipmentNameFilter?.value || ""
  );

  setSelectOptions(
    equipmentLocationFilter,
    equipmentRecords.map(record => record.location),
    "All Locations",
    equipmentLocationFilter?.value || ""
  );
}

function getFilteredEquipmentRecords() {
  const searchTerm = (equipmentSearchInput?.value || "").toLowerCase();
  const selectedEquipment = equipmentNameFilter?.value || "";
  const selectedLocation = equipmentLocationFilter?.value || "";
  const selectedStatus = equipmentStatusFilter?.value || "";

  return equipmentRecords.filter(record => {
    const normalizedStatus = normalizeEquipmentStatus(record.status);
    if (normalizedStatus === "Spare Parts") return false;
    const matchesSearch =
      String(record.equipment || "").toLowerCase().includes(searchTerm) ||
      String(record.equipNo || "").toLowerCase().includes(searchTerm) ||
      String(record.location || "").toLowerCase().includes(searchTerm) ||
      String(record.transferTo || "").toLowerCase().includes(searchTerm) ||
      String(record.company || "").toLowerCase().includes(searchTerm) ||
      String(record.model || "").toLowerCase().includes(searchTerm) ||
      String(record.serialNo || "").toLowerCase().includes(searchTerm) ||
      String(normalizedStatus || "").toLowerCase().includes(searchTerm);

    const matchesEquipment = !selectedEquipment || record.equipment === selectedEquipment;
    const matchesLocation = !selectedLocation || record.location === selectedLocation;
    const matchesStatus = !selectedStatus || normalizedStatus === selectedStatus;

    return matchesSearch && matchesEquipment && matchesLocation && matchesStatus;
  });
}

function renderEquipmentTable() {
  if (!equipmentTable) return;
  const filtered = getFilteredEquipmentRecords();
  if (equipmentRecordCount) equipmentRecordCount.textContent = filtered.length;
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

function getToolByKey(key) {
  return motorpoolTools.find(record => record.id === key) || null;
}

function setToolPhotoPreview(photoData) {
  selectedToolPhoto = photoData || "";
  if (!toolPhotoPreview || !toolPhotoPlaceholder) return;

  if (selectedToolPhoto) {
    toolPhotoPreview.src = selectedToolPhoto;
    toolPhotoPreview.classList.remove("hidden");
    toolPhotoPlaceholder.style.display = "none";
  } else {
    toolPhotoPreview.removeAttribute("src");
    toolPhotoPreview.classList.add("hidden");
    toolPhotoPlaceholder.style.display = "block";
  }
}

function resetToolForm() {
  if (!toolForm) return;
  toolForm.reset();
  toolEditingKey = "";
  if (toolEditKey) toolEditKey.value = "";
  if (toolFormTitle) toolFormTitle.textContent = "Motorpool Tools Input";
  setToolPhotoPreview("");
}

function normalizeToolStatus(status) {
  return status || "Available";
}

function getToolStatusBadge(status) {
  const safeStatus = escapeHTML(normalizeToolStatus(status));
  const slug = safeStatus.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `<span class="status-badge equipment-status-${slug}">${safeStatus}</span>`;
}

function populateToolFilters() {
  setSelectOptions(
    toolCategoryFilter,
    motorpoolTools.map(record => record.category),
    "All Categories",
    toolCategoryFilter?.value || ""
  );

  setSelectOptions(
    toolLocationFilter,
    motorpoolTools.map(record => record.location),
    "All Locations",
    toolLocationFilter?.value || ""
  );
}

function getFilteredTools() {
  const searchTerm = (toolSearchInput?.value || "").toLowerCase();
  const selectedCategory = toolCategoryFilter?.value || "";
  const selectedLocation = toolLocationFilter?.value || "";
  const selectedStatus = toolStatusFilter?.value || "";

  return motorpoolTools.filter(record => {
    const normalizedStatus = normalizeToolStatus(record.status);
    const matchesSearch =
      String(record.toolName || "").toLowerCase().includes(searchTerm) ||
      String(record.toolCode || "").toLowerCase().includes(searchTerm) ||
      String(record.category || "").toLowerCase().includes(searchTerm) ||
      String(record.brand || "").toLowerCase().includes(searchTerm) ||
      String(record.model || "").toLowerCase().includes(searchTerm) ||
      String(record.serialNo || "").toLowerCase().includes(searchTerm) ||
      String(record.location || "").toLowerCase().includes(searchTerm) ||
      String(record.assignedTo || "").toLowerCase().includes(searchTerm) ||
      String(record.remarks || "").toLowerCase().includes(searchTerm) ||
      String(normalizedStatus || "").toLowerCase().includes(searchTerm);

    const matchesCategory = !selectedCategory || record.category === selectedCategory;
    const matchesLocation = !selectedLocation || record.location === selectedLocation;
    const matchesStatus = !selectedStatus || normalizedStatus === selectedStatus;

    return matchesSearch && matchesCategory && matchesLocation && matchesStatus;
  });
}

function renderToolTable() {
  if (!toolTable) return;
  const filtered = getFilteredTools();
  if (toolRecordCount) toolRecordCount.textContent = filtered.length;
  if (filtered.length === 0) {
    toolTable.innerHTML = `<tr><td class="empty-row" colspan="13">No motorpool tools records found.</td></tr>`;
    return;
  }

  toolTable.innerHTML = filtered.map(record => `
    <tr>
      <td>${record.picture ? `<img class="equipment-thumb" src="${record.picture}" alt="Tool photo">` : `<span class="no-photo">No photo</span>`}</td>
      <td>${escapeHTML(record.toolName || "")}</td>
      <td>${escapeHTML(record.toolCode || "")}</td>
      <td>${escapeHTML(record.category || "")}</td>
      <td>${escapeHTML(record.brand || "")}</td>
      <td>${escapeHTML(record.model || "")}</td>
      <td>${escapeHTML(record.serialNo || "")}</td>
      <td>${escapeHTML(record.location || "")}</td>
      <td>${escapeHTML(record.assignedTo || "")}</td>
      <td>${escapeHTML(record.purchaseDate || "")}</td>
      <td>${getToolStatusBadge(record.status)}</td>
      <td>${escapeHTML(record.remarks || "")}</td>
      <td>
        <button class="edit-btn" onclick="editToolRecord('${record.id}')">Edit</button>
        <button class="danger-btn" onclick="deleteToolRecord('${record.id}')">Delete</button>
      </td>
    </tr>
  `).join("");
}

if (toolPicture) {
  toolPicture.addEventListener("change", function () {
    const file = toolPicture.files && toolPicture.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file only.");
      toolPicture.value = "";
      return;
    }

    if (file.size > 750 * 1024) {
      alert("Photo is too large. Please upload an image below 750 KB for Firebase Realtime Database.");
      toolPicture.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
      setToolPhotoPreview(event.target.result);
    };
    reader.readAsDataURL(file);
  });
}

if (toolForm) {
  toolForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!validateNoFutureDatesInForm(toolForm)) return;

    const oldRecord = toolEditingKey ? getToolByKey(toolEditingKey) : null;
    const toolRecord = {
      toolName: document.getElementById("toolName").value.trim(),
      toolCode: document.getElementById("toolCode").value.trim(),
      category: document.getElementById("toolCategory").value.trim(),
      brand: document.getElementById("toolBrand").value.trim(),
      model: document.getElementById("toolModel").value.trim(),
      serialNo: document.getElementById("toolSerialNo").value.trim(),
      location: document.getElementById("toolLocation").value.trim(),
      assignedTo: document.getElementById("toolAssignedTo").value.trim(),
      purchaseDate: document.getElementById("toolPurchaseDate").value,
      status: document.getElementById("toolStatus").value,
      remarks: document.getElementById("toolRemarks").value.trim(),
      picture: selectedToolPhoto || oldRecord?.picture || "",
      updatedAt: getCurrentDateTime()
    };

    try {
      if (toolEditingKey) {
        await update(ref(db, `motorpoolTools/${toolEditingKey}`), toolRecord);
      } else {
        toolRecord.createdAt = getCurrentDateTime();
        const newToolRef = push(motorpoolToolsRef);
        await set(newToolRef, toolRecord);
      }
      resetToolForm();
      showPage("motorpoolToolsPage");
    } catch (error) {
      alert("Firebase motorpool tools save failed: " + error.message);
    }
  });
}

if (clearToolBtn) clearToolBtn.addEventListener("click", resetToolForm);
if (toolSearchInput) toolSearchInput.addEventListener("input", renderToolTable);
if (toolCategoryFilter) toolCategoryFilter.addEventListener("change", renderToolTable);
if (toolLocationFilter) toolLocationFilter.addEventListener("change", renderToolTable);
if (toolStatusFilter) toolStatusFilter.addEventListener("change", renderToolTable);

function editToolRecord(key) {
  const record = getToolByKey(key);
  if (!record) return;

  document.getElementById("toolName").value = record.toolName || "";
  document.getElementById("toolCode").value = record.toolCode || "";
  document.getElementById("toolCategory").value = record.category || "";
  document.getElementById("toolBrand").value = record.brand || "";
  document.getElementById("toolModel").value = record.model || "";
  document.getElementById("toolSerialNo").value = record.serialNo || "";
  document.getElementById("toolLocation").value = record.location || "";
  document.getElementById("toolAssignedTo").value = record.assignedTo || "";
  document.getElementById("toolPurchaseDate").value = record.purchaseDate || "";
  document.getElementById("toolStatus").value = normalizeToolStatus(record.status);
  document.getElementById("toolRemarks").value = record.remarks || "";

  toolEditingKey = key;
  if (toolEditKey) toolEditKey.value = key;
  if (toolFormTitle) toolFormTitle.textContent = "Edit Motorpool Tool";
  setToolPhotoPreview(record.picture || "");
  showPage("motorpoolToolsPage");
}

async function deleteToolRecord(key) {
  if (!confirm("Are you sure you want to delete this motorpool tool record?")) return;
  try {
    await remove(ref(db, `motorpoolTools/${key}`));
  } catch (error) {
    alert("Firebase motorpool tools delete failed: " + error.message);
  }
}

window.editToolRecord = editToolRecord;
window.deleteToolRecord = deleteToolRecord;

function getConsumableByKey(key) {
  return motorpoolConsumables.find(record => record.id === key) || null;
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function renderConsumableEquipmentDropdown(selectedValue = "") {
  const select = document.getElementById("consumableEquipment");
  if (!select) return;

  const uniqueEquipment = [];
  const seen = new Set();
  equipmentRecords
    .filter(record => record.equipNo || record.equipment)
    .sort((a, b) => String(a.equipNo || a.equipment || "").localeCompare(String(b.equipNo || b.equipment || "")))
    .forEach(record => {
      const value = String(record.equipNo || record.equipment || "").trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      uniqueEquipment.push(record);
    });

  const options = [`<option value="">${uniqueEquipment.length ? "Select equipment from Equipment Record" : "No equipment record yet"}</option>`];
  uniqueEquipment.forEach(record => {
    const value = String(record.equipNo || record.equipment || "").trim();
    const label = [record.equipNo, record.equipment, record.location].filter(Boolean).join(" - ");
    options.push(`<option value="${escapeHTML(value)}">${escapeHTML(label || value)}</option>`);
  });
  if (selectedValue && !seen.has(String(selectedValue))) {
    options.push(`<option value="${escapeHTML(selectedValue)}">${escapeHTML(selectedValue)}</option>`);
  }
  select.innerHTML = options.join("");
  select.value = selectedValue || "";
}

function setConsumableTransactionType(type) {
  const safeType = type === "Withdrawal" ? "Withdrawal" : "Replenishment";
  const isWithdrawal = safeType === "Withdrawal";
  const typeInput = document.getElementById("consumableTransactionType");
  if (typeInput) typeInput.value = safeType;
  if (consumableTypeDisplay) {
    consumableTypeDisplay.textContent = safeType;
    consumableTypeDisplay.className = `readonly-pill ${isWithdrawal ? "pill-withdrawal" : "pill-replenishment"}`;
  }
  if (consumableFormTitle) consumableFormTitle.textContent = isWithdrawal ? "Withdraw Consumable Item" : "Replenish Consumable Item";
  const subtitle = document.getElementById("consumableFormSubtitle");
  if (subtitle) subtitle.textContent = isWithdrawal
    ? "Stock-out transaction. This will deduct from current stock."
    : "Stock-in transaction. This will add to current stock.";
  const qtyLabel = document.querySelector('label[for="consumableQty"]');
  if (qtyLabel) qtyLabel.textContent = isWithdrawal ? "Withdrawal Quantity" : "Quantity";
  if (saveConsumableBtn) saveConsumableBtn.textContent = isWithdrawal ? "Save Withdrawal" : "Save Replenishment";
  document.querySelectorAll(".withdrawal-only").forEach(el => el.classList.toggle("hidden", !isWithdrawal));
  document.querySelectorAll(".replenishment-only").forEach(el => el.classList.toggle("hidden", isWithdrawal));
  const requestor = document.getElementById("consumableRequestedBy");
  const equipment = document.getElementById("consumableEquipment");
  if (requestor) requestor.required = isWithdrawal;
  if (equipment) equipment.required = isWithdrawal;
  if (isWithdrawal) renderConsumableEquipmentDropdown(equipment?.value || "");
}

function showConsumablePanel(type = "Replenishment", item = null) {
  if (consumableTransactionPanel) consumableTransactionPanel.classList.remove("hidden");
  consumableEditingKey = "";
  consumableInventoryEditContext = null;
  if (consumableEditKey) consumableEditKey.value = "";
  consumableForm?.reset();
  setConsumableTransactionType(type);
  const dateInput = document.getElementById("consumableDate");
  if (dateInput) dateInput.value = getTodayDate();
  if (item) {
    document.getElementById("consumableItemName").value = item.itemName || "";
    document.getElementById("consumableCategory").value = item.category || "";
    document.getElementById("consumableUnit").value = item.unit || "";
  }
  setTimeout(() => consumableTransactionPanel?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
}

function resetConsumableForm() {
  if (!consumableForm) return;
  consumableForm.reset();
  consumableEditingKey = "";
  consumableInventoryEditContext = null;
  if (consumableEditKey) consumableEditKey.value = "";
  setConsumableTransactionType("Replenishment");
  const dateInput = document.getElementById("consumableDate");
  if (dateInput) dateInput.value = getTodayDate();
  if (consumableTransactionPanel) consumableTransactionPanel.classList.add("hidden");
}

function getFilteredConsumables() {
  const searchTerm = (consumableSearchInput?.value || "").toLowerCase();
  const selectedType = consumableTypeFilter?.value || "All";
  const dateFrom = consumableDateFrom?.value || "";
  const dateTo = consumableDateTo?.value || "";

  return motorpoolConsumables.filter(record => {
    const recordDate = record.date || "";
    const matchesType = selectedType === "All" || record.transactionType === selectedType;
    const matchesDateFrom = !dateFrom || recordDate >= dateFrom;
    const matchesDateTo = !dateTo || recordDate <= dateTo;
    const matchesSearch =
      String(record.date || "").toLowerCase().includes(searchTerm) ||
      String(record.itemName || "").toLowerCase().includes(searchTerm) ||
      String(record.category || "").toLowerCase().includes(searchTerm) ||
      String(record.unit || "").toLowerCase().includes(searchTerm) ||
      String(record.requestedBy || "").toLowerCase().includes(searchTerm) ||
      String(record.equipment || "").toLowerCase().includes(searchTerm) ||
      String(record.referenceNo || "").toLowerCase().includes(searchTerm) ||
      String(record.remarks || "").toLowerCase().includes(searchTerm);
    return matchesType && matchesDateFrom && matchesDateTo && matchesSearch;
  });
}

function getConsumableSummary() {
  const summary = new Map();

  motorpoolConsumables.forEach(record => {
    const itemName = (record.itemName || "").trim();
    const unit = (record.unit || "").trim();
    if (!itemName) return;
    const key = `${itemName.toLowerCase()}|${unit.toLowerCase()}`;
    const qty = Number(record.qty) || 0;
    const activityTime = Date.parse(record.date || record.updatedAt || record.createdAt || "") || 0;
    if (!summary.has(key)) {
      summary.set(key, {
        itemName,
        category: record.category || "",
        unit,
        replenishment: 0,
        withdrawal: 0,
        lastActivity: activityTime,
        equipmentDetails: [],
        remarks: record.remarks || "",
        remarksTime: activityTime,
        overrideQty: null,
        overrideKey: ""
      });
    }
    const row = summary.get(key);
    if (!row.category && record.category) row.category = record.category;
    if (activityTime > row.lastActivity) row.lastActivity = activityTime;
    if ((record.remarks || "") && activityTime >= (row.remarksTime || 0)) {
      row.remarks = record.remarks || "";
      row.remarksTime = activityTime;
    }
    if (record.isInventoryOverride) {
      if (!row.overrideKey || activityTime >= (row.overrideTime || 0)) {
        row.overrideQty = qty;
        row.overrideKey = record.id || "";
        row.overrideTime = activityTime;
        if (record.category) row.category = record.category;
      }
      return;
    }
    if (record.transactionType === "Withdrawal") row.withdrawal += qty;
    else row.replenishment += qty;
  });

  // Auto-add received warehouse parts and spare parts from Equipment Parts records
  records.forEach(record => {
    const partStatus = normalizeStatus(record.status);
    if (partStatus !== "Received stored at warehouse" && partStatus !== "Spare Parts") return;
    const itemName = (record.partName || record.part || "").trim();
    if (!itemName) return;

    const unit = (record.unit || "").trim();
    const key = `${itemName.toLowerCase()}|${unit.toLowerCase()}`;
    const qty = Number(record.qty) || 0;
    const activityTime = Date.parse(record.receivedDate || record.date || record.updatedAt || record.createdAt || "") || 0;
    const equipmentMaster = getEquipmentByEquipNo(record.equipNo);
    const equipmentDetail = {
      equipNo: record.equipNo || "",
      equipmentName: record.equipmentName || equipmentMaster?.equipment || "",
      location: record.equipmentLocation || equipmentMaster?.location || "",
      company: record.equipmentCompany || equipmentMaster?.company || "",
      model: equipmentMaster?.model || "",
      serialNo: equipmentMaster?.serialNo || ""
    };

    if (!summary.has(key)) {
      summary.set(key, {
        itemName,
        category: record.prDate || "",
        unit,
        replenishment: 0,
        withdrawal: 0,
        lastActivity: activityTime,
        equipmentDetails: [],
        remarks: record.remarks || "",
        remarksTime: activityTime,
        overrideQty: null,
        overrideKey: ""
      });
    }

    const row = summary.get(key);
    row.replenishment += qty;
    if (!row.category && record.prDate) row.category = record.prDate;
    if (activityTime > row.lastActivity) row.lastActivity = activityTime;

    const detailKey = [equipmentDetail.equipNo, equipmentDetail.equipmentName, equipmentDetail.location, equipmentDetail.company, equipmentDetail.model, equipmentDetail.serialNo].join("|");
    if (detailKey.replace(/\|/g, "").trim() && !row.equipmentDetails.some(detail => [detail.equipNo, detail.equipmentName, detail.location, detail.company, detail.model, detail.serialNo].join("|") === detailKey)) {
      row.equipmentDetails.push(equipmentDetail);
    }
  });

  return Array.from(summary.values()).map(row => ({
    ...row,
    equipmentInfo: formatEquipmentDetails(row.equipmentDetails),
    stock: row.overrideQty !== null && row.overrideQty !== undefined ? row.overrideQty : row.replenishment - row.withdrawal,
    overrideKey: row.overrideKey || ""
  })).sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0) || a.itemName.localeCompare(b.itemName));
}

function formatEquipmentDetails(details = []) {
  if (!details.length) return "";
  return details.map(detail => {
    const main = [detail.equipNo, detail.equipmentName].filter(Boolean).join(" - ");
    const sub = [detail.location, detail.company, detail.model ? `Model: ${detail.model}` : "", detail.serialNo ? `Serial: ${detail.serialNo}` : ""].filter(Boolean).join(" | ");
    return [main, sub].filter(Boolean).join(" | ");
  }).join("; ");
}

function getVisibleConsumableSummary() {
  const searchTerm = (consumableInventorySearchInput?.value || "").toLowerCase();
  const rows = getConsumableSummary().filter(row => {
    if (!searchTerm) return true;
    return String(row.itemName || "").toLowerCase().includes(searchTerm) ||
      String(row.category || "").toLowerCase().includes(searchTerm) ||
      String(row.unit || "").toLowerCase().includes(searchTerm) ||
      String(row.equipmentInfo || "").toLowerCase().includes(searchTerm);
  });
  return rows;
}

function renderConsumables() {
  if (!consumableSummaryTable) return;

  const visibleSummary = getVisibleConsumableSummary();

  consumableSummaryTable.innerHTML = visibleSummary.length ? visibleSummary.map(row => {
    const itemData = encodeURIComponent(JSON.stringify(row));
    const stockClass = Number(row.stock) <= 0 ? "stock-low" : "stock-ok";
    return `
      <tr>
        <td><strong>${escapeHTML(row.itemName)}</strong></td>
        <td>${escapeHTML(row.category || "-")}</td>
        <td><strong class="${stockClass}">${escapeHTML(row.stock)}</strong></td>
        <td>${escapeHTML(row.unit || "-")}</td>
        <td>${row.equipmentInfo ? row.equipmentInfo.split("; ").map(info => `<div class="equipment-info-line">${escapeHTML(info)}</div>`).join("") : "-"}</td>
        <td>${row.remarks ? escapeHTML(row.remarks) : "-"}</td>
        <td class="action-cell">
          <button class="edit-btn" onclick="editConsumableInventory('${itemData}')">Edit</button>
          <button class="success-btn" onclick="openConsumableTransaction('Replenishment', '${itemData}')">Replenishment</button>
          <button class="warning-btn" onclick="openConsumableTransaction('Withdrawal', '${itemData}')">Withdraw</button>
          <button class="danger-btn" onclick="deleteConsumableInventory('${itemData}')">Delete</button>
        </td>
      </tr>`;
  }).join("") : `<tr><td class="empty-row" colspan="7">No consumable inventory yet. Click “New Item / Beginning Stock” to create the first stock entry.</td></tr>`;
}

function getConsumableTypeBadge(type) {
  const safeType = escapeHTML(type || "Replenishment");
  const className = String(type || "Replenishment").toLowerCase();
  return `<span class="status-badge consumable-${className}">${safeType}</span>`;
}

if (consumableForm) {
  consumableForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!validateNoFutureDatesInForm(consumableForm)) return;

    const transactionType = document.getElementById("consumableTransactionType").value;
    const qty = Number(document.getElementById("consumableQty").value) || 0;
    if (qty <= 0 && !consumableInventoryEditContext) {
      alert("Quantity must be greater than zero.");
      return;
    }

    if (transactionType === "Withdrawal" && !consumableEditingKey) {
      const itemName = document.getElementById("consumableItemName").value.trim().toLowerCase();
      const unit = document.getElementById("consumableUnit").value.trim().toLowerCase();
      const summaryItem = getConsumableSummary().find(item =>
        String(item.itemName || "").trim().toLowerCase() === itemName &&
        String(item.unit || "").trim().toLowerCase() === unit
      );
      const currentStock = Number(summaryItem?.stock) || 0;
      if (qty > currentStock) {
        alert(`Withdrawal quantity cannot exceed current stock (${currentStock}).`);
        return;
      }
    }

    const record = {
      itemName: document.getElementById("consumableItemName").value.trim(),
      category: document.getElementById("consumableCategory").value.trim(),
      unit: document.getElementById("consumableUnit").value.trim(),
      transactionType,
      qty,
      date: document.getElementById("consumableDate").value,
      requestedBy: document.getElementById("consumableRequestedBy")?.value.trim() || "",
      equipment: document.getElementById("consumableEquipment")?.value || "",
      referenceNo: document.getElementById("consumableReferenceNo").value.trim(),
      remarks: document.getElementById("consumableRemarks").value.trim(),
      updatedAt: getCurrentDateTime()
    };

    if (consumableInventoryEditContext) {
      record.isInventoryOverride = true;
      record.transactionType = "Replenishment";
      record.inventoryEditKey = `${record.itemName.toLowerCase()}|${record.unit.toLowerCase()}`;
      record.remarks = record.remarks || "Inventory remaining stock edited from Inventory action.";
    }

    try {
      if (consumableEditingKey) {
        await update(ref(db, `motorpoolConsumables/${consumableEditingKey}`), record);
      } else if (consumableInventoryEditContext) {
        alert("This item came from Equipment Parts and has no Motorpool Consumables record to update.");
        return;
      } else {
        record.createdAt = getCurrentDateTime();
        const newRef = push(motorpoolConsumablesRef);
        await set(newRef, record);
      }
      resetConsumableForm();
      showPage("motorpoolConsumablesPage");
    } catch (error) {
      alert("Firebase consumable save failed: " + error.message);
    }
  });
}


function editConsumableInventory(encodedItem) {
  let item = null;
  try { item = JSON.parse(decodeURIComponent(encodedItem)); } catch (error) { item = null; }
  if (!item) return;

  const matchingRecords = motorpoolConsumables
    .filter(record =>
      String(record.itemName || "").trim().toLowerCase() === String(item.itemName || "").trim().toLowerCase() &&
      String(record.unit || "").trim().toLowerCase() === String(item.unit || "").trim().toLowerCase()
    )
    .sort((a, b) => (Date.parse(b.updatedAt || b.createdAt || b.date || "") || 0) - (Date.parse(a.updatedAt || a.createdAt || a.date || "") || 0));
  const existingEditKey = item.overrideKey || matchingRecords[0]?.id || "";

  consumableInventoryEditContext = item;
  consumableEditingKey = existingEditKey;
  if (consumableEditKey) consumableEditKey.value = existingEditKey;
  if (consumableTransactionPanel) consumableTransactionPanel.classList.remove("hidden");
  consumableForm?.reset();

  document.getElementById("consumableItemName").value = item.itemName || "";
  document.getElementById("consumableCategory").value = item.category || "";
  document.getElementById("consumableUnit").value = item.unit || "";
  setConsumableTransactionType("Replenishment");
  document.getElementById("consumableQty").value = item.stock ?? 0;
  document.getElementById("consumableDate").value = getTodayDate();
  document.getElementById("consumableRemarks").value = "Inventory remaining stock edited from Inventory action.";

  if (consumableFormTitle) consumableFormTitle.textContent = "Edit Inventory Stock";
  const subtitle = document.getElementById("consumableFormSubtitle");
  if (subtitle) subtitle.textContent = "Update the displayed remaining stock for this inventory item.";
  if (saveConsumableBtn) saveConsumableBtn.textContent = "Update Inventory";
  showPage("motorpoolConsumablesPage");
  setTimeout(() => consumableTransactionPanel?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
}

function editConsumable(key) {
  const record = getConsumableByKey(key);
  if (!record) return;

  if (consumableTransactionPanel) consumableTransactionPanel.classList.remove("hidden");
  document.getElementById("consumableItemName").value = record.itemName || "";
  document.getElementById("consumableCategory").value = record.category || "";
  document.getElementById("consumableUnit").value = record.unit || "";
  setConsumableTransactionType(record.transactionType || "Replenishment");
  document.getElementById("consumableQty").value = record.qty || "";
  document.getElementById("consumableDate").value = record.date || "";
  if (document.getElementById("consumableRequestedBy")) document.getElementById("consumableRequestedBy").value = record.requestedBy || "";
  renderConsumableEquipmentDropdown(record.equipment || "");
  document.getElementById("consumableReferenceNo").value = record.referenceNo || "";
  document.getElementById("consumableRemarks").value = record.remarks || "";

  consumableInventoryEditContext = null;
  consumableEditingKey = key;
  if (consumableEditKey) consumableEditKey.value = key;
  if (consumableFormTitle) consumableFormTitle.textContent = "Edit Consumable Transaction";
  if (saveConsumableBtn) saveConsumableBtn.textContent = "Update Transaction";
  showPage("motorpoolConsumablesPage");
  setTimeout(() => consumableTransactionPanel?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
}

async function deleteConsumable(key) {
  if (!confirm("Are you sure you want to delete this consumable transaction?")) return;
  try {
    await remove(ref(db, `motorpoolConsumables/${key}`));
  } catch (error) {
    alert("Firebase consumable delete failed: " + error.message);
  }
}

async function deleteConsumableInventory(encodedItem) {
  let item = null;
  try { item = JSON.parse(decodeURIComponent(encodedItem)); } catch (error) { item = null; }
  if (!item) return;

  const itemName = String(item.itemName || "").trim();
  const unit = String(item.unit || "").trim();
  const matchingRecords = motorpoolConsumables.filter(record =>
    String(record.itemName || "").trim().toLowerCase() === itemName.toLowerCase() &&
    String(record.unit || "").trim().toLowerCase() === unit.toLowerCase()
  );

  if (!matchingRecords.length) {
    alert("This inventory row comes from Equipment Parts records. Please delete or update the source Equipment Parts record instead.");
    return;
  }

  const confirmMessage = `Delete ${itemName} (${unit || "no unit"}) from Motorpool Consumables? This will remove ${matchingRecords.length} saved consumable record(s) and cannot be undone.`;
  if (!confirm(confirmMessage)) return;

  try {
    await Promise.all(matchingRecords.map(record => remove(ref(db, `motorpoolConsumables/${record.id}`))));
    resetConsumableForm();
  } catch (error) {
    alert("Firebase consumable inventory delete failed: " + error.message);
  }
}

function openConsumableTransaction(type, encodedItem) {
  let item = null;
  if (encodedItem) {
    try { item = JSON.parse(decodeURIComponent(encodedItem)); } catch (error) { item = null; }
  }
  showConsumablePanel(type, item);
}

window.editConsumable = editConsumable;
window.editConsumableInventory = editConsumableInventory;
window.deleteConsumable = deleteConsumable;
window.deleteConsumableInventory = deleteConsumableInventory;
window.openConsumableTransaction = openConsumableTransaction;

if (newConsumableItemBtn) newConsumableItemBtn.addEventListener("click", () => showConsumablePanel("Replenishment"));
if (clearConsumableBtn) clearConsumableBtn.addEventListener("click", resetConsumableForm);
if (consumableInventorySearchInput) consumableInventorySearchInput.addEventListener("input", renderConsumables);
if (consumableSearchInput) consumableSearchInput.addEventListener("input", renderConsumables);
if (consumableTypeFilter) consumableTypeFilter.addEventListener("change", renderConsumables);
if (consumableDateFrom) consumableDateFrom.addEventListener("change", renderConsumables);
if (consumableDateTo) consumableDateTo.addEventListener("change", renderConsumables);

if (exportConsumablesBtn) {
  exportConsumablesBtn.addEventListener("click", function () {
    const inventoryRows = getVisibleConsumableSummary();
    if (inventoryRows.length === 0) {
      alert("No consumable inventory to export.");
      return;
    }

    const headers = ["Item Name", "Last PR Date", "Remaining Stock", "Unit", "Equipment Details / Belongs To", "Remarks"];
    const rows = inventoryRows.map(row => [
      row.itemName || "",
      row.category || "",
      row.stock || "",
      row.unit || "",
      row.equipmentInfo || "",
      row.remarks || ""
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(value => `"${String(value || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "motorpool_consumables_inventory.csv";
    link.click();
  });
}


function startFirebaseListeners() {
  if (firebaseListenersStarted) return;
  firebaseListenersStarted = true;

  firebaseUnsubscribers.push(onValue(recordsRef, snapshot => {
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
  }));

  firebaseUnsubscribers.push(onValue(equipmentRecordsRef, snapshot => {
    const data = snapshot.val() || {};
    equipmentRecords = Object.entries(data).map(([id, value]) => ({ id, ...value }));
    renderEquipmentDropdown();
    renderConsumableEquipmentDropdown(document.getElementById("consumableEquipment")?.value || "");
    renderTransferToDropdown();
    renderEquipmentTransferToDropdown();
    populateEquipmentReportFilters();
    renderEquipmentTable();
  }, error => {
    alert("Firebase equipment records connection failed: " + error.message);
  }));

  firebaseUnsubscribers.push(onValue(motorpoolConsumablesRef, snapshot => {
    const data = snapshot.val() || {};
    motorpoolConsumables = Object.entries(data).map(([id, value]) => ({ id, ...value }));
    renderConsumables();
  }, error => {
    alert("Firebase motorpool consumables connection failed: " + error.message);
  }));
}

function stopFirebaseListeners() {
  firebaseUnsubscribers.forEach(unsubscribe => {
    try { unsubscribe(); } catch (error) {}
  });
  firebaseUnsubscribers = [];
  firebaseListenersStarted = false;
}

if (loginForm) {
  loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (loginMessage) loginMessage.textContent = "";
    if (loginBtn) loginBtn.disabled = true;
    try {
      await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
      loginForm.reset();
    } catch (error) {
      if (loginMessage) loginMessage.textContent = "Login failed. Please check email and password.";
    } finally {
      if (loginBtn) loginBtn.disabled = false;
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });
}

onAuthStateChanged(auth, user => {
  if (user) {
    if (loginScreen) loginScreen.style.display = "none";
    if (appShell) appShell.classList.remove("hidden-app");
    if (loggedUser) loggedUser.textContent = user.email || "Logged in";
    if (connectionStatus) connectionStatus.textContent = "Connected as authorized user";
    startFirebaseListeners();
  } else {
    if (loginScreen) loginScreen.style.display = "grid";
    if (appShell) appShell.classList.add("hidden-app");
    if (loggedUser) loggedUser.textContent = "";
    if (connectionStatus) connectionStatus.textContent = "Login required";
    stopFirebaseListeners();
  }
});

resetConsumableForm();
resetToolForm();
renderAll();
updateDatePreview();


// record count helper
function updateRecordCounter(count){ if(recordCount) recordCount.textContent = `Total Records: ${count}`; }
