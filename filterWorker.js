self.onmessage = function (e) {
  const { data, filters } = e.data;
  let filtered = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    let match = true;
    if (
      filters.startDate &&
      parseDateString(row["Ngày lên đơn"]) < filters.startDate
    )
      match = false;
    if (
      filters.endDate &&
      parseDateString(row["Ngày lên đơn"]) > filters.endDate
    )
      match = false;
    if (filters.product && row["Mặt hàng"] !== filters.product) match = false;
    if (filters.market && row["khu vực"] !== filters.market) match = false;
    if (filters.staff && row["NV Vận đơn"] !== filters.staff) match = false;
    if (match) filtered.push(row);
  }
  self.postMessage(filtered);
};

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
    if (year > 1000 && month > 0 && month <= 12 && day > 0 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }
  return null;
}
