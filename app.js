let currentFile = null;
let allSheets = {}; 
let currentSheet = null; 
let sortState = {};
let markedRowsPerSheet = {};
let mappingFile1Data = null;
let mappingFile2Data = null;

// --- EXPORTER FUNCTIES ---
function loadFile(file) {
    currentFile = file;
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.csv')) loadCSV(file);
    else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) loadExcel(file);
}

function loadCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        allSheets = { 'CSV Data': e.target.result.replace(/\r\n/g, "\n").trimEnd() };
        currentSheet = 'CSV Data';
        renderTable(allSheets[currentSheet]);
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
            th.innerHTML = `<input type="checkbox" checked data-index="${i}"> <span style="cursor:pointer">${h || ""}</span><span class="sort-arrow"></span>`;
            th.onclick = () => sortTable(i, th.querySelector('.sort-arrow'));
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

function getExportData(onlyMarked) {
    const del = document.getElementById("delimiter").value === "\\t" ? "\t" : document.getElementById("delimiter").value;
    const colIndices = [];
    const headers = [];
    document.querySelectorAll('#csvTable thead input[type="checkbox"]').forEach(cb => {
        if(cb.checked) {
            colIndices.push(parseInt(cb.getAttribute('data-index')));
            headers.push(cb.parentElement.textContent.trim());
        }
    });

    const output = [headers.join(del)];
    const rows = onlyMarked ? document.querySelectorAll("#csvTable tbody tr.highlighted") : document.querySelectorAll("#csvTable tbody tr");
    
    rows.forEach(tr => {
        const cells = Array.from(tr.cells).slice(1);
        output.push(colIndices.map(i => cells[i] ? cells[i].textContent : "").join(del));
    });
    return output.join("\n");
}

// --- MAPPING LOGICA ---
function setupMapping(inputId, delId, headId, prevId, fileNum) {
    const input = document.getElementById(inputId);
    input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const sep = document.getElementById(delId).value === "\\t" ? "\t" : document.getElementById(delId).value;
            let rows;
            if (file.name.endsWith('.csv')) {
                rows = e.target.result.replace(/\r\n/g, "\n").split("\n").map(r => r.split(sep));
            } else {
                const wb = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
                rows = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], {FS: sep}).split("\n").map(r => r.split(sep));
            }
            if (fileNum === 1) mappingFile1Data = rows; else mappingFile2Data = rows;
            
            const headSel = document.getElementById(headId);
            headSel.innerHTML = rows.slice(0, 10).map((r, i) => `<option value="${i}">Rij ${i+1}: ${r.slice(0,2).join('|')}</option>`).join('');
            document.getElementById(prevId).innerHTML = '<table>' + rows.slice(0,5).map(r => '<tr>'+r.slice(0,5).map(c=>`<td>${c}</td>`).join('')+'</tr>').join('') + '</table>';
            document.getElementById('mapFilesButton').disabled = !(mappingFile1Data && mappingFile2Data);
        };
        if (file.name.endsWith('.csv')) reader.readAsText(file, "UTF-8"); else reader.readAsArrayBuffer(file);
    };
}

// --- INITIALISATIE ---
document.addEventListener('DOMContentLoaded', () => {
    // Tab Wisselen
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

    // Exporter Knoppen
    document.getElementById('csvFileInput').onchange = (e) => loadFile(e.target.files[0]);
    document.getElementById('exportButton').onclick = () => {
        const blob = new Blob([getExportData(false)], {type: 'text/csv'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'export_alle.csv'; a.click();
    };
    document.getElementById('exportMarkedButton').onclick = () => {
        const data = getExportData(true);
        if (data.split("\n").length <= 1) return alert("Selecteer eerst rijen!");
        const blob = new Blob([data], {type: 'text/csv'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'export_gemarkeerd.csv'; a.click();
    };

    // Mapping Knoppen
    setupMapping('mappingFileInput1', 'mappingDelimiter1', 'headerRowSelector1', 'mappingPreview1', 1);
    setupMapping('mappingFileInput2', 'mappingDelimiter2', 'headerRowSelector2', 'mappingPreview2', 2);

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

    document.getElementById('exportMappingButton').onclick = () => {
        const f1 = mappingFile1Data.slice(document.getElementById('headerRowSelector1').value);
        const f2 = mappingFile2Data.slice(document.getElementById('headerRowSelector2').value);
        const k1a = document.getElementById('joinKey1').value, k1b = document.getElementById('joinKey1_alt').value;
        const k2a = document.getElementById('joinKey2').value, k2b = document.getElementById('joinKey2_alt').value;
        const adds = Array.from(document.getElementById('columnsToAdd2').selectedOptions).map(o => parseInt(o.value));
        
        const getK = (r, a, b) => (r[a]||'').trim().toLowerCase() + (b ? "___"+(r[b]||'').trim().toLowerCase() : "");
        const lookup = {}; f2.slice(1).forEach(r => lookup[getK(r, k2a, k2b)] = r);
        
        const res = [[...f1[0], ...adds.map(i => f2[0][i])]];
        f1.slice(1).forEach(r => {
            const m = lookup[getK(r, k1a, k1b)];
            if (!m && document.getElementById('onlyMatchedRows').checked) return;
            res.push([...r, ...adds.map(i => m ? m[i] : "")]);
        });
        
        const blob = new Blob([res.map(r => r.join(';')).join('\n')], {type: 'text/csv'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mapped_result.csv'; a.click();
    };

    document.getElementById('closeMappingButton').onclick = () => document.getElementById('mappingPopup').style.display = 'none';
});

// Hulpfuncties UI
function toggleUI(hasData, isExcel) {
    document.getElementById('exportControls').style.display = hasData ? 'block' : 'none';
    document.getElementById('tableCard').style.display = hasData ? 'block' : 'none';
    document.getElementById('infoMessageCard').style.display = hasData ? 'none' : 'block';
    document.getElementById('tabsContainer').style.display = isExcel ? 'flex' : 'none';
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