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
            allSheets[n] = XLSX.utils.sheet_to_csv(workbook.Sheets[n], { FS: ';' }).replace(/\r\n/g, "\n").trimEnd();
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

// --- MAPPING LOGICA (Met 2-kolom support) ---
function setupMapping(inputId, delId, headId, prevId, fileNum) {
    const input = document.getElementById(inputId);
    const delSel = document.getElementById(delId);
    const headSel = document.getElementById(headId);

    const process = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const sep = delSel.value === "\\t" ? "\t" : delSel.value;
            let rows;
            if (file.name.endsWith('.csv')) {
                rows = e.target.result.replace(/\r\n/g, "\n").split("\n").map(r => r.split(sep));
            } else {
                const wb = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
                rows = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], {FS: sep}).split("\n").map(r => r.split(sep));
            }
            if (fileNum === 1) mappingFile1Data = rows; else mappingFile2Data = rows;
            
            headSel.innerHTML = rows.slice(0, 10).map((r, i) => `<option value="${i}">Rij ${i+1}: ${r.slice(0,2).join('|')}</option>`).join('');
            updateMappingPreview(prevId, rows, 0);
            document.getElementById('mapFilesButton').disabled = !(mappingFile1Data && mappingFile2Data);
        };
        if (file.name.endsWith('.csv')) reader.readAsText(file, "UTF-8"); else reader.readAsArrayBuffer(file);
    };
    input.onchange = process;
    delSel.onchange = process;
    headSel.onchange = () => updateMappingPreview(prevId, (fileNum === 1 ? mappingFile1Data : mappingFile2Data), headSel.value);
}

function updateMappingPreview(id, rows, start) {
    const slice = rows.slice(start, parseInt(start) + 5);
    document.getElementById(id).innerHTML = '<table>' + slice.map(r => '<tr>' + r.slice(0, 5).map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</table>';
}

// --- INITIALISATIE ---
document.addEventListener('DOMContentLoaded', () => {
    // Hoofd tabs navigatie
    const mainTabs = { tabExporter: 'exporterTabContent', tabMapping: 'mappingTabContent', tabConverter: 'converterTabContent' };
    Object.keys(mainTabs).forEach(id => {
        document.getElementById(id).onclick = () => {
            Object.values(mainTabs).forEach(cid => document.getElementById(cid).style.display = 'none');
            document.getElementById(mainTabs[id]).style.display = 'block';
            document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
            document.getElementById(id).classList.add('active');
        };
    });

    document.getElementById('csvFileInput').onchange = (e) => loadFile(e.target.files[0]);
    document.getElementById('reloadButton').onclick = () => currentFile && loadFile(currentFile);
    document.getElementById('delimiter').onchange = () => currentSheet && renderTable(allSheets[currentSheet]);

    // Mapping setup
    setupMapping('mappingFileInput1', 'mappingDelimiter1', 'headerRowSelector1', 'mappingPreview1', 1);
    setupMapping('mappingFileInput2', 'mappingDelimiter2', 'headerRowSelector2', 'mappingPreview2', 2);

    document.getElementById('mapFilesButton').onclick = () => {
        const h1 = document.getElementById('headerRowSelector1').value;
        const h2 = document.getElementById('headerRowSelector2').value;
        const fill = (id, headers, optional) => {
            document.getElementById(id).innerHTML = (optional ? '<option value="">-- Geen --</option>' : '') + 
                headers.map((h, i) => `<option value="${i}">${h || 'Kolom '+i}</option>`).join('');
        };
        fill('joinKey1', mappingFile1Data[h1], false); fill('joinKey1_alt', mappingFile1Data[h1], true);
        fill('joinKey2', mappingFile2Data[h2], false); fill('joinKey2_alt', mappingFile2Data[h2], true);
        fill('columnsToAdd2', mappingFile2Data[h2], false);
        document.getElementById('mappingPopup').style.display = 'block';
    };

    document.getElementById('exportMappingButton').onclick = () => {
        const h1 = document.getElementById('headerRowSelector1').value, h2 = document.getElementById('headerRowSelector2').value;
        const f1 = mappingFile1Data.slice(h1), f2 = mappingFile2Data.slice(h2);
        const k1a = document.getElementById('joinKey1').value, k1b = document.getElementById('joinKey1_alt').value;
        const k2a = document.getElementById('joinKey2').value, k2b = document.getElementById('joinKey2_alt').value;
        const adds = Array.from(document.getElementById('columnsToAdd2').selectedOptions).map(o => parseInt(o.value));
        
        const getK = (r, a, b) => (r[a]||'').trim().toLowerCase() + (b ? "___"+(r[b]||'').trim().toLowerCase() : "");
        const lookup = {}; f2.slice(1).forEach(r => lookup[getK(r, k2a, k2b)] = r);
        
        const out = [[...f1[0], ...adds.map(i => f2[0][i])]];
        f1.slice(1).forEach(r => {
            const m = lookup[getK(r, k1a, k1b)];
            if (document.getElementById('onlyMatchedRows').checked && !m) return;
            out.push([...r, ...adds.map(i => m ? m[i] : "")]);
        });
        const blob = new Blob([out.map(r => r.join(';')).join('\n')], {type: 'text/csv'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mapped_resultaat.csv'; a.click();
    };

    document.getElementById('closeMappingButton').onclick = () => document.getElementById('mappingPopup').style.display = 'none';

    // PDF Converter Events
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