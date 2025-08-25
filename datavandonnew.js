const POST_URL =
  "https://script.google.com/macros/s/AKfycbyLIlXDSEfr8ZaIPxyrcv063leDjKSIpLWpI3p7u7BOvr9RHozEXLiYv8VvoYWLYw9w4A/exec";
const IMMEDIATE_UPDATE_URL =
  "https://script.google.com/macros/s/AKfycbwtoLqG0p-HBsjpyMqqER4YRQ-B7x_qEGlL5_ZjNaIAaxKUXmHO5Weam3_E9ZUMPawy/exec";

// === CẤU HÌNH CỘT ===
const columnDisplayMapping = {};
const editableCols = [
  "Kết quả Check",
  "Trạng thái giao hàng NB",
  "Lý do",
  "Trạng thái thu tiền",
  "Ghi chú của VĐ",
];
const dropdownCols = {
  "Kết quả Check": [
    "",
    "OK",
    "Huỷ",
    "Treo",
    "Vận đơn XL",
    "Đợi hàng",
    "Khách hẹn",
  ],
  "Trạng thái giao hàng NB": [
    "",
    "Giao Thành Công",
    "Đang Giao",
    "Chưa Giao",
    "Hủy",
    "Hoàn",
    "chờ check",
    "Giao không thành công",
    "Bom_Thất Lạc",
  ],
  "Trạng thái thu tiền": [
    "",
    "Có bill",
    "Có bill 1 phần",
    "Bom_bùng_chặn",
    "Hẹn Thanh Toán",
    "Hoàn Hàng",
    "Khó Đòi",
    "Không nhận được hàng",
    "Không PH dưới 3N",
    "Thanh toán phí hoàn",
    "KPH nhiều ngày",
  ],
};
const displayColumns = [
  "Mã đơn hàng",
  "Kết quả Check",
  "Trạng thái giao hàng NB",
  "Mã Tracking",
  "Lý do",
  "Trạng thái thu tiền",
  "Ghi chú của VĐ",
  "Ngày lên đơn",
  "Name*",
  "Phone*",
  "Add",
  "City",
  "State",
  "khu vực",
  "Zipcode",
  "Mặt hàng",
  "Tên mặt hàng 1",
  "Số lượng mặt hàng 1",
  "Tên mặt hàng 2",
  "Số lượng mặt hàng 2",
  "Quà tặng",
  "Số lượng quà kèm",
  "Giá bán",
  "Loại tiền thanh toán",
  "Tổng tiền VNĐ",
  "Hình thức thanh toán",
  "Ghi chú",
  "Ngày đóng hàng",
  "Trạng thái giao hàng",
  "Thời gian giao dự kiến",
  "Phí ship nội địa Mỹ (usd)",
  "Phí xử lý đơn đóng hàng-Lưu kho(usd)",
  "GHI CHÚ",
  "Nhân viên Sale",
  "NV Vận đơn",
  "Đơn vị vận chuyển",
  "Số tiền của đơn hàng đã về TK Cty",
  "Kế toán xác nhận thu tiền về",
  "Ngày Kế toán đối soát với FFM lần 2",
];
const allDateColumns = ["Ngày lên đơn", "Ngày đóng hàng"];
const columnsToMakeDynamic = [
  "Kết quả Check",
  "Trạng thái giao hàng NB",
  "Trạng thái thu tiền",
  "khu vực",
  "Mặt hàng",
  "Nhân viên Sale",
  "NV Vận đơn",
  "Đơn vị vận chuyển",
];

const singleSelectFilterCols = [
  "Kết quả Check",
  "Trạng thái giao hàng NB",
  "Trạng thái thu tiền",
];
const datalistFilterCols = ["Mã đơn hàng", "Name*", "Phone*", "Nhân viên Sale"];
(currentPage = 1),
  (limit = 50),
  (hasMore = true),
  (totalData = 0),
  (totalPages = 0),
  (filterCache = new Map()),
  (lastFilterHash = ""),
  (dataIndex = { product: new Map(), market: new Map(), staff: new Map() });
// === KẾT THÚC CẤU HÌNH ===

let allData = [],
  staffFilteredData = [],
  japanData = [],
  changedRows = new Map(),
  japanChangedRows = new Map(),
  allRegionsChangedRows = new Map(),
  currentStaff = null,
  teamMembers = [],
  selectedCells = new Set(),
  isMouseDown = false,
  startCell = null,
  dynamicFilterOptions = {},
  japanDynamicFilterOptions = {},
  allRegionsDynamicFilterOptions = {},
  datalistOptions = {},
  filterDebounceTimer;

let staffChartInstance = null,
  deliveryStatusChartInstance = null;

