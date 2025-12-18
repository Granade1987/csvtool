let currentFile = null;
let allSheets = {}; 
let currentSheet = null; 
let sortState = {};
let markedRowsPerSheet = {};
let mappingFile1Data = null;
let mappingFile2Data = null;

// --- BESTANDEN LADEN ---
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
        toggleUI(true, false);
    };
    reader.readAsText(file, "UTF-8");
}

function loadExcel(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        allSheets = {};
        workbook.SheetNames.forEach(n => {
            const worksheet = workbook.Sheets[n];
            allSheets[n] = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' }).replace(/\r\n/g, "\n").trimEnd();
        });
        currentSheet = workbook.SheetNames[0];
        renderTabs();
        renderTable(allSheets[currentSheet]);
        toggleUI(true, true);
    };
    reader.readAsArrayBuffer(file);
}

function toggleUI(hasData, isExcel) {
    document.getElementById('exportControls').style.display = hasData ? 'block' : 'none';
    document.getElementById('tableCard').style.display = hasData ? 'block' : 'none';
    document.getElementById('infoMessageCard').style.display = hasData ? 'none' : 'block';
    document.getElementById('tabsContainer').style.display = isExcel ? 'flex' : 'none';
}

function renderTabs() {
    const container = document.getElementById('tabsContainer');
    container.innerHTML = '';
    Object.keys(allSheets).forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'tab-button' + (name === currentSheet ? ' active' : '');
        btn.textContent = name;
        btn.onclick = () => {
            saveMarkedRows();
            currentSheet = name;
            renderTabs();
            renderTable(allSheets[name]);
        };
        container.appendChild(btn);
    });
}

// --- TABEL RENDERING & FUNCTIES ---
function renderTable(csvData) {
    const del = document.getElementById("delimiter").value === "\\t" ? "\t" : document.getElementById("delimiter").value;
    const rows = csvData.split("\n").map(r => r.split(del));
    const thead = document.querySelector("#csvTable thead");
    const tbody = document.querySelector("#csvTable tbody");
    thead.innerHTML = ""; tbody.innerHTML = "";

    if (rows.length > 0) {
        const hr = document.createElement("tr");
        hr.innerHTML = "<th>Actie</th>";
        rows[0].forEach((h, i) => {
            const th = document.createElement("th");
            th.innerHTML = `<input type="checkbox" checked data-index="${i}"> <span class="sort-lbl" style="cursor:pointer">${h || ""}</span><span class="sort-arrow"></span>`;
            th.querySelector('.sort-lbl').onclick = () => sortTable(i, th.querySelector('.sort-arrow'));
            hr.appendChild(th);
        });
        thead.appendChild(hr);

        rows.slice(1).forEach(row => {
            if (row.length <= 1 && row[0].trim() === "") return;
            const tr = document.createElement("tr");
            tr.innerHTML = '<td><button class="del-row">X</button></td>' + row.map(c => `<td>${c}</td>`).join('');
            tr.querySelector('.del-row').onclick = (e) => { e.stopPropagation(); tr.remove(); };
            tr.onclick = (e) => { if(e.target.tagName !== 'BUTTON') tr.classList.toggle("highlighted"); };
            tbody.appendChild(tr);
        });
    }
    restoreMarkedRows();
}

function sortTable(colIdx, arrowEl) {
    saveMarkedRows();
    const tbody = document.querySelector("#csvTable tbody");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const dir = sortState[colIdx] === "asc" ? "desc" : "asc";
    sortState = { [colIdx]: dir };

    rows.sort((a, b) => {
        const tA = a.cells[colIdx + 1].innerText.trim();
        const tB = b.cells[colIdx + 1].innerText.trim();
        return dir === "asc" ? tA.localeCompare(tB, undefined, {numeric: true}) : tB.localeCompare(tA, undefined, {numeric: true});
    });

    rows.forEach(r => tbody.appendChild(r));
    document.querySelectorAll(".sort-arrow").forEach(el => el.textContent = "");
    arrowEl.textContent = dir === "asc" ? " ▲" : " ▼";
    restoreMarkedRows();
}

// --- EXPORT FUNCTIES (NU GEFIXED) ---
function getExportData(onlyMarked = false) {
    const del = document.getElementById("delimiter").value === "\\t" ? "\t" : document.getElementById("delimiter").value;
    const headers = [];
    const colIndices = [];

    // Check welke kolommen zijn aangevinkt
    document.querySelectorAll('#csvTable thead input[type="checkbox"]').forEach(cb => {
        if (cb.checked) {
            colIndices.push(parseInt(cb.getAttribute('data-index')));
            headers.push(cb.parentElement.textContent.trim());
        }
    });

    const rows = [];
    rows.push(headers.join(del));

    const tableRows = onlyMarked 
        ? document.querySelectorAll("#csvTable tbody tr.highlighted") 
        : document.querySelectorAll("#csvTable tbody tr");

    tableRows.forEach(tr => {
        const cells = Array.from(tr.cells).slice(1); // skip de 'X' kolom
        const rowData = colIndices.map(idx => cells[idx] ? cells[idx].textContent : "");
        rows.push(rowData.join(del));
    });

    return rows.join("\n");
}

function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", fileName);
    link.click();
}

// --- INITIALISATIE & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Navigatie
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

    // Exporter Acties
    document.getElementById('csvFileInput').onchange = (e) => loadFile(e.target.files[0]);
    document.getElementById('reloadButton').onclick = () => currentFile && loadFile(currentFile);
    document.getElementById('delimiter').onchange = () => currentSheet && renderTable(allSheets[currentSheet]);

    // De FIX voor de export knoppen:
    document.getElementById('exportButton').onclick = () => {
        const data = getExportData(false);
        downloadCSV(data, "export_alle_rijen.csv");
    };

    document.getElementById('exportMarkedButton').onclick = () => {
        const data = getExportData(true);
        if (data.split("\n").length <= 1) {
            alert("Selecteer eerst rijen (klik op een rij om deze blauw te maken)");
            return;
        }
        downloadCSV(data, "export_gemarkeerde_rijen.csv");
    };

    // Mapping setup (Houdt de rest van de mapping logica hieronder aan...)
    setupMapping('mappingFileInput1', 'mappingDelimiter1', 'headerRowSelector1', 'mappingPreview1', 1);
    setupMapping('mappingFileInput2', 'mappingDelimiter2', 'headerRowSelector2', 'mappingPreview2', 2);
    // ... (rest van de mapping popup code zoals in vorige bericht)
});

// Hulpfuncties voor gemarkeerde rijen
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