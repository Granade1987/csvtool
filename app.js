let currentFile = null;
let allSheets = {}; 
let currentSheet = null; 
let mappingFile1Data = null;
let mappingFile2Data = null;

// --- EXPORTER ---
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
        document.getElementById('exportControls').classList.add('active');
        document.getElementById('infoMessage').style.display = 'none';
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
        document.getElementById('exportControls').classList.add('active');
    };
    reader.readAsArrayBuffer(file);
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
        rows[0].forEach((h, i) => {
            const th = document.createElement("th");
            th.innerHTML = `<input type="checkbox" checked data-index="${i}"> ${h || ""}`;
            headerRow.appendChild(th);
        });
        tableHead.appendChild(headerRow);

        rows.slice(1).forEach(row => {
            if (row.length <= 1 && row[0] === "") return;
            const tr = document.createElement("tr");
            tr.innerHTML = '<td><button onclick="this.closest(\'tr\').remove()">X</button></td>' + 
                           row.map(c => `<td>${c}</td>`).join('');
            tr.onclick = (e) => { if(e.target.tagName !== 'BUTTON') tr.classList.toggle("highlighted"); };
            tableBody.appendChild(tr);
        });
    }
}

function renderTabs() {
    const container = document.getElementById('tabsContainer');
    container.innerHTML = '';
    container.classList.add('active');
    Object.keys(allSheets).forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'tab-button' + (name === currentSheet ? ' active' : '');
        btn.textContent = name;
        btn.onclick = () => { currentSheet = name; renderTabs(); renderTable(allSheets[name]); };
        container.appendChild(btn);
    });
}

// --- MAPPING LOGICA ---

function setupMappingFile(inputId, delId, previewId, headerId, globalVar) {
    const input = document.getElementById(inputId);
    const delSelect = document.getElementById(delId);
    const headSelect = document.getElementById(headerId);

    const process = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const del = delSelect.value === "\\t" ? "\t" : delSelect.value;
            let rows;
            if (file.name.endsWith('.csv')) {
                rows = e.target.result.replace(/\r\n/g, "\n").split("\n").map(r => r.split(del));
            } else {
                const wb = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
                rows = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], {FS: del}).split("\n").map(r => r.split(del));
            }
            window[globalVar] = rows;
            
            // Vul Kopregel selector
            headSelect.innerHTML = rows.slice(0, 10).map((r, i) => 
                `<option value="${i}">Rij ${i+1}: ${r.slice(0,3).join(' | ')}</option>`).join('');
            
            updatePreview(previewId, rows, 0);
            checkMappingReady();
        };
        if (file.name.endsWith('.csv')) reader.readAsText(file, "UTF-8");
        else reader.readAsArrayBuffer(file);
    };

    input.onchange = process;
    delSelect.onchange = process;
    headSelect.onchange = () => updatePreview(previewId, window[globalVar], headSelect.value);
}

function updatePreview(previewId, rows, startIdx) {
    if (!rows) return;
    const data = rows.slice(startIdx, parseInt(startIdx) + 5);
    let html = '<table>';
    data.forEach((row, i) => {
        html += '<tr>' + row.slice(0, 10).map(c => i === 0 ? `<th>${c}</th>` : `<td>${c}</td>`).join('') + '</tr>';
    });
    html += '</table>';
    document.getElementById(previewId).innerHTML = html;
}

function checkMappingReady() {
    document.getElementById('mapFilesButton').disabled = !(window.mappingFile1Data && window.mappingFile2Data);
}

function generateCompositeKey(row, idx1, idx2) {
    const val1 = (row[idx1] || '').toString().trim().toLowerCase();
    const val2 = (idx2 !== "" && idx2 !== undefined) ? (row[idx2] || '').toString().trim().toLowerCase() : "";
    return val1 + "___" + val2;
}

function showMappingPopup() {
    const h1 = parseInt(document.getElementById('headerRowSelector1').value || 0);
    const h2 = parseInt(document.getElementById('headerRowSelector2').value || 0);
    
    window.f1_proc = window.mappingFile1Data.slice(h1);
    window.f2_proc = window.mappingFile2Data.slice(h2);

    const fill = (id, headers, empty) => {
        let h = empty ? '<option value="">-- Geen --</option>' : '';
        h += headers.map((n, i) => `<option value="${i}">${n || 'Kolom '+i}</option>`).join('');
        document.getElementById(id).innerHTML = h;
    };

    fill('joinKey1', window.f1_proc[0], false);
    fill('joinKey1_alt', window.f1_proc[0], true);
    fill('joinKey2', window.f2_proc[0], false);
    fill('joinKey2_alt', window.f2_proc[0], true);
    fill('columnsToAdd2', window.f2_proc[0], false);

    document.getElementById('mappingPopup').style.display = 'block';
}

function exportMappedData() {
    const f1 = window.f1_proc;
    const f2 = window.f2_proc;
    const k1a = document.getElementById('joinKey1').value;
    const k1b = document.getElementById('joinKey1_alt').value;
    const k2a = document.getElementById('joinKey2').value;
    const k2b = document.getElementById('joinKey2_alt').value;
    const adds = Array.from(document.getElementById('columnsToAdd2').selectedOptions).map(o => parseInt(o.value));
    
    const lookup = {};
    for(let i=1; i<f2.length; i++) lookup[generateCompositeKey(f2[i], k2a, k2b)] = f2[i];

    const res = [[...f1[0], ...adds.map(ai => f2[0][ai] + '_match')]];
    for(let i=1; i<f1.length; i++) {
        const match = lookup[generateCompositeKey(f1[i], k1a, k1b)];
        if (document.getElementById('onlyMatchedRows').checked && !match) continue;
        res.push([...f1[i], ...adds.map(ai => match ? match[ai] : "")]);
    }

    const blob = new Blob([res.map(r => r.join(";")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "mapped_result.csv";
    link.click();
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    ['tabExporter', 'tabMapping', 'tabConverter'].forEach(id => {
        document.getElementById(id).onclick = () => {
            ['exporterTabContent', 'mappingTabContent', 'converterTabContent'].forEach(c => document.getElementById(c).style.display = 'none');
            document.getElementById(id.replace('tab', '') + 'TabContent').style.display = 'block';
            document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
            document.getElementById(id).classList.add('active');
        };
    });

    setupMappingFile('mappingFileInput1', 'mappingDelimiter1', 'mappingPreview1', 'headerRowSelector1', 'mappingFile1Data');
    setupMappingFile('mappingFileInput2', 'mappingDelimiter2', 'mappingPreview2', 'headerRowSelector2', 'mappingFile2Data');

    document.getElementById('csvFileInput').onchange = (e) => loadFile(e.target.files[0]);
    document.getElementById('mapFilesButton').onclick = showMappingPopup;
    document.getElementById('exportMappingButton').onclick = exportMappedData;
    document.getElementById('closeMappingButton').onclick = () => document.getElementById('mappingPopup').style.display = 'none';
});