function getDateTimeVN(dateInput) {
  const date = new Date(dateInput) || new Date();
  const options = { timeZone: "Asia/Ho_Chi_Minh", hour12: !1 };
  const vnDate = new Date(date.toLocaleString("en-US", options));
  const dd = String(vnDate.getDate()).padStart(2, "0");
  const mm = String(vnDate.getMonth() + 1).padStart(2, "0");
  const yyyy = vnDate.getFullYear();
  const HH = String(vnDate.getHours()).padStart(2, "0");
  const MM = String(vnDate.getMinutes()).padStart(2, "0");
  const SS = String(vnDate.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
}
function getFixedColumnCount() {
  const e = document.getElementById("fixedColumnCountInput"),
    t = parseInt(e.value, 10);
  return isNaN(t) || t < 0 ? 0 : t;
}
function handleFixedColumnCountChange() {
  const newCount = getFixedColumnCount();
  const activeTab = document.querySelector(".content-tab.active");
  if (!activeTab) return;
  const activeConfig = allTabConfigs.find(
    (c) => c.table.body === activeTab.querySelector("tbody")?.id
  );
  if (!activeConfig) return;
  const tableHead = document.getElementById(activeConfig.table.head);
  const tableBody = document.getElementById(activeConfig.table.body);
  if (!tableHead || !tableBody) return;
  const allRows = [
    ...tableHead.querySelectorAll("tr"),
    ...tableBody.querySelectorAll("tr"),
  ];
  allRows.forEach((row) => {
    for (let i = 0; i < row.cells.length; i++) {
      const cell = row.cells[i];
      if (i < newCount) {
        cell.classList.add("fixed-column");
      } else {
        cell.classList.remove("fixed-column");
        cell.style.left = "";
      }
    }
  });
  updateStickyColumns(activeConfig);
}
function updateStickyColumns(config) {
  const fixedCount = getFixedColumnCount();
  const tableHead = document.getElementById(config.table.head);
  const tableBody = document.getElementById(config.table.body);
  [
    ...tableHead.querySelectorAll(".fixed-column"),
    ...tableBody.querySelectorAll(".fixed-column"),
  ].forEach((c) => (c.style.left = ""));
  if (fixedCount <= 0) return;
  const headerRow = tableHead.querySelector("tr");
  if (!headerRow) return;
  let leftOffset = 0;
  for (let i = 0; i < fixedCount; i++) {
    const th = headerRow.cells[i];
    if (!th) continue;
    th.style.left = leftOffset + "px";
    const rows = tableBody.querySelectorAll("tr");
    rows.forEach((row) => {
      if (row.cells[i]) {
        row.cells[i].style.left = leftOffset + "px";
      }
    });
    leftOffset += th.offsetWidth;
  }
}
function getUrlParameter(name) {
  name = name.replace(/[\[\]]/g, "\\$&");
  const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
    results = regex.exec(window.location.href);
  if (!results) return null;
  if (!results[2]) return "";
  return decodeURIComponent(results[2].replace(/\+/g, " "));
}
function parseDateString(dateString) {
  if (!dateString || typeof dateString !== "string") return null;
  const cleanedDateString = dateString.trim().replace(/[^\d\/\-\s]/g, "");
  if (/^\d{4}-\d{2}-\d{2}/.test(cleanedDateString)) {
    const d = new Date(cleanedDateString);
    if (!isNaN(d.getTime())) return d;
  }
  const parts = cleanedDateString.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (parts) {
    const month = parseInt(parts[1], 10),
      day = parseInt(parts[2], 10),
      year = parseInt(parts[3], 10);
    if (year > 1e3 && month > 0 && month <= 12 && day > 0 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (d.getUTCFullYear() === year && d.getUTCMonth() === month - 1)
        return d;
    }
  }
  return null;
}
function formatDate(dateString) {
  const originalValue = typeof dateString === "string" ? dateString.trim() : "";
  if (!originalValue) return { display: "", original: "" };
  const dateObj = parseDateString(originalValue);
  if (dateObj) {
    const day = String(dateObj.getUTCDate()).padStart(2, "0"),
      month = String(dateObj.getUTCMonth() + 1).padStart(2, "0"),
      year = dateObj.getUTCFullYear();
    return { display: `${day}/${month}/${year}`, original: originalValue };
  }
  return { display: originalValue, original: originalValue };
}
async function fetchStaffInfo(idns, id1 = null) {
  try {
    const staffApiUrl =
        "https://script.google.com/macros/s/AKfycbzwOv7UFwrqzf88QJL1QrxLKcnnnSIQ_PSmF0SO8LboqWI5li3vF3W8_-8s-A8lNGaR/exec",
      response = await fetch(staffApiUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("Lỗi mạng khi tải data nhân viên");
    const data = await response.json();
    let staffMember = data.find((staff) => String(staff.idnv) === idns),
      staffMember1 = id1
        ? data.find((staff) => String(staff.idnv) === id1)
        : null;
    if (!staffMember && !staffMember1) {
      let errorMsg = `Không tìm thấy nhân viên với ID: ${idns}`;
      if (id1) errorMsg += ` hoặc ID1: ${id1}`;
      throw new Error(errorMsg);
    }
    const memberNames = new Set();
    if (staffMember) {
      if (staffMember.ho_va_ten) memberNames.add(staffMember.ho_va_ten);
      if (staffMember.vi_tri === "Leader" && staffMember.team) {
        const teamName = staffMember.team;
        data.forEach((member) => {
          if (member.team === teamName && member.ho_va_ten)
            memberNames.add(member.ho_va_ten);
        });
      }
    }
    if (staffMember1 && staffMember1.ho_va_ten)
      memberNames.add(staffMember1.ho_va_ten);
    teamMembers = Array.from(memberNames);
    return staffMember || staffMember1;
  } catch (error) {
    showError(error.message);
    throw error;
  }
}
function showError(message, containerId = "tableBody") {
  const container = document.getElementById(containerId),
    colCount = displayColumns.length;
  container.innerHTML = `<tr><td colspan="${colCount}" class="no-data" style="text-align: center;">${message}</td></tr>`;
}
function createEmptyStats() {
  return {
    "Đã Thanh Toán (có bill)": { count: 0, amount: 0 },
    "Bill 1 phần": { count: 0, amount: 0 },
    "Tổng đơn lên nội bộ": { count: 0, amount: 0 },
    "Tổng đơn đủ đkien đẩy vh": { count: 0, amount: 0 },
    "Tổng đơn lên vận hành": { count: 0, amount: 0 },
    "Giao Thành Công": { count: 0, amount: 0 },
    "Đang Giao": { count: 0, amount: 0 },
    "Chưa Giao": { count: 0, amount: 0 },
    Hoàn: { count: 0, amount: 0 },
    "chờ check": { count: 0, amount: 0 },
    "Trống trạng thái": { count: 0, amount: 0 },
  };
}
function updateSummaryInfo(filteredData, summaryElementId) {
  const totalOrders = filteredData.length,
    totalAmount = filteredData.reduce((sum, row) => {
      let amountValue = row["Tổng tiền VNĐ"] || row.Tổng_tiền_VNĐ || 0;
      const numericValue =
        parseFloat(String(amountValue).replace(/[^\d.-]/g, "")) || 0;
      return sum + numericValue;
    }, 0),
    formattedAmount = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(totalAmount);
  document.getElementById(
    summaryElementId
  ).innerHTML = `Tổng đơn: <b>${totalOrders}</b> | Tổng tiền: <b style="color:var(--success-color)">${formattedAmount}</b>`;
}
function updateDetailedSummaryTable(filteredData) {
  const summaryTableBody = document.getElementById("summaryTableBody");
  summaryTableBody.innerHTML = "";
  if (filteredData.length === 0) {
    showError("Không có dữ liệu báo cáo khớp với bộ lọc.", "summaryTableBody");
    renderReportCharts({}, {});
    return;
  }
  const staffStats = {},
    grandTotal = createEmptyStats();
  filteredData.forEach((row) => {
    const staffName = row["NV Vận đơn"] || row.NV_Vận_đơn || "Chưa có NV",
      shippingCompany =
        row["Đơn vị vận chuyển"] || row.Đơn_vị_vận_chuyển || "Không xác định";
    if (!staffStats[staffName])
      staffStats[staffName] = { _total: createEmptyStats() };
    if (!staffStats[staffName][shippingCompany])
      staffStats[staffName][shippingCompany] = createEmptyStats();
    const statsToUpdate = [
        staffStats[staffName][shippingCompany],
        staffStats[staffName]._total,
        grandTotal,
      ],
      numericAmount =
        parseFloat(
          String(row["Tổng tiền VNĐ"] || row.Tổng_tiền_VNĐ || 0).replace(
            /[^\d.-]/g,
            ""
          )
        ) || 0,
      paymentStatus = row["Trạng thái thu tiền"] || "",
      deliveryStatus = row["Trạng thái giao hàng NB"] || "",
      checkResult = row["Kết quả Check"] || "",
      trackingCode = row["Mã Tracking"] || "";
    statsToUpdate.forEach((stats) => {
      stats["Tổng đơn lên nội bộ"].count++;
      if (paymentStatus === "Có bill") {
        stats["Đã Thanh Toán (có bill)"].count++;
        stats["Đã Thanh Toán (có bill)"].amount += numericAmount;
      }
      if (paymentStatus === "Có bill 1 phần") stats["Bill 1 phần"].count++;
      if (checkResult === "OK") stats["Tổng đơn đủ đkien đẩy vh"].count++;
      if (shippingCompany && shippingCompany !== "Không xác định")
        stats["Tổng đơn lên vận hành"].count++;
      if (deliveryStatus === "Giao Thành Công")
        stats["Giao Thành Công"].count++;
      else if (deliveryStatus === "Hoàn") stats.Hoàn.count++;
      else if (trackingCode) stats["Đang Giao"].count++;
      else if (deliveryStatus === "Chưa Giao") stats["Chưa Giao"].count++;
      else if (deliveryStatus === "chờ check") stats["chờ check"].count++;
      else if (!deliveryStatus) stats["Trống trạng thái"].count++;
    });
  });
  const grandTotalRow = renderSummaryRow(
    "TỔNG TOÀN BỘ",
    "Tất cả NV & DVVC",
    grandTotal
  );
  grandTotalRow.className = "summary-grand-total";
  summaryTableBody.appendChild(grandTotalRow);
  Object.keys(staffStats)
    .sort()
    .forEach((staffName) => {
      const staffData = staffStats[staffName],
        totalRow = renderSummaryRow(staffName, "Tất cả DVVC", staffData._total);
      totalRow.className = "summary-staff-total";
      summaryTableBody.appendChild(totalRow);
    });
  renderReportCharts(staffStats, grandTotal);
}
function renderReportCharts(staffStats, grandTotal) {
  if (staffChartInstance) staffChartInstance.destroy();
  if (deliveryStatusChartInstance) deliveryStatusChartInstance.destroy();
  const staffCtx = document.getElementById("staffOrderChart").getContext("2d"),
    sortedStaffNames = Object.keys(staffStats).sort(
      (a, b) =>
        staffStats[b]._total["Tổng đơn lên vận hành"].count -
        staffStats[a]._total["Tổng đơn lên vận hành"].count
    );
  staffChartInstance = new Chart(staffCtx, {
    type: "bar",
    data: {
      labels: sortedStaffNames,
      datasets: [
        {
          label: "Tổng đơn lên vận hành",
          data: sortedStaffNames.map(
            (name) => staffStats[name]._total["Tổng đơn lên vận hành"].count
          ),
          backgroundColor: "rgba(39, 174, 96, 0.7)",
          borderColor: "rgba(39, 174, 96, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: !0,
      maintainAspectRatio: !1,
      plugins: {
        title: {
          display: !0,
          text: "Số Lượng Đơn Lên Vận Hành Theo Nhân Viên",
          font: { size: 16 },
        },
        legend: { display: !1 },
      },
      scales: {
        y: { beginAtZero: !0, title: { display: !0, text: "Số lượng đơn" } },
      },
    },
  });
  const statusCtx = document
      .getElementById("deliveryStatusChart")
      .getContext("2d"),
    statusData = grandTotal["Tổng đơn lên nội bộ"]
      ? [
          grandTotal["Giao Thành Công"].count,
          grandTotal.Hoàn.count,
          grandTotal["Đang Giao"].count,
          grandTotal["Chưa Giao"].count,
          grandTotal["chờ check"].count,
          grandTotal["Trống trạng thái"].count,
        ]
      : [];
  deliveryStatusChartInstance = new Chart(statusCtx, {
    type: "doughnut",
    data: {
      labels: [
        "Giao Thành Công",
        "Hoàn",
        "Đang Giao",
        "Chưa Giao",
        "Chờ Check",
        "Trống",
      ],
      datasets: [
        {
          label: "Trạng thái đơn hàng",
          data: statusData,
          backgroundColor: [
            "#2ecc71",
            "#e74c3c",
            "#3498db",
            "#f1c40f",
            "#9b59b6",
            "#95a5a6",
          ],
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: !0,
      maintainAspectRatio: !1,
      plugins: {
        title: {
          display: !0,
          text: "Tổng Quan Trạng Thái Giao Hàng",
          font: { size: 16 },
        },
        legend: { position: "top" },
      },
    },
  });
}
function renderSummaryRow(staffName, companyName, data) {
  const tr = document.createElement("tr");
  tr.insertCell().textContent = staffName;
  tr.insertCell().textContent = companyName;
  tr.insertCell().textContent = data["Đã Thanh Toán (có bill)"].count;
  const paidAmountCell = tr.insertCell();
  paidAmountCell.textContent =
    new Intl.NumberFormat("vi-VN").format(
      data["Đã Thanh Toán (có bill)"].amount
    ) + " ₫";
  tr.insertCell().textContent = data["Bill 1 phần"].count;
  tr.insertCell().textContent = data["Tổng đơn lên nội bộ"].count;
  tr.insertCell().textContent = data["Tổng đơn đủ đkien đẩy vh"].count;
  tr.insertCell().textContent = data["Tổng đơn lên vận hành"].count;
  const shippingRate =
      data["Tổng đơn lên nội bộ"].count > 0
        ? (data["Tổng đơn lên vận hành"].count /
            data["Tổng đơn lên nội bộ"].count) *
          100
        : 0,
    shippingRateCell = tr.insertCell();
  shippingRateCell.textContent = shippingRate.toFixed(2) + "%";
  shippingRateCell.className = shippingRate > 70 ? "positive" : "negative";
  tr.insertCell().textContent = data["Giao Thành Công"].count;
  tr.insertCell().textContent = data["Đang Giao"].count;
  tr.insertCell().textContent = data["Chưa Giao"].count;
  tr.insertCell().textContent = data.Hoàn.count;
  tr.insertCell().textContent = data["chờ check"].count;
  tr.insertCell().textContent = data["Trống trạng thái"].count;
  const paymentSuccessRate =
      data["Giao Thành Công"].count > 0
        ? (data["Đã Thanh Toán (có bill)"].count /
            data["Giao Thành Công"].count) *
          100
        : 0,
    paymentRateCell = tr.insertCell();
  paymentRateCell.textContent = paymentSuccessRate.toFixed(2) + "%";
  paymentRateCell.className = paymentSuccessRate > 80 ? "positive" : "negative";
  const feeRate =
      data["Tổng đơn lên vận hành"].count > 0
        ? (data["Giao Thành Công"].count /
            data["Tổng đơn lên vận hành"].count) *
          100
        : 0,
    feeRateCell = tr.insertCell();
  feeRateCell.textContent = feeRate.toFixed(2) + "%";
  feeRateCell.className = feeRate > 80 ? "positive" : "negative";
  return tr;
}
function getDOMCellValue(e) {
  if (!e) return "";
  const t = e.querySelector("select");
  if (t) return t.value;
  const n = e.querySelector("input");
  return n ? n.value : e.textContent.trim();
}
function updateSelectionSummary() {
  const summaryEl = document.getElementById("selectionSummary");
  if (
    !summaryEl ||
    !document.getElementById("contentData").classList.contains("active")
  ) {
    if (summaryEl) summaryEl.innerHTML = "";
    return;
  }
  if (selectedCells.size <= 1) {
    summaryEl.innerHTML = "";
    return;
  }
  let totalSum = 0,
    numericCount = 0,
    nonBlankCount = 0;
  selectedCells.forEach((cell) => {
    const value = getDOMCellValue(cell);
    if (value !== "") nonBlankCount++;
    const numericValue = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
    if (!isNaN(numericValue)) {
      totalSum += numericValue;
      numericCount++;
    }
  });
  let summaryParts = [`Count: <b>${nonBlankCount}</b>`];
  if (numericCount > 0)
    summaryParts.push(`Sum: <b>${totalSum.toLocaleString("vi-VN")}</b>`);
  summaryEl.innerHTML = summaryParts.join(" | ");
}
function setupCellSelection(tableBodyId) {
  const tableBody = document.getElementById(tableBodyId);
  if (!tableBody) return;
  let lastClickTime = 0,
    lastClickCell = null;
  tableBody.addEventListener("mousedown", (e) => {
    const td = e.target.closest("td");
    if (!td) return;
    if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      isMouseDown = !0;
      startCell = td;
      selectedCells.forEach((cell) => cell.classList.remove("cell-selected"));
      selectedCells.clear();
      td.classList.add("cell-selected");
      selectedCells.add(td);
      e.preventDefault();
    }
  });
  tableBody.addEventListener("click", (e) => {
    const td = e.target.closest("td");
    if (!td) return;
    if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;
    const currentTime = new Date().getTime(),
      isDoubleClick = currentTime - lastClickTime < 300 && lastClickCell === td;
    if (isDoubleClick) handleEditCell(td, tableBodyId);
    else {
      if (e.shiftKey && startCell) selectCellsBetween(startCell, td);
      else if (e.ctrlKey || e.metaKey) {
        td.classList.toggle("cell-selected");
        if (td.classList.contains("cell-selected")) selectedCells.add(td);
        else selectedCells.delete(td);
      } else {
        selectedCells.forEach((cell) => cell.classList.remove("cell-selected"));
        selectedCells.clear();
        td.classList.add("cell-selected");
        selectedCells.add(td);
      }
      startCell = td;
    }
    lastClickTime = currentTime;
    lastClickCell = td;
    updateSelectionSummary();
  });
  tableBody.addEventListener("mouseover", (e) => {
    if (isMouseDown) {
      const td = e.target.closest("td");
      if (td) selectCellsBetween(startCell, td);
    }
  });
  document.addEventListener("mouseup", () => {
    if (isMouseDown) {
      isMouseDown = !1;
      updateSelectionSummary();
    }
  });
}
function selectCellsBetween(start, end) {
  if (!start || !end || start.closest("tbody") !== end.closest("tbody")) return;
  const tableBody = start.closest("tbody"),
    rows = Array.from(tableBody.rows),
    startRowIndex = rows.findIndex((row) => row.contains(start)),
    endRowIndex = rows.findIndex((row) => row.contains(end)),
    startColIndex = start.cellIndex,
    endColIndex = end.cellIndex,
    minRow = Math.min(startRowIndex, endRowIndex),
    maxRow = Math.max(startRowIndex, endRowIndex),
    minCol = Math.min(startColIndex, endColIndex),
    maxCol = Math.max(startColIndex, endColIndex),
    newSelection = new Set();
  for (let i = minRow; i <= maxRow; i++)
    for (let j = minCol; j <= maxCol; j++) {
      const cell = rows[i]?.cells[j];
      if (cell) newSelection.add(cell);
    }
  selectedCells.forEach((cell) => {
    if (!newSelection.has(cell)) cell.classList.remove("cell-selected");
  });
  newSelection.forEach((cell) => {
    if (!selectedCells.has(cell)) cell.classList.add("cell-selected");
  });
  selectedCells = newSelection;
}
function handleEditCell(td, tableBodyId) {
  if (
    !td.classList.contains("editable") ||
    td.classList.contains("editing") ||
    td.querySelector("select")
  )
    return;
  const dateInput = td.querySelector("input.date-input");
  if (dateInput) {
    dateInput.focus();
    return;
  }
  const originalValue = td.textContent,
    input = document.createElement("input");
  input.type = "text";
  input.value = originalValue;
  td.textContent = "";
  td.appendChild(input);
  td.classList.add("editing");
  input.focus();
  const finishEdit = (save) => {
      const newValue = save ? input.value.trim() : originalValue;
      td.textContent = newValue;
      td.classList.remove("editing");
      if (save && newValue !== originalValue) {
        td.classList.add("highlight");
        const rowIndex = parseInt(td.closest("tr").dataset.rowIndex),
          colIndex = td.cellIndex,
          colName = displayColumns[colIndex],
          config = allTabConfigs.find((c) => c.table.body === tableBodyId);
        if (!isNaN(rowIndex) && config) {
          const currentChanges = config.changedRows.get(rowIndex) || {};
          currentChanges[colName] = newValue;
          config.changedRows.set(rowIndex, currentChanges);
        }
      }
      input.removeEventListener("blur", onBlur);
      input.removeEventListener("keydown", onKeyDown);
    },
    onBlur = () => finishEdit(!0),
    onKeyDown = (e) => {
      "Enter" === e.key
        ? (e.preventDefault(), finishEdit(!0))
        : "Escape" === e.key && (e.preventDefault(), finishEdit(!1));
    };
  input.addEventListener("blur", onBlur);
  input.addEventListener("keydown", onKeyDown);
}
function copySelectedCells() {
  if (selectedCells.size === 0) return;
  const sortedCells = Array.from(selectedCells).sort(
      (a, b) =>
        a.parentNode.rowIndex - b.parentNode.rowIndex ||
        a.cellIndex - b.cellIndex
    ),
    firstCell = sortedCells[0],
    minRow = firstCell.parentNode.rowIndex,
    minCol = sortedCells.reduce(
      (min, cell) => Math.min(min, cell.cellIndex),
      1 / 0
    ),
    grid = new Map();
  sortedCells.forEach((cell) => {
    const r = cell.parentNode.rowIndex - minRow,
      c = cell.cellIndex - minCol;
    if (!grid.has(r)) grid.set(r, new Map());
    grid.get(r).set(c, getDOMCellValue(cell));
  });
  let tsv = "";
  const maxR = Math.max(...Array.from(grid.keys())),
    maxC = Math.max(
      ...Array.from(grid.values()).flatMap((row) => Array.from(row.keys()))
    );
  for (let r = 0; r <= maxR; r++) {
    for (let c = 0; c <= maxC; c++) {
      tsv += grid.get(r)?.get(c) || "";
      if (c < maxC) tsv += "\t";
    }
    if (r < maxR) tsv += "\n";
  }
  navigator.clipboard
    .writeText(tsv)
    .then(() => showTempMessage(`Đã sao chép ${selectedCells.size} ô`))
    .catch((err) => console.error("Lỗi sao chép:", err));
}
function pasteToSelectedCells(text) {
  if (selectedCells.size === 0) return;
  const dataGrid = text.split("\n").map((row) => row.split("\t")),
    sortedCells = Array.from(selectedCells).sort(
      (a, b) =>
        a.parentNode.rowIndex - b.parentNode.rowIndex ||
        a.cellIndex - b.cellIndex
    ),
    firstCell = sortedCells[0],
    table = firstCell.closest("table");
  if (!table) return;
  const startRowIndex = Array.from(table.rows).indexOf(firstCell.closest("tr")),
    startColIndex = firstCell.cellIndex;
  let pasteCount = 0;
  if (dataGrid.length === 1 && dataGrid[0].length === 1) {
    const value = dataGrid[0][0];
    sortedCells.forEach((cell) => {
      if (updateCellValue(cell, value)) pasteCount++;
    });
  } else
    dataGrid.forEach((row, r) => {
      row.forEach((value, c) => {
        const targetRow = table.rows[startRowIndex + r];
        if (targetRow) {
          const targetCell = targetRow.cells[startColIndex + c];
          if (targetCell && updateCellValue(targetCell, value)) pasteCount++;
        }
      });
    });
  showTempMessage(`Đã dán ${pasteCount} giá trị`);
  updateSelectionSummary();
}
function clearSelectedCells() {
  if (selectedCells.size === 0) return;
  let clearCount = 0;
  selectedCells.forEach((cell) => {
    if (updateCellValue(cell, "")) clearCount++;
  });
  if (clearCount > 0) showTempMessage(`Đã xóa nội dung ${clearCount} ô`);
}
function updateCellValue(cell, value) {
  if (!cell || !cell.classList.contains("editable")) return !1;
  const select = cell.querySelector("select"),
    dateInput = cell.querySelector("input.date-input"),
    rowIndex = cell.closest("tr").dataset.rowIndex,
    config = allTabConfigs.find(
      (c) => c.table.body === cell.closest("tbody").id
    );
  let changed = !1;
  if (select) {
    const optionExists = [...select.options].some((opt) => opt.value === value);
    if (optionExists && select.value !== value) {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: !0 }));
      changed = !0;
    }
  } else if (dateInput) {
    if (dateInput.value !== value) {
      dateInput.value = value;
      dateInput.dispatchEvent(new Event("input", { bubbles: !0 }));
      changed = !0;
    }
  } else if (cell.textContent !== value) {
    cell.textContent = value;
    cell.classList.add("highlight");
    changed = !0;
  }
  if (changed && rowIndex && config) {
    const colIndex = cell.cellIndex,
      colName = displayColumns[colIndex],
      currentChanges = config.changedRows.get(parseInt(rowIndex)) || {};
    currentChanges[colName] = value;
    config.changedRows.set(parseInt(rowIndex), currentChanges);
  }
  return changed;
}
function showTempMessage(e, t = !1) {
  document.querySelector(".temp-message")?.remove();
  const n = document.createElement("div");
  (n.textContent = e),
    Object.assign(n.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      backgroundColor: t ? "rgba(220, 53, 69, 0.9)" : "rgba(40, 167, 69, 0.9)",
      color: "white",
      padding: "12px 20px",
      borderRadius: "5px",
      zIndex: "2000",
      transition: "opacity 0.5s",
      opacity: "1",
      boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
    }),
    document.body.appendChild(n),
    setTimeout(() => {
      (n.style.opacity = "0"), setTimeout(() => n.remove(), 500);
    }, 3e3);
}
async function sendImmediateUpdate(e) {
  try {
    fetch(IMMEDIATE_UPDATE_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ rows: JSON.stringify([e]) }),
    });
    setTimeout(
      () =>
        showTempMessage(`Đã cập nhật trạng thái cho đơn: ${e["Mã đơn hàng"]}`),
      3e3
    );
  } catch (e) {
    console.error("Lỗi khi cập nhật tức thì:", e),
      showTempMessage(`Lỗi cập nhật: ${e.message}`, !0);
  }
}

