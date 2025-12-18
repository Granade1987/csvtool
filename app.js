let currentFile = null;
let allSheets = {}; 
let currentSheet = null; 
let sortState = {};
let markedRowsPerSheet = {};
let mappingFile1Data = null;
let mappingFile2Data = null;

// --- EXPORTER: LADEN & WEERGEVEN ---
function loadFile(file) {
    currentFile = file;
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.csv')) loadCSV(file);
    else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) loadExcel(file);
}

function loadCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result.replace(/\r\n/g, "\n").trimEnd();
        allSheets = { 'CSV Data': text };
        currentSheet = 'CSV Data';
        renderTable(text);
        showControls(true);
    };
    reader.readAsText(file, "UTF-8");
}

function loadExcel(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        allSheets = {};
        workbook.SheetNames.forEach(n => {
            allSheets[n] = XLSX.utils.sheet_to_csv(workbook.Sheets[n], { FS: ';' }).replace(/\r\n/g, "\n").trimEnd();
        });
        currentSheet = workbook.SheetNames[0];
        renderTabs();
        renderTable(allSheets[currentSheet]);
        showControls(true);
    };
    reader.readAsArrayBuffer(file);
}

function showControls(hasData) {
    document.getElementById('exportControls').style.display = hasData ? 'block' : 'none';
    document.getElementById('tableCard').style.display = hasData ? 'block' : 'none';
    document.getElementById('infoMessage').style.display = hasData ? 'none' : 'block';
}

function renderTable(csvData) {
    const delValue = document.getElementById("delimiter").value;
    const delimiter = delValue === "\\t" ? "\t" : delValue;
    const rows = csvData.split("\n").map(row => row.split(delimiter));
    const thead = document.querySelector("#csvTable thead");
    const tbody = document.querySelector("#csvTable tbody");
    thead.innerHTML = ""; tbody.innerHTML = "";

    if (rows.length > 0) {
        const hr = document.createElement("tr");
        hr.innerHTML = "<th>Actie</th>";
        rows[0].forEach((h, i) => {
            const th = document.createElement("th");
            th.innerHTML = `<input type="checkbox" checked data-index="${i}"> <span class="sort-label">${h || ""}</span><span class="sort-arrow"></span>`;
            th.querySelector('.sort-label').onclick = () => sortTable(i, th.querySelector('.sort-arrow'));
            hr.appendChild(th);
        });
        thead.appendChild(hr);

        rows.slice(1).forEach(row => {
            if (row.length <= 1 && row[0].trim() === "") return;
            const tr = document.createElement("tr");
            tr.innerHTML = '<td><button class="del-btn">X</button></td>' + row.map(c => `<td>${c}</td>`).join('');
            tr.querySelector('.del-btn').onclick = (e) => { e.stopPropagation(); tr.remove(); };
            tr.onclick = (e) => { if(e.target.tagName !== 'BUTTON') tr.classList.toggle("highlighted"); };
            tbody.appendChild(tr);
        });
    }
    restoreMarkedRows();
}

// --- SORTEREN & MARKEREN ---
function sortTable(colIndex, arrowEl) {
    saveMarkedRows();
    const tbody = document.querySelector("#csvTable tbody");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const dir = sortState[colIndex] === "asc" ? "desc" : "asc";
    sortState = { [colIndex]: dir };

    rows.sort((a, b) => {
        const tA = a.cells[colIndex + 1].innerText.trim();
        const tB = b.cells[colIndex + 1].innerText.trim();
        return dir === "asc" ? tA.localeCompare(tB, undefined, {numeric: true}) : tB.localeCompare(tA, undefined, {numeric: true});
    });

    rows.forEach(r => tbody.appendChild(r));
    document.querySelectorAll(".sort-arrow").forEach(el => el.textContent = "");
    arrowEl.textContent = dir === "asc" ? " ▲" : " ▼";
    restoreMarkedRows();
}

function saveMarkedRows() {
    if (!currentSheet) return;
    markedRowsPerSheet[currentSheet] = Array.from(document.querySelectorAll("#csvTable tbody tr.highlighted"))
        .map(tr => Array.from(tr.cells).slice(1).map(c => c.textContent).join('|||'));
}

function restoreMarkedRows() {
    const marked = markedRowsPerSheet[currentSheet] || [];
    document.querySelectorAll("#csvTable tbody tr").forEach(tr => {
        const key = Array.from(tr.cells).slice(1).map(c => c.textContent).join('|||');
        if (marked.includes(key)) tr.classList.add('highlighted');
    });
}

// --- INITIALISATIE ---
document.addEventListener('DOMContentLoaded', () => {
    // Hoofd tabs
    document.querySelectorAll('.main-tab').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.main-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.id.replace('tab', '').toLowerCase() + 'TabContent';
            ['exporterTabContent', 'mappingTabContent', 'converterTabContent'].forEach(id => {
                document.getElementById(id).style.display = (id === target) ? 'block' : 'none';
            });
        };
    });

    // Exporter events
    document.getElementById('csvFileInput').onchange = (e) => loadFile(e.target.files[0]);
    document.getElementById('reloadButton').onclick = () => currentFile && loadFile(currentFile);
    document.getElementById('delimiter').onchange = () => currentSheet && renderTable(allSheets[currentSheet]);

    // PDF events
    const pdfInput = document.getElementById('pdfFileInput');
    if(pdfInput) {
        pdfInput.onchange = (e) => {
            if (window.showPdfVisualPreview) window.showPdfVisualPreview(e.target.files[0], document.getElementById('pdfVisualPreview'), document.getElementById('pdfVisualPreviewContainer'), document.getElementById('pdfPageInfo'));
        };
        document.getElementById('convertPdfBtn').onclick = () => {
            document.getElementById('pdfDataPreviewContainer').style.display = 'block';
            if (window.handlePdfToExcel) window.handlePdfToExcel(pdfInput.files[0], document.getElementById('pdfDataPreview'), document.getElementById('downloadExcelBtn'));
        };
    }
});