let currentFile = null;
let allSheets = {}; 
let currentSheet = null; 
let mappingFile1Data = null;
let mappingFile2Data = null;

// --- TAB NAVIGATIE ---
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

// --- EXPORTER FUNCTIES ---
function loadFile(file) {
    currentFile = file;
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            allSheets = { 'CSV Data': e.target.result.replace(/\r\n/g, "\n") };
            currentSheet = 'CSV Data';
            renderTable(allSheets[currentSheet]);
            document.getElementById('exportControls').style.display = 'block';
        };
        reader.readAsText(file, "UTF-8");
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
            allSheets = {};
            wb.SheetNames.forEach(n => {
                allSheets[n] = XLSX.utils.sheet_to_csv(wb.Sheets[n], { FS: ';' });
            });
            currentSheet = wb.SheetNames[0];
            renderTable(allSheets[currentSheet]);
            document.getElementById('exportControls').style.display = 'block';
        };
        reader.readAsArrayBuffer(file);
    }
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
            th.innerHTML = `<input type="checkbox" checked data-index="${i}"> ${h || ''}`;
            hr.appendChild(th);
        });
        thead.appendChild(hr);

        rows.slice(1).forEach(row => {
            if (row.length <= 1 && row[0] === "") return;
            const tr = document.createElement("tr");
            tr.innerHTML = '<td><button onclick="this.closest(\'tr\').remove()">X</button></td>' + 
                           row.map(c => `<td>${c}</td>`).join('');
            tbody.appendChild(tr);
        });
    }
}

// --- MAPPING LOGICA ---
function setupMapping(inputId, delId, headId, prevId, dataVar) {
    const input = document.getElementById(inputId);
    const del = document.getElementById(delId);
    const head = document.getElementById(headId);

    const run = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const sep = del.value === "\\t" ? "\t" : del.value;
            let rows;
            if (file.name.endsWith('.csv')) {
                rows = e.target.result.replace(/\r\n/g, "\n").split("\n").map(r => r.split(sep));
            } else {
                const wb = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
                rows = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], {FS: sep}).split("\n").map(r => r.split(sep));
            }
            if (dataVar === 1) mappingFile1Data = rows; else mappingFile2Data = rows;

            head.innerHTML = rows.slice(0, 10).map((r, i) => `<option value="${i}">Rij ${i+1}: ${r.slice(0,2).join('|')}</option>`).join('');
            updateMappingPreview(prevId, rows, 0);
            document.getElementById('mapFilesButton').disabled = !(mappingFile1Data && mappingFile2Data);
        };
        if (file.name.endsWith('.csv')) reader.readAsText(file); else reader.readAsArrayBuffer(file);
    };

    input.onchange = run;
    del.onchange = run;
    head.onchange = () => updateMappingPreview(prevId, (dataVar === 1 ? mappingFile1Data : mappingFile2Data), head.value);
}

function updateMappingPreview(id, rows, start) {
    const data = rows.slice(start, parseInt(start) + 5);
    document.getElementById(id).innerHTML = '<table>' + 
        data.map(r => '<tr>' + r.slice(0, 5).map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</table>';
}

function exportMappedData() {
    const f1 = mappingFile1Data.slice(document.getElementById('headerRowSelector1').value);
    const f2 = mappingFile2Data.slice(document.getElementById('headerRowSelector2').value);
    
    const k1a = document.getElementById('joinKey1').value, k1b = document.getElementById('joinKey1_alt').value;
    const k2a = document.getElementById('joinKey2').value, k2b = document.getElementById('joinKey2_alt').value;
    const adds = Array.from(document.getElementById('columnsToAdd2').selectedOptions).map(o => parseInt(o.value));

    const getK = (r, a, b) => (r[a]||'').trim().toLowerCase() + (b ? "___" + (r[b]||'').trim().toLowerCase() : "");
    const lookup = {};
    f2.slice(1).forEach(r => { lookup[getK(r, k2a, k2b)] = r; });

    const out = [[...f1[0], ...adds.map(i => f2[0][i])]];
    f1.slice(1).forEach(r => {
        const m = lookup[getK(r, k1a, k1b)];
        if (document.getElementById('onlyMatchedRows').checked && !m) return;
        out.push([...r, ...adds.map(i => m ? m[i] : "")]);
    });

    const blob = new Blob([out.map(r => r.join(';')).join('\n')], {type: 'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gemapte_export.csv';
    a.click();
}

// --- INITIALISATIE ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('csvFileInput').onchange = (e) => loadFile(e.target.files[0]);
    document.getElementById('reloadButton').onclick = () => currentFile && loadFile(currentFile);
    
    setupMapping('mappingFileInput1', 'mappingDelimiter1', 'headerRowSelector1', 'mappingPreview1', 1);
    setupMapping('mappingFileInput2', 'mappingDelimiter2', 'headerRowSelector2', 'mappingPreview2', 2);

    document.getElementById('mapFilesButton').onclick = () => {
        const h1 = document.getElementById('headerRowSelector1').value;
        const h2 = document.getElementById('headerRowSelector2').value;
        const fill = (id, headers, opt) => {
            document.getElementById(id).innerHTML = (opt ? '<option value="">-- Geen --</option>' : '') + 
                headers.map((h, i) => `<option value="${i}">${h || 'Kolom '+i}</option>`).join('');
        };
        fill('joinKey1', mappingFile1Data[h1], false);
        fill('joinKey1_alt', mappingFile1Data[h1], true);
        fill('joinKey2', mappingFile2Data[h2], false);
        fill('joinKey2_alt', mappingFile2Data[h2], true);
        fill('columnsToAdd2', mappingFile2Data[h2], false);
        document.getElementById('mappingPopup').style.display = 'block';
    };

    document.getElementById('exportMappingButton').onclick = exportMappedData;
    document.getElementById('closeMappingButton').onclick = () => document.getElementById('mappingPopup').style.display='none';

    // PDF Converter koppeling
    const pdfInput = document.getElementById('pdfFileInput');
    if(pdfInput) {
        pdfInput.onchange = (e) => {
            if(window.handlePdfToExcel) window.handlePdfToExcel(e.target.files[0], document.getElementById('pdfDataPreview'), document.getElementById('downloadExcelBtn'));
        };
    }
});