// async function handleData(response){
//   document.getElementById('loader-overlay').style.display='none';
//   allTabConfigs.forEach(config=>{document.getElementById(config.controls.refreshBtn).innerHTML='<span class="refresh-icon">↻</span> Load'});
//   allData=[],staffFilteredData=[],japanData=[];
//   changedRows.clear(),japanChangedRows.clear(),allRegionsChangedRows.clear();

//   if(response.error||!Array.isArray(response.rows)){
//     const errorMsg='Lỗi hoặc không có dữ liệu: '+(response.error||'Định dạng dữ liệu không đúng');
//     allTabConfigs.forEach(config=>showError(errorMsg,config.table.body));
//     return;
//   }

//   allData=response.rows.sort((a,b)=>(parseDateString(b["Ngày lên đơn"]||b["Thời gian lên đơn"])||0)-(parseDateString(a["Ngày lên đơn"]||a["Thời gian lên đơn"])||0));
//   generateDatalistOptions();

//   const staffId=getUrlParameter('id'),staffId1=getUrlParameter('id1');
//   if(!staffId&&!staffId1){
//     showError('Thiếu tham số ID nhân viên trong URL',mainTabConfig.table.body);
//   } else {
//     try{
//       currentStaff=await fetchStaffInfo(staffId,staffId1);
//       let staffInfo=`Nhân viên: ${currentStaff.ho_va_ten}`;
//       if(staffId1&&staffId1!==staffId)staffInfo+=` và ${teamMembers.find(name=>name!==currentStaff.ho_va_ten)||''}`;
//       if(currentStaff.vi_tri==="Leader")staffInfo+=` (Leader - Team ${currentStaff.team})`;
//       document.getElementById('userInfo').textContent=staffInfo;

