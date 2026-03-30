const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const status = document.getElementById("status");
const downloadBtn = document.getElementById("downloadBtn");
const tbody = document.getElementById("tbody");
const filterInput = document.getElementById("filterText");
const countEl = document.getElementById("count");

let rows = [];
let filtered = [];
let sortKey = "calendar";
let sortAsc = true;

// UI

dropzone.onclick = () => fileInput.click();

dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("dragover"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));

dropzone.addEventListener("drop", e => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));
filterInput.addEventListener("input", applyFilter);

document.querySelectorAll("th").forEach(th => {
  th.onclick = () => {
    const key = th.dataset.key;
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = true; }
    applyFilter();
  };
});

async function handleFile(file) {
  rows = [];
  status.textContent = "Processing...";

  if (file.name.endsWith(".ics")) {
    await parseICS(await file.text());
  } else if (file.name.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file);
    for (const f of Object.values(zip.files)) {
      if (f.name.endsWith(".ics")) {
        await parseICS(await f.async("string"));
      }
    }
  }

  applyFilter();
  downloadBtn.disabled = rows.length === 0;
  status.textContent = rows.length + " events parsed";
}

async function parseICS(data) {
  const jcal = ICAL.parse(data);
  const comp = new ICAL.Component(jcal);
  const calName = comp.getFirstPropertyValue("x-wr-calname") || "";

  comp.getAllSubcomponents("vevent").forEach(evt => {
    const event = new ICAL.Event(evt);

    rows.push({
      calendar: calName,
      summary: event.summary || "",
      start: event.startDate ? event.startDate.toJSDate() : null,
      end: event.endDate ? event.endDate.toJSDate() : null,
      location: event.location || "",
      recurrence: event.isRecurring() ? event.component.getFirstPropertyValue("rrule")?.toString() || "RRULE" : "",
      description: event.description || ""
    });
  });
}

function applyFilter() {
  const q = filterInput.value.toLowerCase();

  filtered = rows.filter(r =>
    Object.values(r).some(v => String(v).toLowerCase().includes(q))
  );

  render();
}

function to_date(js_date) {
  return js_date.toISOString().slice(0, 10);
}

function to_time(js_date) {
  return js_date.toISOString().slice(11, 19);
}

function render() {
  tbody.innerHTML = "";

  filtered.forEach(r => {
    const tr = document.createElement("tr");

    function addCell(value) {
      const td = document.createElement("td");
      td.textContent = value ?? "";
      return td;
    }

    tr.appendChild(addCell(r.calendar));
    tr.appendChild(addCell(r.summary));
    tr.appendChild(addCell(r.start ? to_date(r.start) : ""));
    tr.appendChild(addCell(r.start ? to_time(r.start) : ""));
    tr.appendChild(addCell(r.end ? to_date(r.end) : ""));
    tr.appendChild(addCell(r.end ? to_time(r.end) : ""));
    tr.appendChild(addCell(r.location));
    tr.appendChild(addCell(r.recurrence));
    tr.appendChild(addCell(r.description));

    tbody.appendChild(tr);
  });

  countEl.textContent = `${filtered.length} / ${rows.length}`;
}

downloadBtn.onclick = () => {
  const csv = Papa.unparse(filtered.map(r => ({
    "Calendar": r.calendar,
    "Summary": r.summary,
    "Start date": r.start ? to_date(r.start) : "",
    "Start time": r.start ? to_time(r.start) : "",
    "End date": r.end ? to_date(r.end) : "",
    "End time": r.end ? to_time(r.end) : "",
    "Location": r.location,
    "Recurrence": r.recurrence,
    "Description": r.description
  })));

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "calendar.csv";
  a.click();

  URL.revokeObjectURL(url);
};
