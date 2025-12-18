/**
 * MIKE'S TOOL - FULL ENGINE
 * Bevat: Exporter, 2-Kolom Mapping, PDF Converter Bridge
 */

let currentFile = null;
let allSheets = {}; 
let currentSheet = null; 
let sortState = {};
let markedRowsPerSheet = {};
let mappingFile1Data = null;
let mappingFile2Data = null;

// --- 1. EXPORTER MODULE ---

function loadFile(file) {
    currentFile = file;
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.csv')) {
        loadCSV(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        loadExcel(file);
    }
}

function loadCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target.result.replace(/\r\n/g, "\n").trimEnd();
        allSheets = { 'CSV Data': text };
        currentSheet = 'CSV Data';
        renderTable(text);
        showExporterUI(true, false);
    };
    reader.readAsText(file, "UTF-8");
}

function loadExcel(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        allSheets = {};
        workbook.SheetNames.forEach(name => {
            const worksheet = workbook.Sheets[name];
            allSheets[name] = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' }).replace(/\r\n/g, "\n").trimEnd();
        });
        currentSheet = workbook.SheetNames[0];
        renderTabs();
        renderTable(allSheets[currentSheet]);
        showExporterUI(true, true);
    };
    reader.readAsArrayBuffer(file);
}

function showExporterUI(hasData, isExcel) {
    document.getElementById('exportControls').style.display = hasData ? 'block' : 'none';
    document.getElementById('tableCard').style.display = hasData ? 'block' : 'none';
    document.getElementById('infoMessage').style.display = hasData ? 'none' : 'block';
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

function renderTable(csvData) {
    const delValue = document.getElementById("delimiter").value;
    const delimiter = delValue === "\\t" ? "\t" : delValue;
    const rows = csvData.split("\n").map(row => row.split(delimiter));
    
    const thead = document.querySelector("#csvTable thead");
    const tbody = document.querySelector("#csvTable tbody");
    thead.innerHTML = ""; tbody.innerHTML = "";

    if (rows.length > 0) {
        // Headers
        const headerTr = document.createElement("tr");
        headerTr.innerHTML = "<th>Actie</th>";
        rows[0].forEach((header, i) => {
            const th = document.createElement("th");
            th.innerHTML = `
                <input type="checkbox" checked data-index="${i}">
                <span class="sort-label" onclick="sortTable(${i})">${header || ""}</span>
                <span class="sort-arrow" id="sort-arrow-${i}"></span>
            `;
            headerTr.appendChild(th);
        });
        thead.appendChild(headerTr);

        // Body
        rows.slice(1).forEach((row, rowIndex) => {
            if (row.length <= 1 && row[0].trim() === "") return;
            const tr = document.createElement("tr");
            tr.innerHTML = `<td><button class="del-row-btn" onclick="this.closest('tr').remove()">X</button></td>` + 
                           row.map(cell => `<td>${cell}</td>`).join('');
            
            tr.onclick = (e) => {
                if (e.target.tagName !== 'BUTTON') tr.classList.toggle("highlighted");
            };
            tbody.appendChild(tr);
        });
    }
    restoreMarkedRows();
}

// --- 2. EXPORT & SORTEER LOGICA ---

function sortTable(colIndex) {
    saveMarkedRows();
    const tbody = document.querySelector("#csvTable tbody");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const direction = sortState[colIndex] === "asc" ? "desc" : "asc";
    sortState = { [colIndex]: direction };

    rows.sort((a, b) => {
        const valA = a.cells[colIndex + 1].innerText.trim();
        const valB = b.cells[colIndex + 1].innerText.trim();
        return direction === "asc" 
            ? valA.localeCompare(valB, undefined, {numeric: true}) 
            : valB.localeCompare(valA, undefined, {numeric: true});
    });

    rows.forEach(tr => tbody.appendChild(tr));
    document.querySelectorAll(".sort-arrow").forEach(span => span.textContent = "");
    document.getElementById(`sort-arrow-${colIndex}`).textContent = direction === "asc" ? " ▲" : " ▼";
    restoreMarkedRows();
}

function getExportContent(onlyMarked) {
    const delValue = document.getElementById("delimiter").value;
    const delimiter = delValue === "\\t" ? "\t" : delValue;
    
    const selectedIndices = Array.from(document.querySelectorAll('#csvTable thead input[type="checkbox"]'))
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.dataset.index));

    const headers = selectedIndices.map(i => document.querySelectorAll('#csvTable thead th')[i+1].querySelector('.sort-label').textContent);
    let output = [headers.join(delimiter)];

    const rows = onlyMarked 
        ? document.querySelectorAll("#csvTable tbody tr.highlighted") 
        : document.querySelectorAll("#csvTable tbody tr");

    rows.forEach(tr => {
        const rowData = selectedIndices.map(i => tr.cells[i+1].innerText);
        output.push(rowData.join(delimiter));
    });

    return output.join("\n");
}

// --- 3. MAPPING MODULE (2-KOLOM) ---