//       if(currentStaff.vi_tri_van_don==="Lên đơn FFM"&&!editableCols.includes("Đơn vị vận chuyển")) {
//           editableCols.push("Đơn vị vận chuyển");
//       }

//       document.getElementById('tabAllRegions').style.display=currentStaff?.vi_tri==="Leader"?'':'none';

//       staffFilteredData=allData.filter(row=>{
//         const isTeamMemberOrder=teamMembers.includes(row["NV Vận đơn"]||row["NV_Vận_đơn"]||'');
//         return currentStaff.vi_tri_van_don==="Lên đơn FFM" ? isTeamMemberOrder||(row["Kết quả Check"]||"")==="OK" : isTeamMemberOrder;
//       });
//       initializeTab(mainTabConfig,staffFilteredData);
//     } catch(error) {
//       showError(error.message,mainTabConfig.table.body);
//     }
//   }

//   japanData=allData.filter(row=>(row['khu vực']||row['Khu vực'])==='Nhật Bản');
//   initializeTab(allRegionsTabConfig,allData);
//   initializeTab(japanTabConfig,japanData);
//   populateReportFilters();
//   applyReportFilters();
// }

function initializeTab(config, data) {
  generateDynamicOptions(config, data);
  populateExternalFilters(config);
  renderHeader(config);
  applyAllFilters(config);
  setupCellSelection(config.table.body);
}
function generateDynamicOptions(config, data) {
  const options = {};
  columnsToMakeDynamic.forEach((colName) => {
    const dataKey = columnDisplayMapping[colName] || colName;
    const uniqueValues = new Set(
      data
        .map(
          (row) =>
            row[dataKey] ||
            row[dataKey.replace(/ /g, "_")] ||
            (dataKey === "khu vực" ? row["Khu vực"] || "" : "")
        )
        .filter(Boolean)
    );
    options[colName] = Array.from(uniqueValues).sort((a, b) =>
      String(a).localeCompare(String(b), "vi")
    );
  });
  if (config === mainTabConfig) dynamicFilterOptions = options;
  else if (config === japanTabConfig) japanDynamicFilterOptions = options;
  else if (config === allRegionsTabConfig)
    allRegionsDynamicFilterOptions = options;
}
function populateExternalFilters(config) {
  const options = config.dynamicOptions();
  const productFilter = document.getElementById(config.controls.product);
  productFilter.innerHTML = '<option value="">Tất cả sản phẩm</option>';
  (options["Mặt hàng"] || []).forEach((opt) =>
    productFilter.add(new Option(opt, opt))
  );
  if (config.controls.market) {
    const marketFilter = document.getElementById(config.controls.market);
    marketFilter.innerHTML = '<option value="">Tất cả khu vực</option>';
    (options["khu vực"] || []).forEach((opt) =>
      marketFilter.add(new Option(opt, opt))
    );
  }
  if (config.controls.staff) {
    const staffFilter = document.getElementById(config.controls.staff);
    staffFilter.innerHTML = '<option value="">Tất cả NV Vận đơn</option>';
    (options["NV Vận đơn"] || []).forEach((opt) =>
      staffFilter.add(new Option(opt, opt))
    );
  }
}
function generateDatalistOptions() {
  datalistOptions = {};
  datalistFilterCols.forEach((colName) => {
    const dataKey = columnDisplayMapping[colName] || colName;
    const uniqueValues = new Set(
      allData
        .map((row) => row[dataKey] || row[dataKey.replace(/ /g, "_")])
        .filter(Boolean)
    );
    datalistOptions[colName] = Array.from(uniqueValues);
  });
}

// function applyAllFilters(config){
//     let dataToFilter=[...config.data()];
//     const tableHead=document.getElementById(config.table.head);
//     if(!tableHead.querySelector('tr')){ renderTableBody(config,dataToFilter); updateSummaryInfo(dataToFilter,config.controls.summary); return; }

//     const startDate=document.getElementById(config.controls.startDate).value;
//     const endDate=document.getElementById(config.controls.endDate).value;
//     if(startDate||endDate){
//         const start=startDate?new Date(startDate):null;
//         const end=endDate?new Date(endDate):null;
//         if(start)start.setHours(0,0,0,0);
//         if(end)end.setHours(23,59,59,999);
//         dataToFilter=dataToFilter.filter(row=>{const orderDate=parseDateString(row["Ngày lên đơn"]||row["Thời gian lên đơn"]);return orderDate&&(!start||orderDate>=start)&&(!end||orderDate<=end)});
//     }

//     const productValue=document.getElementById(config.controls.product).value;
//     if(productValue)dataToFilter=dataToFilter.filter(row=>(row["Mặt hàng"]||'')===productValue);

//     if(config.controls.market){const marketValue=document.getElementById(config.controls.market).value;if(marketValue)dataToFilter=dataToFilter.filter(row=>(row["Khu vực"]||row["khu vực"]||'')===marketValue)}
//     if(config.controls.staff){const staffValue=document.getElementById(config.controls.staff).value;if(staffValue)dataToFilter=dataToFilter.filter(row=>(row["NV Vận đơn"]||row["NV_Vận_đơn"]||'')===staffValue)}

//     const filterValues={};
//     tableHead.querySelectorAll('[data-column]').forEach(filter=>{
//         const colName=filter.dataset.column;
//         if(!filterValues[colName])filterValues[colName]={};
//         if(filter.dataset.filterType){filterValues[colName][filter.dataset.filterType]=filter.value.toLowerCase()}
//         else if(filter.classList.contains('multi-select-container')){const selected=Array.from(filter.querySelectorAll('input:checked')).map(cb=>cb.value);if(selected.length>0)filterValues[colName].multi=new Set(selected)}
//         else if(filter.tagName==='SELECT'){if(filter.value)filterValues[colName].single=filter.value}
//         else if(filter.classList.contains('filter-input')){filterValues[colName].text=filter.value.toLowerCase()}
//     });

