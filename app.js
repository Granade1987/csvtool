// Globale variabelen voor opslag
let mappingFile1Data = null;
let mappingFile2Data = null;
let currentSheetData = null;

// TAB NAVIGATIE
document.querySelectorAll('.main-tab').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.main-tab').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        const tabName = button.id.replace('tab', '').toLowerCase();
        
        ['exporterTabContent', 'mappingTabContent', 'converterTabContent'].forEach(id => {
            document.getElementById(id).style.display = id.toLowerCase().includes(tabName) ? 'block' : 'none';
        });
    });
});

// MAPPING LOGICA: BESTANDEN LADEN EN PREVIEW
function setupMappingFile(inputId, previewId, headerId, dataVar) {
    const input = document.getElementById(inputId);
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            let rows = [];
            if (file.name.endsWith('.csv')) {
                rows = ev.target.result.split('\n').map(r => r.split(';'));
            } else {
                const wb = XLSX.read(new Uint8Array(ev.target.result), {type: 'array'});
                rows = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], {FS: ';'}).split('\n').map(r => r.split(';'));
            }
            
            if (dataVar === 1) mappingFile1Data = rows; else mappingFile2Data = rows;
            
            // Vul kopregel selector
            const headSel = document.getElementById(headerId);
            headSel.innerHTML = rows.slice(0, 10).map((r, i) => `<option value="${i}">Rij ${i+1}: ${r.slice(0,2).join('|')}</option>`).join('');
            
            renderMappingPreview(previewId, rows, 0);
            checkMappingReady();
        };
        if (file.name.endsWith('.csv')) reader.readAsText(file); else reader.readAsArrayBuffer(file);
    });

    document.getElementById(headerId).addEventListener('change', (e) => {
        const data = (dataVar === 1) ? mappingFile1Data : mappingFile2Data;
        renderMappingPreview(previewId, data, e.target.value);
    });
}

function renderMappingPreview(id, rows, start) {
    const slice = rows.slice(start, parseInt(start) + 5);
    let html = '<table class="preview-table">';
    slice.forEach(row => {
        html += '<tr>' + row.slice(0, 5).map(c => `<td>${c}</td>`).join('') + '</tr>';
    });
    html += '</table>';
    document.getElementById(id).innerHTML = html;
}

function checkMappingReady() {
    document.getElementById('mapFilesButton').disabled = !(mappingFile1Data && mappingFile2Data);
}

// POPUP OPENEN
document.getElementById('mapFilesButton').addEventListener('click', () => {
    const h1 = document.getElementById('headerRowSelector1').value;
    const h2 = document.getElementById('headerRowSelector2').value;
    const f1 = mappingFile1Data.slice(h1);
    const f2 = mappingFile2Data.slice(h2);

    const fill = (id, headers, opt) => {
        const el = document.getElementById(id);
        el.innerHTML = (opt ? '<option value="">-- Geen --</option>' : '') + 
                       headers.map((h, i) => `<option value="${i}">${h || 'Kolom '+i}</option>`).join('');
    };

    fill('joinKey1', f1[0], false);
    fill('joinKey1_alt', f1[0], true);
    fill('joinKey2', f2[0], false);
    fill('joinKey2_alt', f2[0], true);
    fill('columnsToAdd2', f2[0], false);
    
    document.getElementById('mappingPopup').style.display = 'block';
});

// EXPORTEREN VAN GEMAPTE DATA
document.getElementById('exportMappingButton').addEventListener('click', () => {
    const h1 = document.getElementById('headerRowSelector1').value;
    const h2 = document.getElementById('headerRowSelector2').value;
    const f1 = mappingFile1Data.slice(h1);
    const f2 = mappingFile2Data.slice(h2);
    
    const k1a = document.getElementById('joinKey1').value;
    const k1b = document.getElementById('joinKey1_alt').value;
    const k2a = document.getElementById('joinKey2').value;
    const k2b = document.getElementById('joinKey2_alt').value;
    const adds = Array.from(document.getElementById('columnsToAdd2').selectedOptions).map(o => parseInt(o.value));

    // Helper om unieke sleutel te maken van 1 of 2 kolommen
    const makeKey = (r, a, b) => {
        let key = (r[a] || '').toString().trim().toLowerCase();
        if (b !== "" && b !== undefined) key += "___" + (r[b] || '').toString().trim().toLowerCase();
        return key;
    };

    const lookup = {};
    f2.slice(1).forEach(r => { lookup[makeKey(r, k2a, k2b)] = r; });

    const output = [ [...f1[0], ...adds.map(i => f2[0][i])] ];
    f1.slice(1).forEach(r => {
        const match = lookup[makeKey(r, k1a, k1b)];
        if (document.getElementById('onlyMatchedRows').checked && !match) return;
        output.push([...r, ...adds.map(i => match ? match[i] : "")]);
    });

    const csvContent = output.map(r => r.join(';')).join('\n');
    const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "mapped_results.csv";
    link.click();
});

// INITIALISEER
setupMappingFile('mappingFileInput1', 'mappingPreview1', 'headerRowSelector1', 1);
setupMappingFile('mappingFileInput2', 'mappingPreview2', 'headerRowSelector2', 2);