function setupMappingInput(inputId, delId, headId, prevId, fileRef) {
    const input = document.getElementById(inputId);
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const sep = document.getElementById(delId).value;
            let csv;
            if (file.name.match(/\.(xlsx|xls)$/i)) {
                const wb = XLSX.read(new Uint8Array(ev.target.result), {type:'array'});
                csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], {FS: sep});
            } else {
                csv = ev.target.result.replace(/\r\n/g, "\n");
            }
            const data = csv.split("\n").map(r => r.split(sep));
            if (fileRef === 1) mappingFile1Data = data; else mappingFile2Data = data;
            
            // Update preview & selectors
            const headSel = document.getElementById(headId);
            headSel.innerHTML = data.slice(0,10).map((r,i) => `<option value="${i}">Rij ${i+1}: ${r.slice(0,2).join('|')}</option>`).join('');
            document.getElementById(prevId).innerHTML = '<table style="width:100%">' + 
                data.slice(0,5).map(r => '<tr>' + r.slice(0,5).map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</table>';
            
            document.getElementById('mapFilesButton').disabled = !(mappingFile1Data && mappingFile2Data);
        };
        if (file.name.match(/\.(xlsx|xls)$/i)) reader.readAsArrayBuffer(file); else reader.readAsText(file, "UTF-8");
    });
}

function runMappingExport() {
    const h1Idx = document.getElementById('headerRowSelector1').value;
    const h2Idx = document.getElementById('headerRowSelector2').value;
    const f1 = mappingFile1Data.slice(h1Idx);
    const f2 = mappingFile2Data.slice(h2Idx);

    const k1a = document.getElementById('joinKey1').value;
    const k1b = document.getElementById('joinKey1_alt').value;
    const k2a = document.getElementById('joinKey2').value;
    const k2b = document.getElementById('joinKey2_alt').value;
    const extraCols = Array.from(document.getElementById('columnsToAdd2').selectedOptions).map(o => parseInt(o.value));

    // Bouw Index (Lookup)
    const lookup = {};
    f2.slice(1).forEach(row => {
        const key = (row[k2a]||"").trim().toLowerCase() + (k2b ? "|||" + (row[k2b]||"").trim().toLowerCase() : "");
        lookup[key] = row;
    });

    const result = [[...f1[0], ...extraCols.map(i => f2[0][i])]];
    f1.slice(1).forEach(row => {
        const key = (row[k1a]||"").trim().toLowerCase() + (k1b ? "|||" + (row[k1b]||"").trim().toLowerCase() : "");
        const match = lookup[key];
        if (!match && document.getElementById('onlyMatchedRows').checked) return;
        result.push([...row, ...extraCols.map(i => match ? match[i] : "")]);
    });

    const csvContent = result.map(r => r.join(';')).join('\n');
    const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "mapped_resultaat.csv";
    link.click();
}

// --- 4. INITIALISATIE & EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    // Tab navigatie
    document.querySelectorAll('.main-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.id.replace('tab', '').toLowerCase() + 'TabContent';
            ['exporterTabContent', 'mappingTabContent', 'converterTabContent'].forEach(id => {
                document.getElementById(id).style.display = (id === target) ? 'block' : 'none';
            });
        };
    });

    // Exporter Events
    document.getElementById('csvFileInput').onchange = (e) => loadFile(e.target.files[0]);
    document.getElementById('exportButton').onclick = () => {
        const content = getExportContent(false);
        downloadFile(content, "volledige_export.csv");
    };
    document.getElementById('exportMarkedButton').onclick = () => {
        const content = getExportContent(true);
        downloadFile(content, "selectie_export.csv");
    };
    document.getElementById('reloadButton').onclick = () => currentFile && loadFile(currentFile);
    document.getElementById('delimiter').onchange = () => currentSheet && renderTable(allSheets[currentSheet]);

    // Mapping Events
    setupMappingInput('mappingFileInput1', 'mappingDelimiter1', 'headerRowSelector1', 'mappingPreview1', 1);
    setupMappingInput('mappingFileInput2', 'mappingDelimiter2', 'headerRowSelector2', 'mappingPreview2', 2);
    
    document.getElementById('mapFilesButton').onclick = () => {
        const h1 = mappingFile1Data[document.getElementById('headerRowSelector1').value];
        const h2 = mappingFile2Data[document.getElementById('headerRowSelector2').value];
        const fill = (id, headers, opt) => {
            document.getElementById(id).innerHTML = (opt ? '<option value="">-- Geen --</option>' : '') + 
                headers.map((h, i) => `<option value="${i}">${h || 'Kolom '+i}</option>`).join('');
        };
        fill('joinKey1', h1, false); fill('joinKey1_alt', h1, true);
        fill('joinKey2', h2, false); fill('joinKey2_alt', h2, true);
        fill('columnsToAdd2', h2, false);
        document.getElementById('mappingPopup').style.display = 'flex';
    };

    document.getElementById('exportMappingButton').onclick = runMappingExport;
    document.getElementById('closeMappingButton').onclick = () => document.getElementById('mappingPopup').style.display = 'none';

    // PDF Events bridge
    const pdfIn = document.getElementById('pdfFileInput');
    if(pdfIn) {
        pdfIn.onchange = (e) => {
            if (window.showPdfVisualPreview) window.showPdfVisualPreview(e.target.files[0], document.getElementById('pdfVisualPreview'), document.getElementById('pdfVisualPreviewContainer'), document.getElementById('pdfPageInfo'));
        };
        document.getElementById('convertPdfBtn').onclick = () => {
            document.getElementById('pdfDataPreviewContainer').style.display = 'block';
            if (window.handlePdfToExcel) window.handlePdfToExcel(pdfIn.files[0], document.getElementById('pdfDataPreview'), document.getElementById('downloadExcelBtn'));
        };
    }
});

// Helper functies
function downloadFile(content, fileName) {
    const blob = new Blob([content], {type: 'text/csv;charset=utf-8;'});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
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