//     if(Object.keys(filterValues).length>0){
//         dataToFilter=dataToFilter.filter(row=>{
//             for(const colName in filterValues){
//                 const dataKey=columnDisplayMapping[colName]||colName;
//                 let cellValue=row[dataKey]??(row[dataKey.replace(/ /g,'_')]||(dataKey==='khu vực'?row['Khu vực']||'':''));
//                 const cellValueLower=String(cellValue).toLowerCase();
//                 const colFilters=filterValues[colName];
//                 if(colFilters.text&&!cellValueLower.includes(colFilters.text))return!1;
//                 if(colFilters.single&&String(cellValue)!==colFilters.single)return!1;
//                 if(colFilters.multi&&!colFilters.multi.has(String(cellValue)))return!1;
//                 if(colFilters.contains&&!cellValueLower.includes(colFilters.contains))return!1;
//                 if(colFilters.notcontains&&colFilters.notcontains!==''&&cellValueLower.includes(colFilters.notcontains))return!1
//             }
//             return!0
//         })
//     }
//     updateSummaryInfo(dataToFilter,config.controls.summary);
//     renderTableBody(config,dataToFilter)
// }

function renderHeader(config) {
  const header = document.getElementById(config.table.head);
  const options = config.dynamicOptions();
  header.innerHTML = "";
  const tr = document.createElement("tr");
  const fixedCount = getFixedColumnCount();
  const debouncedFilter = () => {
    clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(() => applyAllFilters(config), 300);
  };
  const immediateFilter = () => applyAllFilters(config);
  displayColumns.forEach((colName, index) => {
    const th = document.createElement("th");
    th.textContent = colName;
    if (index < fixedCount) th.classList.add("fixed-column");
    th.appendChild(document.createElement("br"));
    if (colName === "Mã Tracking") {
      const container = document.createElement("div");
      container.className = "tracking-filter-container";
      const inputContains = document.createElement("input");
      inputContains.type = "text";
      inputContains.placeholder = "Chứa ký tự...";
      inputContains.className = "filter-input";
      inputContains.dataset.column = colName;
      inputContains.dataset.filterType = "contains";
      inputContains.addEventListener("input", debouncedFilter);
      const inputNotContains = document.createElement("input");
      inputNotContains.type = "text";
      inputNotContains.placeholder = "Không chứa...";
      inputNotContains.className = "filter-input";
      inputNotContains.dataset.column = colName;
      inputNotContains.dataset.filterType = "notcontains";
      inputNotContains.addEventListener("input", debouncedFilter);
      container.append(inputContains, inputNotContains);
      th.appendChild(container);
    } else if (singleSelectFilterCols.includes(colName) && options[colName]) {
      const filterElement = document.createElement("select");
      filterElement.className = "filter-select";
      filterElement.dataset.column = colName;
      filterElement.add(new Option(`Tất cả ${colName}`, ""));
      options[colName].forEach((opt) =>
        filterElement.add(new Option(opt, opt))
      );
      filterElement.addEventListener("change", immediateFilter);
      th.appendChild(filterElement);
    } else if (options[colName]) {
      const container = document.createElement("div");
      container.className = "multi-select-container";
      container.dataset.column = colName;
      const button = document.createElement("button");
      button.className = "multi-select-button";
      button.textContent = `Tất cả ${colName}`;
      const dropdown = document.createElement("div");
      dropdown.className = "checkbox-dropdown";
      options[colName].forEach((opt) => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = opt;
        checkbox.addEventListener("change", () => {
          const selectedCount =
            dropdown.querySelectorAll("input:checked").length;
          button.textContent =
            selectedCount === 0
              ? `Tất cả ${colName}`
              : `${selectedCount} lựa chọn`;
          immediateFilter();
        });
        label.append(checkbox, ` ${opt}`);
        dropdown.appendChild(label);
      });
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".checkbox-dropdown.show").forEach((d) => {
          if (d !== dropdown) d.classList.remove("show");
        });
        dropdown.classList.toggle("show");
      });
      container.append(button, dropdown);
      th.appendChild(container);
    } else if (datalistFilterCols.includes(colName)) {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "filter-input";
      input.placeholder = `Lọc ${colName}...`;
      input.dataset.column = colName;
      const datalistId = `datalist-${colName.replace(/[^a-zA-Z0-9]/g, "-")}`;
      input.setAttribute("list", datalistId);
      const datalist = document.createElement("datalist");
      datalist.id = datalistId;
      if (datalistOptions[colName]) {
        datalistOptions[colName].forEach((opt) => {
          const option = document.createElement("option");
          option.value = opt;
          datalist.appendChild(option);
        });
      }
      input.addEventListener("input", debouncedFilter);
      th.append(input, datalist);
    } else {
      const filterElement = document.createElement("input");
      filterElement.type = "text";
      filterElement.className = "filter-input";
      filterElement.placeholder = `Lọc ${colName}...`;
      filterElement.dataset.column = colName;
      filterElement.addEventListener("input", debouncedFilter);
      th.appendChild(filterElement);
    }
    tr.appendChild(th);
  });
  header.appendChild(tr);
  window.addEventListener("click", (e) => {
    if (!e.target.closest(".multi-select-container")) {
      document
        .querySelectorAll(".checkbox-dropdown.show")
        .forEach((d) => d.classList.remove("show"));
    }
  });
}

