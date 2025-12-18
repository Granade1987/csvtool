/** * MIKE'S TOOL - RECOVERY VERSION
 * Bevat: Exporter, 2-Kolom Mapping, PDF Converter Bridge
 */
let currentFile = null;
let allSheets = {}; 
let currentSheet = null; 
let mappingFile1Data = null;
let mappingFile2Data = null;

// --- 1. EXPORTER: BESTANDEN LADEN ---
function loadFile(file) {
    currentFile = file;
    const reader = new FileReader();
    const isExcel = file.name.match(/\.(xlsx|xls)$/i);

    reader.onload = (e) => {
        try {
            if (isExcel) {
                const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                allSheets = {};
                wb.SheetNames.forEach(n => {
                    allSheets[n] = XLSX.utils.sheet_to_csv(wb.Sheets[n], { FS: ';' });
                });
                currentSheet = wb.SheetNames[0];
                renderTabs();
            } else {
                allSheets = { 'CSV Data': e.target.result.replace(/\r\n/g, "\n") };
                currentSheet = 'CSV Data';
                document.getElementById('tabsContainer').style.display = 'none';
            }
            renderTable(allSheets[currentSheet]);
            document.getElementById('exportControls').style.display = 'block';
            document.getElementById('infoMessage').style.display = 'none';
        } catch (err) {
            console.error("Fout bij laden:", err);
            alert("Bestand kon niet worden gelezen.");
        }
    };
    if (isExcel) reader.readAsArrayBuffer(file); else reader.readAsText(file, "UTF-8");
}

function renderTable(csvData) {
    const tableCont = document.getElementById('tableContainer');
    if (!csvData) return;

    const del = document.getElementById("delimiter").value === "\\t" ? "\t" : document.getElementById("delimiter").value;
    const rows = csvData.trim().split("\n").map(r => r.split(del)).filter(r => r.length > 0 && r[0] !== "");
    
    const thead = document.querySelector("#csvTable thead");
    const tbody = document.querySelector("#csvTable tbody");
    thead.innerHTML = ""; tbody.innerHTML = "";

    if (rows.length > 0) {
        // Headers
        const trH = document.createElement("tr");
        trH.innerHTML = "<th>Actie</th>" + rows[0].map((h, i) => `
            <th>
                <input type="checkbox" checked data-index="${i}"> 
                <span style="cursor:pointer" class="sort-header" data-idx="${i}">${h || 'Kol '+i}</span>
            </th>`).join('');
        thead.appendChild(trH);

        // Body
        rows.slice(1).forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = '<td><button class="del-row-btn">X</button></td>' + row.map(c => `<td>${c}</td>`).join('');
            tr.querySelector('button').onclick = () => tr.remove();
            tr.onclick = (e) => { if(e.target.tagName !== 'BUTTON') tr.classList.toggle("highlighted"); };
            tbody.appendChild(tr);
        });
        tableCont.style.display = 'block';
    }
}

function renderTabs() {
    const container = document.getElementById('tabsContainer');
    container.innerHTML = ''; container.style.display = 'flex';
    Object.keys(allSheets).forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'tab-button' + (name === currentSheet ? ' active' : '');
        btn.textContent = name;
        btn.onclick = () => { currentSheet = name; renderTabs(); renderTable(allSheets[name]); };
        container.appendChild(btn);
    });
}

// --- 2. MAPPING: 2-KOLOM LOGICA ---
function setupMappingInput(inputId, delId, headId, prevId, fileNum) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            const sep = document.getElementById(delId).value;
            let rows;
            if (file.name.match(/\.(xlsx|xls)$/i)) {
                const wb = XLSX.read(new Uint8Array(ev.target.result), {type:'array'});
                rows = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], {FS:sep}).split("\n").map(r => r.split(sep));
            } else {
                rows = ev.target.result.replace(/\r\n/g, "\n").split("\n").map(r => r.split(sep));
            }
            if (fileNum === 1) mappingFile1Data = rows; else mappingFile2Data = rows;
            
            // UI Update
            document.getElementById(headId).innerHTML = rows.slice(0,10).map((r,i) => `<option value="${i}">Rij ${i+1}: ${r.slice(0,2).join('|')}</option>`).join('');
            document.getElementById(prevId).innerHTML = '<table class="preview-table">' + rows.slice(0,3).map(r => '<tr>' + r.slice(0,3).map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</table>';
            document.getElementById('mapFilesButton').disabled = !(mappingFile1Data && mappingFile2Data);
        };
        if (file.name.match(/\.(xlsx|xls)$/i)) reader.readAsArrayBuffer(file); else reader.readAsText(file, "UTF-8");
    };
}

function runMappingExport() {
    const h1 = parseInt(document.getElementById('headerRowSelector1').value);
    const h2 = parseInt(document.getElementById('headerRowSelector2').value);
    const f1 = mappingFile1Data.slice(h1);
    const f2 = mappingFile2Data.slice(h2);

    const k1a = document.getElementById('joinKey1').value;
    const k1b = document.getElementById('joinKey1_alt').value;
    const k2a = document.getElementById('joinKey2').value;
    const k2b = document.getElementById('joinKey2_alt').value;
    const extra = Array.from(document.getElementById('columnsToAdd2').selectedOptions).map(o => parseInt(o.value));

    const getK = (r, a, b) => (r[a]||"").trim().toLowerCase() + (b ? "|" + (r[b]||"").trim().toLowerCase() : "");
    const look = {}; f2.slice(1).forEach(r => look[getK(r, k2a, k2b)] = r);

    const res = [[...f1[0], ...extra.map(i => f2[0][i])]];
    f1.slice(1).forEach(r => {
        const m = look[getK(r, k1a, k1b)];
        if(!m && document.getElementById('onlyMatchedRows').checked) return;
        res.push([...r, ...extra.map(i => m ? m[i] : "")]);
    });

    const blob = new Blob([res.map(r => r.join(';')).join('\n')], {type: 'text/csv;charset=utf-8;'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mapped_data.csv'; a.click();
}

// --- 3. INITIALISATIE ---
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    document.querySelectorAll('.main-tab').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.id.replace('tab', '').toLowerCase();
            ['exporter', 'mapping', 'converter'].forEach(id => {
                document.getElementById(id + 'TabContent').style.display = (id === target) ? 'block' : 'none';
            });
        };
    });

    // Exporter events
    document.getElementById('csvFileInput').onchange = (e) => loadFile(e.target.files[0]);
    document.getElementById('delimiter').onchange = () => { if(currentSheet) renderTable(allSheets[currentSheet]); };
    
    document.getElementById('exportButton').onclick = () => {
        const del = document.getElementById("delimiter").value === "\\t" ? "\t" : document.getElementById("delimiter").value;
        const idx = Array.from(document.querySelectorAll('#csvTable thead input:checked')).map(cb => parseInt(cb.dataset.index));
        let out = [idx.map(i => document.querySelectorAll('#csvTable thead th')[i+1].innerText.trim()).join(del)];
        document.querySelectorAll('#csvTable tbody tr').forEach(tr => out.push(idx.map(i => tr.cells[i+1].innerText).join(del)));
        const b = new Blob([out.join('\n')], {type:'text/csv'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'export.csv'; a.click();
    };

    // Mapping events
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
});