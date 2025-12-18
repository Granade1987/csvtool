// Globale variabelen
let currentFile = null;
let allSheets = {}; 
let currentSheet = null; 
let sortState = {}; 
let markedRowsPerSheet = {}; 
let mappingFile1Data = null;
let mappingFile2Data = null;

// --- EXPORTER LOGICA ---

function loadFile(file) {
    currentFile = file;
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.csv')) {
        loadCSV(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        loadExcel(file);
    } else {
        alert('Ongeldig bestandstype.');
    }
}

function loadCSV(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result.replace(/\r\n/g, "\n").trimEnd();
        allSheets = { 'CSV Data': text };
        currentSheet = 'CSV Data';
        renderTable(text);
        document.getElementById('exportControls').classList.add('active');
        document.getElementById('infoMessage').style.display = 'none';
        restoreMarkedRows();
    };
    reader.readAsText(file, "UTF-8");
}

function loadExcel(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        allSheets = {};
        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
            allSheets[sheetName] = csv.replace(/\r\n/g, "\n").trimEnd();
        });
        currentSheet = workbook.SheetNames[0];
        renderTabs();
        renderTable(allSheets[currentSheet]);
        document.getElementById('exportControls').classList.add('active');
        document.getElementById('infoMessage').style.display = 'none';
        restoreMarkedRows();
    };
    reader.readAsArrayBuffer(file);
}

function renderTabs() {
    const tabsContainer = document.getElementById('tabsContainer');
    tabsContainer.innerHTML = '';
    tabsContainer.classList.add('active');
    Object.keys(allSheets).forEach(sheetName => {
        const tab = document.createElement('button');
        tab.className = 'tab-button' + (sheetName === currentSheet ? ' active' : '');
        tab.textContent = sheetName;
        tab.onclick = () => {
            saveMarkedRows();
            currentSheet = sheetName;
            renderTabs();
            renderTable(allSheets[sheetName]);
            restoreMarkedRows();
        };
        tabsContainer.appendChild(tab);
    });
}

function renderTable(csvData) {
    let del = document.getElementById("delimiter").value;
    const delimiter = del === "\\t" ? "\t" : del;
    const rows = csvData.split("\n").map(row => row.split(delimiter));
    const tableHead = document.querySelector("#csvTable thead");
    const tableBody = document.querySelector("#csvTable tbody");
    tableHead.innerHTML = ""; tableBody.innerHTML = "";

    if (rows.length > 0) {
        const headerRow = document.createElement("tr");
        headerRow.innerHTML = "<th>Acties</th>";
        rows[0].forEach((header, index) => {
            const th = document.createElement("th");
            th.innerHTML = `<input type="checkbox" checked data-index="${index}"> <span style="cursor:pointer">${header || ""}</span><span class="sort-arrow"></span>`;
            th.querySelector("span").onclick = () => sortTable(index, th.querySelector(".sort-arrow"));
            headerRow.appendChild(th);
        });
        tableHead.appendChild(headerRow);

        for (let i = 1; i < rows.length; i++) {
            if (rows[i].length === 1 && rows[i][0].trim() === "") continue;
            const tr = document.createElement("tr");
            const actionTd = document.createElement("td");
            actionTd.innerHTML = '<button onclick="this.closest(\'tr\').remove(); saveMarkedRows();">X</button>';
            tr.appendChild(actionTd);
            tr.onclick = (e) => { if(e.target.tagName !== 'BUTTON') tr.classList.toggle("highlighted"); };
            rows[i].forEach(cell => {
                const td = document.createElement("td");
                td.textContent = cell ?? "";
                tr.appendChild(td);
            });
            tableBody.appendChild(tr);
        }
    }
    document.getElementById("tableContainer").classList.add('active');
}

// --- MAPPING LOGICA ---

function generateCompositeKey(row, idx1, idx2) {
    const val1 = (row[idx1] || '').toString().trim().toLowerCase();
    const val2 = (idx2 !== "" && idx2 !== undefined) ? (row[idx2] || '').toString().trim().toLowerCase() : "";
    return val1 + "___" + val2;
}

function showMappingPopup(file1Data, file2Data) {
    const h1 = parseInt(document.getElementById('headerRowSelector1').value || 0);
    const h2 = parseInt(document.getElementById('headerRowSelector2').value || 0);
    
    window.mappingFile1DataProcessed = file1Data.slice(h1);
    window.mappingFile2DataProcessed = file2Data.slice(h2);

    const f1Headers = window.mappingFile1DataProcessed[0];
    const f2Headers = window.mappingFile2DataProcessed[0];

    const fillDropdown = (id, headers, includeEmpty) => {
        const el = document.getElementById(id);
        let html = includeEmpty ? '<option value="">-- Geen --</option>' : '';
        html += headers.map((h, i) => `<option value="${i}">${h || 'Kolom '+i}</option>`).join('');
        el.innerHTML = html;
    };

    fillDropdown('joinKey1', f1Headers, false);
    fillDropdown('joinKey1_alt', f1Headers, true);
    fillDropdown('joinKey2', f1Headers, false); // Bestand 1 headers als referentie is fout, moet f2 zijn
    fillDropdown('joinKey2', f2Headers, false);
    fillDropdown('joinKey2_alt', f2Headers, true);
    fillDropdown('columnsToAdd2', f2Headers, false);

    document.getElementById('mappingPopup').style.display = 'block';
}