function setupTabControls(config) {
  document
    .getElementById(config.controls.refreshBtn)
    .addEventListener("click", refreshData);
  document
    .getElementById(config.controls.updateBtn)
    .addEventListener("click", () => updateAllChangedRows(config));
  const filterFunction = () => applyAllFilters(config);
  document
    .getElementById(config.controls.startDate)
    .addEventListener("change", filterFunction);
  document
    .getElementById(config.controls.endDate)
    .addEventListener("change", filterFunction);
  document
    .getElementById(config.controls.product)
    .addEventListener("change", filterFunction);
  if (config.controls.market)
    document
      .getElementById(config.controls.market)
      .addEventListener("change", filterFunction);
  if (config.controls.staff)
    document
      .getElementById(config.controls.staff)
      .addEventListener("change", filterFunction);
  document
    .getElementById(config.controls.clearBtn)
    .addEventListener("click", () => {
      document.getElementById(config.controls.startDate).value = "";
      document.getElementById(config.controls.endDate).value = "";
      document.getElementById(config.controls.product).selectedIndex = 0;
      if (config.controls.market)
        document.getElementById(config.controls.market).selectedIndex = 0;
      if (config.controls.staff)
        document.getElementById(config.controls.staff).selectedIndex = 0;
      const header = document.getElementById(config.table.head);
      header.querySelectorAll(".filter-input").forEach((f) => (f.value = ""));
      header
        .querySelectorAll(".filter-select")
        .forEach((f) => (f.selectedIndex = 0));
      header
        .querySelectorAll(".multi-select-container")
        .forEach((container) => {
          container
            .querySelectorAll("input:checked")
            .forEach((cb) => (cb.checked = !1));
          container.querySelector(
            ".multi-select-button"
          ).textContent = `Tất cả ${container.dataset.column}`;
        });
      applyAllFilters(config);
    });
}
// function setupReportControls(){const{controls}=reportTabConfig;const staffBtn=document.getElementById(controls.staffBtn),staffDropdown=document.getElementById(controls.staffDropdown);document.getElementById(controls.startDate).addEventListener('change',applyReportFilters);document.getElementById(controls.endDate).addEventListener('change',applyReportFilters);document.getElementById(controls.product).addEventListener('change',applyReportFilters);document.getElementById(controls.market).addEventListener('change',applyReportFilters);document.getElementById(controls.clearBtn).addEventListener('click',()=>{document.getElementById(controls.startDate).value='';document.getElementById(controls.endDate).value='';document.getElementById(controls.product).selectedIndex=0;document.getElementById(controls.market).selectedIndex=0;staffDropdown.querySelectorAll('input:checked').forEach(cb=>cb.checked=!1);updateStaffFilterButtonText();applyReportFilters()});staffBtn.addEventListener('click',e=>{e.stopPropagation();staffDropdown.classList.toggle('show')});staffDropdown.addEventListener('click',e=>{if(e.target.tagName!=='LABEL'&&e.target.tagName!=='INPUT')e.stopPropagation()});window.addEventListener('click',e=>{if(!e.target.closest('.controls .multi-select-container')&&staffDropdown.classList.contains('show'))staffDropdown.classList.remove('show')})}
function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn"),
    contents = document.querySelectorAll(".content-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      selectedCells.forEach((cell) => cell.classList.remove("cell-selected"));
      selectedCells.clear();
      isMouseDown = !1;
      startCell = null;
      tabs.forEach((item) => item.classList.remove("active"));
      contents.forEach((content) => content.classList.remove("active"));
      tab.classList.add("active");
      const contentId = "content" + tab.id.substring(3);
      document.getElementById(contentId).classList.add("active");
      setTimeout(() => {
        handleFixedColumnCountChange();
        const summaryEl = document.getElementById("selectionSummary");
        if (summaryEl)
          summaryEl.innerHTML = contentId === "contentData" ? "" : "";
      }, 10);
    });
  });
}
function refreshData() {
  loadData();
}
function updateAllChangedRows(config) {
  if (config.changedRows.size === 0) {
    alert("Không có thay đổi nào để cập nhật");
    return;
  }
  const updateBtn = document.getElementById(config.controls.updateBtn);
  const statusEl = document.createElement("span");
  statusEl.className = "status";
  statusEl.textContent = "Đang xử lý...";
  updateBtn.appendChild(statusEl);
  updateBtn.disabled = !0;
  const rowsToSend = [];
  config.changedRows.forEach((changes, rowIndex) => {
    const originalData = config.data()[rowIndex];
    if (!originalData) {
      console.warn(
        `Không tìm thấy dữ liệu gốc cho rowIndex: ${rowIndex}. Bỏ qua.`
      );
      return;
    }
    const updatedRowData = { ...originalData };
    for (const displayName in changes) {
      const newValue = changes[displayName],
        dataKey = columnDisplayMapping[displayName] || displayName;
      updatedRowData[dataKey] = newValue;
    }
    delete updatedRowData["Thời gian lên đơn"];
    rowsToSend.push(updatedRowData);
  });
  if (rowsToSend.length === 0) {
    statusEl.textContent = "Không có dòng nào hợp lệ.";
    setTimeout(() => {
      if (statusEl.parentElement) updateBtn.removeChild(statusEl);
      updateBtn.disabled = !1;
    }, 3000);
    return;
  }
  fetch(POST_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ rows: JSON.stringify(rowsToSend) }),
  })
    .then(() => {
      statusEl.textContent = `Đã gửi ${rowsToSend.length} thay đổi.`;
      setTimeout(() => {
        alert(
          `Yêu cầu cập nhật ${rowsToSend.length} dòng đã được gửi. Vui lòng nhấn "Load" để xem kết quả.`
        );
        config.changedRows.clear();
        document
          .querySelectorAll(`#${config.table.body} .highlight`)
          .forEach((cell) => cell.classList.remove("highlight"));
        if (statusEl.parentElement) updateBtn.removeChild(statusEl);
        updateBtn.disabled = !1;
      }, 1500);
    })
    .catch((e) => {
      statusEl.textContent = "Lỗi mạng: " + e.message;
      statusEl.classList.add("error-status");
      setTimeout(() => {
        if (statusEl.parentElement) updateBtn.removeChild(statusEl);
        updateBtn.disabled = !1;
      }, 4000);
    });
}
// function populateReportFilters(){const{controls}=reportTabConfig;const productFilter=document.getElementById(controls.product),marketFilter=document.getElementById(controls.market),staffDropdown=document.getElementById(controls.staffDropdown);const allProducts=[...new Set(allData.map(r=>r["Mặt hàng"]).filter(Boolean))].sort(),allMarkets=[...new Set(allData.map(r=>r["khu vực"]||r["Khu vực"]).filter(Boolean))].sort(),allStaff=[...new Set(allData.map(r=>r["NV Vận đơn"]||r["NV_Vận_đơn"]).filter(Boolean))].sort();productFilter.innerHTML='<option value="">Tất cả sản phẩm</option>';allProducts.forEach(opt=>productFilter.add(new Option(opt,opt)));marketFilter.innerHTML='<option value="">Tất cả khu vực</option>';allMarkets.forEach(opt=>marketFilter.add(new Option(opt,opt)));staffDropdown.innerHTML='';const allLabel=document.createElement('label');allLabel.innerHTML=`<input type="checkbox" id="reportStaffSelectAll"> <b>Chọn tất cả</b>`;staffDropdown.appendChild(allLabel);allStaff.forEach(staffName=>{const label=document.createElement('label'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=staffName;checkbox.addEventListener('change',()=>{updateStaffFilterButtonText();applyReportFilters()});label.append(checkbox,` ${staffName}`);staffDropdown.appendChild(label)});document.getElementById('reportStaffSelectAll').addEventListener('change',e=>{staffDropdown.querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.checked=e.target.checked);updateStaffFilterButtonText();applyReportFilters()})}
function updateStaffFilterButtonText() {
  const { controls } = reportTabConfig;
  const staffBtn = document.getElementById(controls.staffBtn);
  const allStaffCheckboxes = document.querySelectorAll(
    `#${controls.staffDropdown} input:not(#reportStaffSelectAll)`
  );
  const selectedCount = Array.from(allStaffCheckboxes).filter(
    (cb) => cb.checked
  ).length;
  if (selectedCount === 0) staffBtn.textContent = "Tất cả NV Vận đơn";
  else if (selectedCount === allStaffCheckboxes.length) {
    staffBtn.textContent = "Tất cả NV đã chọn";
    document.getElementById("reportStaffSelectAll").checked = !0;
  } else {
    staffBtn.textContent = `${selectedCount} NV đã chọn`;
    document.getElementById("reportStaffSelectAll").checked = !1;
  }
}
// function applyReportFilters(){
//   let filteredReportData=[...allData];const{controls}=reportTabConfig;
//   const startDate=document.getElementById(controls.startDate).value,endDate=document.getElementById(controls.endDate).value;
//   const product=document.getElementById(controls.product).value,market=document.getElementById(controls.market).value;
//   const selectedStaff=Array.from(document.querySelectorAll(`#${controls.staffDropdown} input:checked:not(#reportStaffSelectAll)`)).map(cb=>cb.value);
//   if(startDate||endDate){const start=startDate?new Date(startDate):null,end=endDate?new Date(endDate):null;
//     if(start)start.setHours(0,0,0,0);if(end)end.setHours(23,59,59,999);
//     filteredReportData=filteredReportData.filter(row=>{const orderDate=parseDateString(row["Ngày lên đơn"]||row["Thời gian lên đơn"]);
//       return orderDate&&(!start||orderDate>=start)&&(!end||orderDate<=end)})}
// if(product)filteredReportData=filteredReportData.filter(row=>row["Mặt hàng"]===product);if(market)filteredReportData=filteredReportData.filter(row=>(row["khu vực"]||row["Khu vực"])===market);if(selectedStaff.length>0){const staffSet=new Set(selectedStaff);
//   filteredReportData=filteredReportData.filter(row=>staffSet.has(row["NV Vận đơn"]||row["NV_Vận_đơn"]))}
// updateDetailedSummaryTable(filteredReportData)}
// function loadData(){
//   document.getElementById('loader-overlay').style.display='flex';
//   allTabConfigs.forEach(config=>showError('Đang tải dữ liệu...',config.table.body));
//   const script=document.createElement('script');script.src=`${POST_URL}?callback=handleData&rand=${Math.random()}`;
//   document.querySelector('script[src^="https://script.google.com"]')?.remove();
//   document.body.appendChild(script)
// }

// currentPage = 1, limit = 50, hasMore = true, totalData = 0,
// filterCache = new Map(), lastFilterHash = '',
// dataIndex = { product: new Map(), market: new Map(), staff: new Map() };

//   const filterWorker = new Worker(URL.createObjectURL(new Blob([`
//   self.onmessage = function(e) {
//     const { data, filters } = e.data;
//     let filtered = [];
//     for (let i = 0; i < data.length; i++) {
//       const row = data[i];
//       let match = true;
//       if (filters.startDate && parseDateString(row["Ngày lên đơn"]) < filters.startDate) match = false;
//       if (filters.endDate && parseDateString(row["Ngày lên đơn"]) > filters.endDate) match = false;
//       if (filters.product && row["Mặt hàng"] !== filters.product) match = false;
//       if (filters.market && row["khu vực"] !== filters.market) match = false;
//       if (filters.staff && row["NV Vận đơn"] !== filters.staff) match = false;
//       for (const colName in filters.column) {
//         const colFilters = filters.column[colName];
//         let cellValue = row[colName] || row[colName.replace(/ /g, '_')] || (colName === 'khu vực' ? row['Khu vực'] || '' : '');
//         cellValue = String(cellValue).toLowerCase();
//         if (colFilters.text && !cellValue.includes(colFilters.text)) match = false;
//         if (colFilters.single && cellValue !== colFilters.single) match = false;
//         if (colFilters.multi && !colFilters.multi.has(cellValue)) match = false;
//         if (colFilters.contains && !cellValue.includes(colFilters.contains)) match = false;
//         if (colFilters.notcontains && colFilters.notcontains !== '' && cellValue.includes(colFilters.notcontains)) match = false;
//       }
//       if (match) filtered.push(row);
//     }
//     self.postMessage(filtered);
//   };
//   function parseDateString(dateString) {
//     if (!dateString || typeof dateString !== "string") return null;
//     const cleanedDateString = dateString.trim().replace(/[^\d\/\-\s]/g, "");
//     if (/^\d{4}-\d{2}-\d{2}/.test(cleanedDateString)) {
//       const d = new Date(cleanedDateString);
//       if (!isNaN(d.getTime())) return d;
//     }
//     const parts = cleanedDateString.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
//     if (parts) {
//       const month = parseInt(parts[1], 10), day = parseInt(parts[2], 10), year = parseInt(parts[3], 10);
//       if (year > 1000 && month > 0 && month <= 12 && day > 0 && day <= 31) {
//         return new Date(Date.UTC(year, month - 1, day));
//       }
//     }
//     return null;
//   }
// `], { type: 'application/javascript' })));
const filterWorker = new Worker("./filterWorker.js");

