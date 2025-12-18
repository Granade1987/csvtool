/**
 * MIKE'S TOOL - HERSTELDE VERSIE
 * Focus: Zichtbaarheid van data en robuuste inlaad-logica
 */

let currentFile = null;
let allSheets = {}; 
let currentSheet = null; 
let sortState = {};
let markedRowsPerSheet = {};

// --- 1. CORE LOADING LOGIC ---

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
        const text = e.target.result.replace(/\r\n/g, "\n").trim();
        allSheets = { 'CSV Data': text };
        currentSheet = 'CSV Data';
        
        // Forceer UI update
        document.getElementById('tabsContainer').style.display = 'none';
        renderTable(text);
        showControls(true);
    };
    reader.readAsText(file, "UTF-8");
}

function loadExcel(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        allSheets = {};
        
        workbook.SheetNames.forEach(name => {
            const worksheet = workbook.Sheets[name];
            // Gebruik standaard de puntkomma voor Excel exports
            allSheets[name] = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
        });

        currentSheet = workbook.SheetNames[0];
        renderTabs();
        renderTable(allSheets[currentSheet]);
        showControls(true);
    };
    reader.readAsArrayBuffer(file);
}

function showControls(hasData) {
    const controls = document.getElementById('exportControls');
    const info = document.getElementById('infoMessage');
    const tableCont = document.getElementById('tableContainer');

    if (hasData) {
        controls.style.display = 'block';
        controls.classList.add('active');
        if (info) info.style.display = 'none';
        if (tableCont) {
            tableCont.style.display = 'block';
            tableCont.classList.add('active');
        }
    }
}

// --- 2. TABLE RENDERING (HET GEDEELTE DAT MISGING) ---

function renderTable(csvData) {
    if (!csvData) return;

    let delimiter = document.getElementById("delimiter").value;
    if (delimiter === "\\t") delimiter = "\t";

    // Splits de data in rijen en filter volledig lege regels eruit
    const rows = csvData.split("\n")
        .map(row => row.split(delimiter))
        .filter(row => row.length > 0 && row.some(cell => cell.trim() !== ""));

    const thead = document.querySelector("#csvTable thead");
    const tbody = document.querySelector("#csvTable tbody");
    
    thead.innerHTML = "";
    tbody.innerHTML = "";

    if (rows.length > 0) {
        // Maak Header
        const hTr = document.createElement("tr");
        hTr.innerHTML = `<th>Actie</th>`;
        
        rows[0].forEach((header, i) => {
            const th = document.createElement("th");
            th.innerHTML = `
                <input type="checkbox" checked data-index="${i}">
                <span style="cursor:pointer" onclick="sortTable(${i})"> ${header || 'Kolom ' + i}</span>
                <span class="sort-arrow" id="arrow-${i}"></span>
            `;
            hTr.appendChild(th);
        });
        thead.appendChild(hTr);

        // Maak Body
        rows.slice(1).forEach((row) => {
            const tr = document.createElement("tr");
            let cellsHtml = `<td><button class="del-row-btn" onclick="this.closest('tr').remove()">X</button></td>`;
            
            row.forEach(cell => {
                cellsHtml += `<td>${cell || ""}</td>`;
            });
            
            tr.innerHTML = cellsHtml;
            tr.onclick = (e) => {
                if (e.target.tagName !== "BUTTON") tr.classList.toggle("highlighted");
            };
            tbody.appendChild(tr);
        });
    }
    
    // Forceer zichtbaarheid van de container na het tekenen
    document.getElementById('tableContainer').style.display = 'block';
    document.getElementById('tableContainer').classList.add('active');
}

// --- 3. MAPPING & EXPORT UTILS ---

function renderTabs() {
    const container = document.getElementById('tabsContainer');
    container.innerHTML = '';
    container.style.display = 'flex';
    container.classList.add('active');

    Object.keys(allSheets).forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'tab-button' + (name === currentSheet ? ' active' : '');
        btn.textContent = name;
        btn.onclick = () => {
            currentSheet = name;
            renderTabs();
            renderTable(allSheets[name]);
        };
        container.appendChild(btn);
    });
}

function downloadCSV(rows, filename) {
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// --- 4. EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    // Bestand inladen
    document.getElementById('csvFileInput').onchange = (e) => loadFile(e.target.files[0]);
    
    // Delimiter switch (direct updaten)
    document.getElementById('delimiter').onchange = () => {
        if (currentSheet) renderTable(allSheets[currentSheet]);
    };

    // Export Alle Rijen
    document.getElementById('exportButton').onclick = () => {
        const del = document.getElementById("delimiter").value === "\\t" ? "\t" : document.getElementById("delimiter").value;
        const selectedIndices = Array.from(document.querySelectorAll('#csvTable thead input[type=checkbox]:checked')).map(cb => parseInt(cb.dataset.index));
        
        let exportRows = [];
        const rows = document.querySelectorAll("#csvTable tr");
        rows.forEach((tr, rowIndex) => {
            // Sla de actie-kolom (index 0) over
            const cells = Array.from(tr.cells).slice(1);
            const rowData = selectedIndices.map(idx => cells[idx] ? cells[idx].innerText.trim() : "");
            exportRows.push(rowData.join(del));
        });
        downloadCSV(exportRows, "mike_export.csv");
    };

    // Master checkbox
    document.getElementById('masterCheckbox').onchange = (e) => {
        document.querySelectorAll('#csvTable thead input[type=checkbox]').forEach(cb => cb.checked = e.target.checked);
    };

    // Tab navigatie
    document.getElementById('tabExporter').onclick = () => showTab('exporter');
    document.getElementById('tabMapping').onclick = () => showTab('mapping');
    document.getElementById('tabConverter').onclick = () => showTab('converter');
});

function showTab(name) {
    ['exporter', 'mapping', 'converter'].forEach(tab => {
        document.getElementById(tab + 'TabContent').style.display = (tab === name) ? 'block' : 'none';
        document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.toggle('active', tab === name);
    });
}