function exportMappedData() {
    const f1 = window.mappingFile1DataProcessed;
    const f2 = window.mappingFile2DataProcessed;
    
    const k1a = document.getElementById('joinKey1').value;
    const k1b = document.getElementById('joinKey1_alt').value;
    const k2a = document.getElementById('joinKey2').value;
    const k2b = document.getElementById('joinKey2_alt').value;
    
    const addIdxs = Array.from(document.getElementById('columnsToAdd2').selectedOptions).map(o => parseInt(o.value));
    const onlyMatched = document.getElementById('onlyMatchedRows').checked;

    const lookup2 = {};
    for (let i = 1; i < f2.length; i++) {
        lookup2[generateCompositeKey(f2[i], k2a, k2b)] = f2[i];
    }

    const exportRows = [[...f1[0], ...addIdxs.map(idx => f2[0][idx] + ' (match)')]];

    for (let i = 1; i < f1.length; i++) {
        const key = generateCompositeKey(f1[i], k1a, k1b);
        const match = lookup2[key];
        if (onlyMatched && !match) continue;
        const extra = match ? addIdxs.map(idx => match[idx]) : addIdxs.map(() => "");
        exportRows.push([...f1[i], ...extra]);
    }

    const csvContent = exportRows.map(r => r.join(";")).join("\n");
    downloadCSV([csvContent], "mapped_resultaat.csv");
}

// --- HELPERS & EVENT LISTENERS ---

function parseCSVToArray(text, delimiter) {
    const actualDel = delimiter === "\\t" ? "\t" : delimiter;
    return text.split("\n").map(row => row.split(actualDel));
}

function downloadCSV(rows, filename) {
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function saveMarkedRows() {
    if (!currentSheet) return;
    const marked = Array.from(document.querySelectorAll("#csvTable tbody tr.highlighted"))
                        .map(tr => Array.from(tr.cells).slice(1).map(c => c.textContent).join('|||'));
    markedRowsPerSheet[currentSheet] = marked;
}

function restoreMarkedRows() {
    const marked = markedRowsPerSheet[currentSheet] || [];
    document.querySelectorAll("#csvTable tbody tr").forEach(tr => {
        const key = Array.from(tr.cells).slice(1).map(c => c.textContent).join('|||');
        if (marked.includes(key)) tr.classList.add("highlighted");
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Tab navigatie
    const tabs = { 'tabExporter': 'exporterTabContent', 'tabMapping': 'mappingTabContent', 'tabConverter': 'converterTabContent' };
    Object.keys(tabs).forEach(id => {
        document.getElementById(id).onclick = () => {
            Object.keys(tabs).forEach(k => {
                document.getElementById(k).classList.toggle('active', k === id);
                document.getElementById(tabs[k]).style.display = k === id ? 'block' : 'none';
            });
        };
    });

    // File inputs Mapping
    const setupMappingFile = (inputId, delId, previewId, headerId, globalVar) => {
        const input = document.getElementById(inputId);
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                const del = document.getElementById(delId).value;
                let data;
                if (file.name.endsWith('.csv')) {
                    data = parseCSVToArray(ev.target.result.replace(/\r\n/g, "\n"), del);
                } else {
                    const wb = XLSX.read(new Uint8Array(ev.target.result), {type: 'array'});
                    data = parseCSVToArray(XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], {FS: del}), del);
                }
                window[globalVar] = data;
                const sel = document.getElementById(headerId);
                sel.innerHTML = data.slice(0, 10).map((r, i) => `<option value="${i}">Rij ${i+1}: ${r.slice(0,3).join('|')}</option>`).join('');
                document.getElementById(previewId).innerHTML = `<table><tr>${data[0].map(h=>`<th>${h}</th>`).join('')}</tr></table>`;
                document.getElementById('mapFilesButton').disabled = !(window.mappingFile1Data && window.mappingFile2Data);
            };
            if(file.name.endsWith('.csv')) reader.readAsText(file, "UTF-8"); else reader.readAsArrayBuffer(file);
        };
    };

    setupMappingFile('mappingFileInput1', 'mappingDelimiter1', 'mappingPreview1', 'headerRowSelector1', 'mappingFile1Data');
    setupMappingFile('mappingFileInput2', 'mappingDelimiter2', 'mappingPreview2', 'headerRowSelector2', 'mappingFile2Data');

    document.getElementById('mapFilesButton').onclick = () => showMappingPopup(window.mappingFile1Data, window.mappingFile2Data);
    document.getElementById('exportMappingButton').onclick = exportMappedData;
    document.getElementById('closeMappingButton').onclick = () => document.getElementById('mappingPopup').style.display = 'none';
    
    // Exporter inputs
    document.getElementById('csvFileInput').onchange = (e) => loadFile(e.target.files[0]);
    document.getElementById('exportButton').onclick = () => {
        const idxs = Array.from(document.querySelectorAll("#csvTable thead input:checked")).map(i => parseInt(i.dataset.index));
        const rows = [idxs.map(i => document.querySelectorAll("#csvTable thead th")[i+1].textContent.trim()).join(";")];
        document.querySelectorAll("#csvTable tbody tr").forEach(tr => {
            rows.push(idxs.map(i => tr.cells[i+1].textContent).join(";"));
        });
        downloadCSV(rows, "export.csv");
    };
});