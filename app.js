let currentFile = null, allSheets = {}, currentSheet = null, sortState = {}, markedRowsPerSheet = {};
let mappingFile1Data = null, mappingFile2Data = null;

// --- EXPORTER ---
function loadFile(file) {
    currentFile = file;
    const isExcel = file.name.match(/\.(xlsx|xls)$/i);
    const reader = new FileReader();
    reader.onload = (e) => {
        if (isExcel) {
            const wb = XLSX.read(new Uint8Array(e.target.result), {type: 'array'});
            allSheets = {};
            wb.SheetNames.forEach(n => allSheets[n] = XLSX.utils.sheet_to_csv(wb.Sheets[n], {FS:';'}));
            currentSheet = wb.SheetNames[0];
            renderTabs();
        } else {
            allSheets = {'CSV Data': e.target.result.replace(/\r\n/g, "\n")};
            currentSheet = 'CSV Data';
            document.getElementById('tabsContainer').style.display = 'none';
        }
        renderTable(allSheets[currentSheet]);
        document.getElementById('exportControls').style.display = 'block';
        document.getElementById('infoMessage').style.display = 'none';
    };
    if (isExcel) reader.readAsArrayBuffer(file); else reader.readAsText(file, "UTF-8");
}

function renderTable(csvData) {
    const del = document.getElementById("delimiter").value === "\\t" ? "\t" : document.getElementById("delimiter").value;
    const rows = csvData.trim().split("\n").map(r => r.split(del));
    const thead = document.querySelector("#csvTable thead"), tbody = document.querySelector("#csvTable tbody");
    thead.innerHTML = ""; tbody.innerHTML = "";

    if (rows.length > 0) {
        const trH = document.createElement("tr");
        trH.innerHTML = "<th>Actie</th>" + rows[0].map((h, i) => `<th><input type="checkbox" checked data-index="${i}"> <span style="cursor:pointer" onclick="sortTable(${i})">${h || ''}</span></th>`).join('');
        thead.appendChild(trH);
        rows.slice(1).forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = '<td><button onclick="this.closest(\'tr\').remove()">X</button></td>' + row.map(c => `<td>${c}</td>`).join('');
            tr.onclick = (e) => { if(e.target.tagName !== 'BUTTON') tr.classList.toggle("highlighted"); };
            tbody.appendChild(tr);
        });
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

// --- MAPPING LOGICA ---
function setupMapping(inputId, delId, headId, prevId, fileNum) {
    document.getElementById(inputId).onchange = (e) => {
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
            document.getElementById(headId).innerHTML = rows.slice(0,10).map((r,i) => `<option value="${i}">Rij ${i+1}: ${r.slice(0,2).join('|')}</option>`).join('');
            document.getElementById(prevId).innerHTML = '<table>'+rows.slice(0,5).map(r => '<tr>'+r.slice(0,5).map(c=>`<td>${c}</td>`).join('')+'</tr>').join('')+'</table>';
            document.getElementById('mapFilesButton').disabled = !(mappingFile1Data && mappingFile2Data);
        };
        if (file.name.match(/\.(xlsx|xls)$/i)) reader.readAsArrayBuffer(file); else reader.readAsText(file, "UTF-8");
    };
}

// --- EXPORT MAPPED DATA ---
function runMappedExport() {
    const h1 = document.getElementById('headerRowSelector1').value, h2 = document.getElementById('headerRowSelector2').value;
    const f1 = mappingFile1Data.slice(h1), f2 = mappingFile2Data.slice(h2);
    const k1a = document.getElementById('joinKey1').value, k1b = document.getElementById('joinKey1_alt').value;
    const k2a = document.getElementById('joinKey2').value, k2b = document.getElementById('joinKey2_alt').value;
    const adds = Array.from(document.getElementById('columnsToAdd2').selectedOptions).map(o => parseInt(o.value));

    const getK = (r, a, b) => (r[a]||'').trim().toLowerCase() + (b ? "||" + (r[b]||'').trim().toLowerCase() : "");
    const look = {}; 
    f2.slice(1).forEach(r => look[getK(r, k2a, k2b)] = r);

    const res = [[...f1[0], ...adds.map(i => f2[0][i])]];
    f1.slice(1).forEach(r => {
        const match = look[getK(r, k1a, k1b)];
        if(!match && document.getElementById('onlyMatchedRows').checked) return;
        res.push([...r, ...adds.map(i => match ? match[i] : "")]);
    });

    const blob = new Blob([res.map(r => r.join(';')).join('\n')], {type: 'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mapped_result.csv'; a.click();
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // Tabs
    document.querySelectorAll('.main-tab').forEach(b => b.onclick = () => {
        document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
        b.classList.add('active');
        ['exporter', 'mapping', 'converter'].forEach(id => {
            document.getElementById(id+'TabContent').style.display = (id === b.id.replace('tab','').toLowerCase()) ? 'block' : 'none';
        });
    });

    // Exporter
    document.getElementById('csvFileInput').onchange = (e) => loadFile(e.target.files[0]);
    document.getElementById('exportButton').onclick = () => {
        const del = document.getElementById("delimiter").value === "\\t" ? "\t" : document.getElementById("delimiter").value;
        const idx = Array.from(document.querySelectorAll('#csvTable thead input:checked')).map(cb => parseInt(cb.dataset.index));
        let out = [idx.map(i => document.querySelectorAll('#csvTable thead th')[i+1].innerText).join(del)];
        document.querySelectorAll('#csvTable tbody tr').forEach(tr => out.push(idx.map(i => tr.cells[i+1].innerText).join(del)));
        const blob = new Blob([out.join('\n')], {type:'text/csv'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'export.csv'; a.click();
    };

    // Mapping Setup
    setupMapping('mappingFileInput1', 'mappingDelimiter1', 'headerRowSelector1', 'mappingPreview1', 1);
    setupMapping('mappingFileInput2', 'mappingDelimiter2', 'headerRowSelector2', 'mappingPreview2', 2);

    document.getElementById('mapFilesButton').onclick = () => {
        const h1 = mappingFile1Data[document.getElementById('headerRowSelector1').value];
        const h2 = mappingFile2Data[document.getElementById('headerRowSelector2').value];
        const f = (id, h, opt) => document.getElementById(id).innerHTML = (opt ? '<option value="">-- Geen --</option>':'') + h.map((x,i)=>`<option value="${i}">${x||'Kol '+i}</option>`).join('');
        f('joinKey1', h1, false); f('joinKey1_alt', h1, true);
        f('joinKey2', h2, false); f('joinKey2_alt', h2, true);
        f('columnsToAdd2', h2, false);
        document.getElementById('mappingPopup').style.display = 'flex';
    };

    document.getElementById('exportMappingButton').onclick = runMappedExport;
    document.getElementById('closeMappingButton').onclick = () => document.getElementById('mappingPopup').style.display = 'none';
});