// const mainTabConfig = { data: () => staffFilteredData, changedRows, controls: { refreshBtn: 'refreshData', updateBtn: 'updateAll', clearBtn: 'clearFilters', startDate: 'startDateFilter', endDate: 'endDateFilter', product: 'productFilter', market: 'marketFilter', summary: 'summaryInfo' }, table: { head: 'tableHead', body: 'tableBody' }, dynamicOptions: () => dynamicFilterOptions };
//     const allRegionsTabConfig = { data: () => allData, changedRows: allRegionsChangedRows, controls: { refreshBtn: 'allRegionsRefreshData', updateBtn: 'allRegionsUpdateAll', clearBtn: 'allRegionsClearFilters', startDate: 'allRegionsStartDateFilter', endDate: 'allRegionsEndDateFilter', product: 'allRegionsProductFilter', market: 'allRegionsMarketFilter', staff: 'allRegionsStaffFilter', summary: 'allRegionsSummaryInfo' }, table: { head: 'allRegionsTableHead', body: 'allRegionsTableBody' }, dynamicOptions: () => allRegionsDynamicFilterOptions };
//     const japanTabConfig = { data: () => japanData, changedRows: japanChangedRows, controls: { refreshBtn: 'japanRefreshData', updateBtn: 'japanUpdateAll', clearBtn: 'japanClearFilters', startDate: 'japanStartDateFilter', endDate: 'japanEndDateFilter', product: 'japanProductFilter', staff: 'japanStaffFilter', summary: 'japanSummaryInfo' }, table: { head: 'japanTableHead', body: 'japanTableBody' }, dynamicOptions: () => japanDynamicFilterOptions };
//     const reportTabConfig = { controls: { clearBtn: 'reportClearFilters', startDate: 'reportStartDateFilter', endDate: 'reportEndDateFilter', product: 'reportProductFilter', market: 'reportMarketFilter', staffBtn: 'reportStaffFilterBtn', staffDropdown: 'reportStaffDropdown' } };
//     const allTabConfigs = [mainTabConfig, allRegionsTabConfig, japanTabConfig];
const mainTabConfig = {
  data: () => staffFilteredData,
  changedRows,
  controls: {
    refreshBtn: "refreshData",
    updateBtn: "updateAll",
    clearBtn: "clearFilters",
    startDate: "startDateFilter",
    endDate: "endDateFilter",
    product: "productFilter",
    market: "marketFilter",
    summary: "summaryInfo",
  },
  table: { head: "tableHead", body: "tableBody" },
  dynamicOptions: () => dynamicFilterOptions,
};
const allRegionsTabConfig = {
  data: () => allData,
  changedRows: allRegionsChangedRows,
  controls: {
    refreshBtn: "allRegionsRefreshData",
    updateBtn: "allRegionsUpdateAll",
    clearBtn: "allRegionsClearFilters",
    startDate: "allRegionsStartDateFilter",
    endDate: "allRegionsEndDateFilter",
    product: "allRegionsProductFilter",
    market: "allRegionsMarketFilter",
    staff: "allRegionsStaffFilter",
    summary: "allRegionsSummaryInfo",
  },
  table: { head: "allRegionsTableHead", body: "allRegionsTableBody" },
  dynamicOptions: () => allRegionsDynamicFilterOptions,
};
const japanTabConfig = {
  data: () => japanData,
  changedRows: japanChangedRows,
  controls: {
    refreshBtn: "japanRefreshData",
    updateBtn: "japanUpdateAll",
    clearBtn: "japanClearFilters",
    startDate: "japanStartDateFilter",
    endDate: "japanEndDateFilter",
    product: "japanProductFilter",
    staff: "japanStaffFilter",
    summary: "japanSummaryInfo",
  },
  table: { head: "japanTableHead", body: "japanTableBody" },
  dynamicOptions: () => japanDynamicFilterOptions,
};
const reportTabConfig = {
  controls: {
    clearBtn: "reportClearFilters",
    startDate: "reportStartDateFilter",
    endDate: "reportEndDateFilter",
    product: "reportProductFilter",
    market: "reportMarketFilter",
    staffBtn: "reportStaffFilterBtn",
    staffDropdown: "reportStaffDropdown",
  },
};
const allTabConfigs = [mainTabConfig, allRegionsTabConfig, japanTabConfig];

function loadData(page = 1, config = mainTabConfig) {
  console.log("loadData called with page:", page, "config:", config);
  document.getElementById("loader-overlay").style.display = "flex";
  currentPage = page;
  const params = new URLSearchParams({
    page,
    limit,
    startDate: document.getElementById(config.controls.startDate).value,
    endDate: document.getElementById(config.controls.endDate).value,
    product: document.getElementById(config.controls.product).value,
    market: config.controls.market
      ? document.getElementById(config.controls.market).value
      : "",
    staff: config.controls.staff
      ? document.getElementById(config.controls.staff).value
      : "",
  });
  // Xóa script cũ để tránh rò rỉ bộ nhớ
  const oldScript = document.querySelector(
    'script[src^="https://script.google.com"]'
  );
  if (oldScript) oldScript.remove();
  const script = document.createElement("script");
  script.src = `${POST_URL}?${params.toString()}&callback=handleData&rand=${Math.random()}`;
  document.body.appendChild(script);
}

function binarySearchDate(data, startDate, endDate) {
  let low = 0,
    high = data.length - 1,
    result = [];
  while (low <= high) {
    // Find start and end indices for range
    // (Implement binary search logic here for range)
  }
  return result;
}

async function handleData(response) {
  console.log("handleData called with response:", response);
  document.getElementById("loader-overlay").style.display = "none";
  allTabConfigs.forEach((config) => {
    document.getElementById(config.controls.refreshBtn).innerHTML =
      '<span class="refresh-icon">↻</span> Load';
  });
  (allData = []), (staffFilteredData = []), (japanData = []);
  changedRows.clear(), japanChangedRows.clear(), allRegionsChangedRows.clear();

  if (response.error || !Array.isArray(response.rows)) {
    const errorMsg =
      "Lỗi hoặc không có dữ liệu: " +
      (response.error || "Định dạng dữ liệu không đúng");
    allTabConfigs.forEach((config) => showError(errorMsg, config.table.body));
    return;
  }

  totalData = response.total || 0;
  totalPages = Math.ceil(totalData / limit); // Tính tổng số trang
  allData = response.rows.sort(
    (a, b) =>
      (parseDateString(b["Ngày lên đơn"] || b["Thời gian lên đơn"]) || 0) -
      (parseDateString(a["Ngày lên đơn"] || a["Thời gian lên đơn"]) || 0)
  );

  // Xây dựng index cho lọc nhanh
  dataIndex.product.clear();
  dataIndex.market.clear();
  dataIndex.staff.clear();
  for (let i = 0; i < allData.length; i++) {
    const row = allData[i];
    if (row["Mặt hàng"]) {
      if (!dataIndex.product.has(row["Mặt hàng"]))
        dataIndex.product.set(row["Mặt hàng"], []);
      dataIndex.product.get(row["Mặt hàng"]).push(row);
    }
    if (row["khu vực"]) {
      if (!dataIndex.market.has(row["khu vực"]))
        dataIndex.market.set(row["khu vực"], []);
      dataIndex.market.get(row["khu vực"]).push(row);
    }
    if (row["NV Vận đơn"]) {
      if (!dataIndex.staff.has(row["NV Vận đơn"]))
        dataIndex.staff.set(row["NV Vận đơn"], []);
      dataIndex.staff.get(row["NV Vận đơn"]).push(row);
    }
  }

  generateDatalistOptions();

  const staffId = getUrlParameter("id"),
    staffId1 = getUrlParameter("id1");
  if (!staffId && !staffId1) {
    showError("Thiếu tham số ID nhân viên trong URL", mainTabConfig.table.body);
  } else {
    try {
      currentStaff = await fetchStaffInfo(staffId, staffId1);
      let staffInfo = `Nhân viên: ${currentStaff.ho_va_ten}`;
      if (staffId1 && staffId1 !== staffId)
        staffInfo += ` và ${
          teamMembers.find((name) => name !== currentStaff.ho_va_ten) || ""
        }`;
      if (currentStaff.vi_tri === "Leader")
        staffInfo += ` (Leader - Team ${currentStaff.team})`;
      document.getElementById("userInfo").textContent = staffInfo;

      if (
        currentStaff.vi_tri_van_don === "Lên đơn FFM" &&
        !editableCols.includes("Đơn vị vận chuyển")
      ) {
        editableCols.push("Đơn vị vận chuyển");
      }

      document.getElementById("tabAllRegions").style.display =
        currentStaff?.vi_tri === "Leader" ? "" : "none";

      staffFilteredData = allData.filter((row) => {
        const isTeamMemberOrder = teamMembers.includes(
          row["NV Vận đơn"] || row["NV_Vận_đơn"] || ""
        );
        return currentStaff.vi_tri_van_don === "Lên đơn FFM"
          ? isTeamMemberOrder || (row["Kết quả Check"] || "") === "OK"
          : isTeamMemberOrder;
      });
      initializeTab(mainTabConfig, staffFilteredData);
    } catch (error) {
      showError(error.message, mainTabConfig.table.body);
    }
  }

  japanData = allData.filter(
    (row) => (row["khu vực"] || row["Khu vực"]) === "Nhật Bản"
  );
  initializeTab(allRegionsTabConfig, allData);
  initializeTab(japanTabConfig, japanData);
  // populateReportFilters();
  // applyReportFilters();
  updatePagination(mainTabConfig); // Cập nhật giao diện phân trang
}

function updatePagination(config) {
  console.log(
    "updatePagination called with currentPage:",
    currentPage,
    "totalPages:",
    totalPages
  );
  const paginationContainer = document.querySelector(".pagination-container");
  console.log("paginationContainer:", paginationContainer);
  paginationContainer.style.display = totalData > 0 ? "block" : "none";
  const firstPageBtn = document.getElementById("firstPage");
  const currentPageBtn = document.getElementById("currentPage");
  const lastPageBtn = document.getElementById("lastPage");
  const prevPageBtn = document.getElementById("prevPage");
  const nextPageBtn = document.getElementById("nextPage");

  firstPageBtn.textContent = "1";
  currentPageBtn.textContent = String(currentPage);
  lastPageBtn.textContent = String(totalPages);

  // Kích hoạt/vô hiệu hóa nút
  firstPageBtn.disabled = currentPage === 1;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
  lastPageBtn.disabled = currentPage === totalPages || totalPages === 0;

  // Gắn sự kiện cho các nút
  firstPageBtn.onclick = () => loadData(1, config);
  currentPageBtn.onclick = () => loadData(currentPage, config);
  lastPageBtn.onclick = () => loadData(totalPages, config);
  prevPageBtn.onclick = () => loadData(currentPage - 1, config);
  nextPageBtn.onclick = () => loadData(currentPage + 1, config);
}

