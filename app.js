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

let records = [];
let editingKey = "";

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
    addRecordPage: editingKey ? "Edit Record" : "Add Record",
    recordsPage: "Records"
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
  const safeStatus = escapeHTML(status || "Pending");
  const className = safeStatus.toLowerCase();
  return `<span class="status-badge status-${className}">${safeStatus}</span>`;
}

function normalizeDate(value) {
  return value && String(value).trim() !== "" ? value : "-";
}

function getDaysPending(record) {
  if (!record.prDate || record.status === "Installed") return "-";
  const start = new Date(record.prDate + "T00:00:00");
  const end = record.receivedDate && record.status !== "Pending" ? new Date(record.receivedDate) : new Date();
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
    if (status === "Received") receivedText = "Will auto-save when submitted";
    if (status === "Installed") {
      receivedText = "Will auto-save when submitted";
      installedText = "Will auto-save when submitted";
    }
  } else {
    if ((status === "Received" || status === "Installed") && !existingRecord.receivedDate) {
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

  if ((selectedStatus === "Received" || selectedStatus === "Installed") && !receivedDate) {
    receivedDate = getCurrentDateTime();
  }

  if (selectedStatus === "Installed" && !installedDate) {
    installedDate = getCurrentDateTime();
  }

  const record = {
    equipNo: document.getElementById("equipNo").value.trim(),
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
  editIndexInput.value = "";
  editingKey = "";
  formTitle.textContent = "Add Record";
  pageTitle.textContent = "Add Record";
  statusInput.value = "Pending";
  receivedDatePreview.textContent = "Automatic";
  installedDatePreview.textContent = "Automatic";
}

clearBtn.addEventListener("click", resetForm);

function editRecord(key) {
  const record = getRecordByKey(key);
  if (!record) return;

  document.getElementById("equipNo").value = record.equipNo || "";
  document.getElementById("partName").value = record.partName || "";
  document.getElementById("partNumber").value = record.partNumber || "";
  document.getElementById("prNo").value = record.prNo || "";
  document.getElementById("supplier").value = record.supplier || "";
  document.getElementById("prDate").value = record.prDate || "";
  document.getElementById("qty").value = record.qty || "";
  document.getElementById("unit").value = record.unit || "";
  document.getElementById("remarks").value = record.remarks || "";
  statusInput.value = record.status || "Pending";

  editIndexInput.value = key;
  editingKey = key;
  formTitle.textContent = "Edit Record";
  pageTitle.textContent = "Edit Record";
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
      String(record.partName || "").toLowerCase().includes(searchTerm) ||
      String(record.partNumber || "").toLowerCase().includes(searchTerm) ||
      String(record.prNo || "").toLowerCase().includes(searchTerm) ||
      String(record.supplier || "").toLowerCase().includes(searchTerm) ||
      String(record.remarks || "").toLowerCase().includes(searchTerm);

    const matchesStatus = selectedStatus === "All" || record.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });
}

function renderRecordsTable() {
  const selectedStatus = statusFilter.value;

  if (!selectedStatus) {
    if(recordCount) recordCount.textContent='Total Records: 0';
    recordsTable.innerHTML = `<tr><td class="empty-row" colspan="13">Please select a status to view records.</td></tr>`;
    return;
  }

  const filteredRecords = getFilteredRecords();

  if (filteredRecords.length === 0) {
    if(recordCount) recordCount.textContent='Total Records: 0';
    recordsTable.innerHTML = `<tr><td class="empty-row" colspan="13">No records found.</td></tr>`;
    return;
  }

  if(recordCount) recordCount.textContent = `Total Records: ${filteredRecords.length}`;

  recordsTable.innerHTML = filteredRecords.map(record => `
    <tr>
      <td>${escapeHTML(record.equipNo)}</td>
      <td>${escapeHTML(record.partName)}</td>
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
      <td>
        <button class="edit-btn" onclick="editRecord('${record.id}')">Edit</button>
        <button class="danger-btn" onclick="deleteRecord('${record.id}')">Delete</button>
      </td>
    </tr>
  `).join("");
}

function renderDashboard() {
  const pending = records.filter(r => r.status === "Pending").length;
  const received = records.filter(r => r.status === "Received").length;
  const installed = records.filter(r => r.status === "Installed").length;

  document.getElementById("pendingCount").textContent = pending;
  document.getElementById("receivedCount").textContent = received;
  document.getElementById("installedCount").textContent = installed;


  const latest = [...records].slice(-5).reverse();

  if (latest.length === 0) {
    recentRecords.innerHTML = `<tr><td class="empty-row" colspan="6">No recent records yet.</td></tr>`;
    return;
  }

  recentRecords.innerHTML = latest.map(record => `
    <tr>
      <td>${escapeHTML(record.equipNo)}</td>
      <td>${escapeHTML(record.partName)}</td>
      <td>${escapeHTML(record.prNo)}</td>
      <td>${getStatusBadge(record.status)}</td>
      <td>${escapeHTML(normalizeDate(record.receivedDate))}</td>
      <td>${escapeHTML(normalizeDate(record.installedDate))}</td>
    </tr>
  `).join("");
}

function renderAll() {
  renderDashboard();
  renderRecordsTable();
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
    "Days Pending", "QTY", "Unit", "Remarks", "Status", "Received Date", "Installed Date"
  ];

  const rows = records.map(record => [
    record.equipNo,
    record.partName,
    record.partNumber,
    record.prNo,
    record.supplier,
    record.prDate,
    getDaysPending(record),
    record.qty,
    record.unit,
    record.remarks,
    record.status,
    record.receivedDate,
    record.installedDate
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

renderAll();
updateDatePreview();


// record count helper
function updateRecordCounter(count){ if(recordCount) recordCount.textContent = `Total Records: ${count}`; }