function applyAllFilters(config) {
  let dataToFilter = [...config.data()];
  const tableHead = document.getElementById(config.table.head);
  if (!tableHead.querySelector("tr")) {
    renderTableBody(config, dataToFilter);
    updateSummaryInfo(dataToFilter, config.controls.summary);
    return;
  }

  const startDate = document.getElementById(config.controls.startDate).value;
  const endDate = document.getElementById(config.controls.endDate).value;
  if (startDate || endDate) {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    dataToFilter = dataToFilter.filter((row) => {
      const orderDate = parseDateString(
        row["Ngày lên đơn"] || row["Thời gian lên đơn"]
      );
      return (
        orderDate &&
        (!start || orderDate >= start) &&
        (!end || orderDate <= end)
      );
    });
  }

  const productValue = document.getElementById(config.controls.product).value;
  if (productValue)
    dataToFilter = dataToFilter.filter(
      (row) => (row["Mặt hàng"] || "") === productValue
    );

  if (config.controls.market) {
    const marketValue = document.getElementById(config.controls.market).value;
    if (marketValue)
      dataToFilter = dataToFilter.filter(
        (row) => (row["Khu vực"] || row["khu vực"] || "") === marketValue
      );
  }
  if (config.controls.staff) {
    const staffValue = document.getElementById(config.controls.staff).value;
    if (staffValue)
      dataToFilter = dataToFilter.filter(
        (row) => (row["NV Vận đơn"] || row["NV_Vận_đơn"] || "") === staffValue
      );
  }

  const filterValues = {};
  tableHead.querySelectorAll("[data-column]").forEach((filter) => {
    const colName = filter.dataset.column;
    if (!filterValues[colName]) filterValues[colName] = {};
    if (filter.dataset.filterType) {
      filterValues[colName][filter.dataset.filterType] =
        filter.value.toLowerCase();
    } else if (filter.classList.contains("multi-select-container")) {
      const selected = Array.from(filter.querySelectorAll("input:checked")).map(
        (cb) => cb.value
      );
      if (selected.length > 0) filterValues[colName].multi = new Set(selected);
    } else if (filter.tagName === "SELECT") {
      if (filter.value) filterValues[colName].single = filter.value;
    } else if (filter.classList.contains("filter-input")) {
      filterValues[colName].text = filter.value.toLowerCase();
    }
  });

  if (Object.keys(filterValues).length > 0) {
    dataToFilter = dataToFilter.filter((row) => {
      for (const colName in filterValues) {
        const dataKey = columnDisplayMapping[colName] || colName;
        let cellValue =
          row[dataKey] ??
          (row[dataKey.replace(/ /g, "_")] ||
            (dataKey === "khu vực" ? row["Khu vực"] || "" : ""));
        const cellValueLower = String(cellValue).toLowerCase();
        const colFilters = filterValues[colName];
        if (colFilters.text && !cellValueLower.includes(colFilters.text))
          return !1;
        if (colFilters.single && String(cellValue) !== colFilters.single)
          return !1;
        if (colFilters.multi && !colFilters.multi.has(String(cellValue)))
          return !1;
        if (
          colFilters.contains &&
          !cellValueLower.includes(colFilters.contains)
        )
          return !1;
        if (
          colFilters.notcontains &&
          colFilters.notcontains !== "" &&
          cellValueLower.includes(colFilters.notcontains)
        )
          return !1;
      }
      return !0;
    });
  }
  updateSummaryInfo(dataToFilter, config.controls.summary);
  renderTableBody(config, dataToFilter);
}

function renderTableBody(config, data) {
  const container = document.getElementById(config.table.body);
  container.innerHTML = "";
  if (data.length === 0) {
    showError(`Không có đơn hàng nào khớp với bộ lọc.`, config.table.body);
    return;
  }
  const originalDataSet = config.data();
  const fixedCount = getFixedColumnCount();
  const batchSize = 100; // Render 100 hàng mỗi lần
  let index = 0;

  function renderBatch() {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < batchSize && index < data.length; i++, index++) {
      const row = data[index];
      const originalRowIndex = originalDataSet.indexOf(row);
      const tr = document.createElement("tr");
      tr.dataset.rowIndex = originalRowIndex;
      for (let j = 0; j < displayColumns.length; j++) {
        const col = displayColumns[j];
        const td = document.createElement("td");
        if (j < fixedCount) td.classList.add("fixed-column");
        const dataKey = columnDisplayMapping[col] || col;
        let value;
        if (allDateColumns.includes(dataKey)) {
          let dateSource = row[dataKey] || "";
          if (dataKey === "Ngày lên đơn")
            dateSource = row["Ngày lên đơn"] || row["Thời gian lên đơn"];
          const formattedDate = formatDate(dateSource);
          value = formattedDate.display;
          td.dataset.originalValue = formattedDate.original;
        } else if (dataKey === "Ngày Kế toán đối soát với FFM lần 2") {
          value = getDateTimeVN(row[dataKey]);
        } else {
          value =
            row[dataKey] ??
            (row[dataKey.replace(/ /g, "_")] ||
              (dataKey === "khu vực" ? row["Khu vực"] || "" : ""));
        }
        if (editableCols.includes(col)) {
          td.classList.add("editable");
          if (dropdownCols[col]) {
            td.classList.add("has-dropdown");
            const select = document.createElement("select");
            for (let k = 0; k < dropdownCols[col].length; k++) {
              select.add(
                new Option(dropdownCols[col][k], dropdownCols[col][k])
              );
            }
            select.value = value;
            select.addEventListener("change", (e) => {
              td.classList.add("highlight");
              const newValue = select.value;
              const currentChanges =
                config.changedRows.get(originalRowIndex) || {};
              currentChanges[col] = newValue;
              config.changedRows.set(originalRowIndex, currentChanges);
              if (
                col === "Trạng thái giao hàng NB" ||
                col === "Trạng thái thu tiền"
              ) {
                const currentRow = e.target.closest("tr");
                if (!currentRow) return;
                const deliveryStatusCell =
                  currentRow.cells[
                    displayColumns.indexOf("Trạng thái giao hàng NB")
                  ];
                const paymentStatusCell =
                  currentRow.cells[
                    displayColumns.indexOf("Trạng thái thu tiền")
                  ];
                sendImmediateUpdate({
                  "Mã đơn hàng": row["Mã đơn hàng"] || row["Mã_đơn_hàng"],
                  "Trạng thái giao hàng NB": deliveryStatusCell
                    ? getDOMCellValue(deliveryStatusCell)
                    : "",
                  "Trạng thái thu tiền": paymentStatusCell
                    ? getDOMCellValue(paymentStatusCell)
                    : "",
                });
              }
            });
            td.appendChild(select);
          } else {
            td.textContent = value;
          }
        } else {
          td.textContent = value;
        }
        if (col === "Kết quả Check") {
          if (value === "OK") td.classList.add("cell-ok");
          else if (value === "Vận đơn XL") td.classList.add("cell-xl");
          else if (value === "Huỷ") td.classList.add("cell-cancel");
        }
        tr.appendChild(td);
      }
      fragment.appendChild(tr);
    }
    container.appendChild(fragment);
    if (index < data.length) {
      requestAnimationFrame(renderBatch);
    } else {
      updateStickyColumns(config);
    }
  }
  requestAnimationFrame(renderBatch);
}

function setupControls() {
  console.log("setupControls called");
  // Giữ nguyên các thiết lập khác
  setupTabs();
  for (let i = 0; i < allTabConfigs.length; i++) {
    setupTabControls(allTabConfigs[i]);
  }
  document
    .getElementById("fixedColumnCountInput")
    .addEventListener("input", handleFixedColumnCountChange);
  document.addEventListener("keydown", (e) => {
    const activeEl = document.activeElement;
    if (
      activeEl &&
      ["INPUT", "SELECT", "TEXTAREA"].includes(activeEl.tagName) &&
      !activeEl.closest("td")
    )
      return;
    if (document.querySelector("td.editing")) return;
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "c" &&
      selectedCells.size > 0
    ) {
      e.preventDefault();
      copySelectedCells();
    } else if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "v" &&
      selectedCells.size > 0
    ) {
      e.preventDefault();
      navigator.clipboard
        .readText()
        .then((text) => pasteToSelectedCells(text))
        .catch((err) => console.error("Lỗi đọc clipboard:", err));
    } else if (
      (e.key === "Delete" || e.key === "Backspace") &&
      selectedCells.size > 0
    ) {
      e.preventDefault();
      clearSelectedCells();
    }
  });
  window.addEventListener("resize", () => {
    const activeTab = document.querySelector(".content-tab.active");
    if (!activeTab) return;
    const activeConfig = allTabConfigs.find(
      (c) => c.table.body === activeTab.querySelector("tbody")?.id
    );
    if (activeConfig) updateStickyColumns(activeConfig);
  });

  // Thêm sự kiện cho các nút phân trang
  updatePagination(mainTabConfig);
}

function setupCellSelection(tableBodyId) {
  const tableBody = document.getElementById(tableBodyId);
  if (!tableBody) return;
  let lastClickTime = 0,
    lastClickCell = null;
  tableBody.addEventListener("mousedown", (e) => {
    const td = e.target.closest("td");
    if (!td) return;
    if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      isMouseDown = !0;
      startCell = td;
      selectedCells.forEach((cell) => cell.classList.remove("cell-selected"));
      selectedCells.clear();
      td.classList.add("cell-selected");
      selectedCells.add(td);
      e.preventDefault();
    }
  });
  tableBody.addEventListener("click", (e) => {
    const td = e.target.closest("td");
    if (!td) return;
    if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;
    const currentTime = new Date().getTime(),
      isDoubleClick = currentTime - lastClickTime < 300 && lastClickCell === td;
    if (isDoubleClick) handleEditCell(td, tableBodyId);
    else {
      if (e.shiftKey && startCell) selectCellsBetween(startCell, td);
      else if (e.ctrlKey || e.metaKey) {
        td.classList.toggle("cell-selected");
        if (td.classList.contains("cell-selected")) selectedCells.add(td);
        else selectedCells.delete(td);
      } else {
        selectedCells.forEach((cell) => cell.classList.remove("cell-selected"));
        selectedCells.clear();
        td.classList.add("cell-selected");
        selectedCells.add(td);
      }
      startCell = td;
    }
    lastClickTime = currentTime;
    lastClickCell = td;
    updateSelectionSummary();
  });
  tableBody.addEventListener("mouseover", (e) => {
    if (isMouseDown) {
      const td = e.target.closest("td");
      if (td) selectCellsBetween(startCell, td);
    }
  });
  document.addEventListener("mouseup", () => {
    if (isMouseDown) {
      isMouseDown = !1;
      updateSelectionSummary();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded fired");
  setupControls();
  loadData();
});
