let currentFile = null;
let allSheets = {}; // Bevat alle sheets/tabbladen: { sheetName: csvData }
let currentSheet = null; // Huidige actieve sheet
let sortState = {}; // kolom-index → asc/desc
let markedRowsPerSheet = {}; // Bewaar gemarkeerde rijen per sheet: { sheetName: [rowIndices] }
let emptyRowsHidden = false; // Status van lege rijen verbergen

// Hoofdfunctie om bestand te laden (CSV of Excel)
function loadFile(file) {
    currentFile = file;
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.csv')) {
        loadCSV(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        loadExcel(file);
    } else {
        alert('Ongeldig bestandstype. Kies een .csv, .xlsx of .xls bestand.');
    }
}

// --- Lege rijen verbergen/tonen ---
document.getElementById("toggleEmptyRowsButton").addEventListener("click", function () {
    const table = document.getElementById("csvTable");
    const tbody = table.tBodies[0];
    const button = this;
    
    emptyRowsHidden = !emptyRowsHidden;
    
    if (emptyRowsHidden) {
        // Verberg lege rijen
        for (let i = 0; i < tbody.rows.length; i++) {
            const row = tbody.rows[i];
            let isEmpty = true;
            
            // Check alle cellen behalve de eerste (acties kolom)
            for (let j = 1; j < row.cells.length; j++) {
                if (row.cells[j].textContent.trim() !== '') {
                    isEmpty = false;
                    break;
                }
            }
            
            if (isEmpty) {
                row.style.display = 'none';
            }
        }
        button.textContent = 'Toon Lege Rijen';
        button.style.backgroundColor = '#ffc107';
    } else {
        // Toon alle rijen
        for (let i = 0; i < tbody.rows.length; i++) {
            tbody.rows[i].style.display = '';
        }
        button.textContent = 'Verberg Lege Rijen';
        button.style.backgroundColor = '#17a2b8';
    }
});

// CSV bestand laden
function loadCSV(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        
        // CSV heeft maar één "sheet"
        allSheets = { 'CSV Data': text };
        currentSheet = 'CSV Data';
        markedRowsPerSheet = {}; // Reset marked rows
        
        // Verberg tabbladen container (CSV heeft geen meerdere sheets)
        document.getElementById('tabsContainer').classList.remove('active');
        
        // Toon de tabel
        renderTable(text);
        
        // Toon controls
        document.getElementById('exportControls').classList.add('active');
        document.getElementById('infoMessage').style.display = 'none';
    };
    reader.readAsText(file, "UTF-8");
}

// Excel bestand laden
function loadExcel(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Alle sheets ophalen en naar CSV converteren
        allSheets = {};
        markedRowsPerSheet = {}; // Reset marked rows
        workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            // Converteer naar CSV met puntkomma als delimiter
            const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
            allSheets[sheetName] = csv;
        });
        
        // Eerste sheet als standaard instellen
        currentSheet = workbook.SheetNames[0];
        
        // Tabbladen weergeven
        renderTabs();
        
        // Eerste sheet tonen
        renderTable(allSheets[currentSheet]);
        
        // Controls tonen
        document.getElementById('exportControls').classList.add('active');
        document.getElementById('infoMessage').style.display = 'none';
    };
    reader.readAsArrayBuffer(file);
}

// Tabbladen weergeven (voor Excel)
function renderTabs() {
    const tabsContainer = document.getElementById('tabsContainer');
    tabsContainer.innerHTML = '';
    tabsContainer.classList.add('active');
    
    Object.keys(allSheets).forEach(sheetName => {
        const tab = document.createElement('button');
        tab.className = 'tab-button';
        tab.textContent = sheetName;
        
        if (sheetName === currentSheet) {
            tab.classList.add('active');
        }
        
        tab.addEventListener('click', () => {
            // Bewaar huidige gemarkeerde rijen voordat we switchen
            saveMarkedRows();
            
            currentSheet = sheetName;
            
            // Update actieve tab styling
            document.querySelectorAll('.tab-button').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Toon de geselecteerde sheet
            renderTable(allSheets[sheetName]);
            
            // Herstel gemarkeerde rijen voor deze sheet
            restoreMarkedRows();
        });
        
        tabsContainer.appendChild(tab);
    });
}

// Functie om CSV te parsen en tabel te vullen
function renderTable(csvData) {
    const delimiter = document.getElementById("delimiter").value;
    const rows = csvData.split("\n").map(row => row.split(delimiter));

    const tableHead = document.querySelector("#csvTable thead");
    const tableBody = document.querySelector("#csvTable tbody");
    const tableContainer = document.getElementById("tableContainer");

    tableHead.innerHTML = "";
    tableBody.innerHTML = "";
    sortState = {}; // Reset sort state

    if (rows.length > 0) {
        // Header row
        const headerRow = document.createElement("tr");

        // Acties-kolom
        const actionTh = document.createElement("th");
        actionTh.textContent = "Acties";
        headerRow.appendChild(actionTh);

        rows[0].forEach((header, index) => {
            const th = document.createElement("th");
            th.style.resize = "horizontal";
            th.style.overflow = "hidden";

            // Checkbox voor export
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.dataset.index = index;

            // Label + sorteerpijl
            const label = document.createElement("span");
            label.textContent = " " + header;
            label.style.cursor = "pointer";

            const arrow = document.createElement("span");
            arrow.className = "sort-arrow";

            label.addEventListener("click", () => sortTable(index, arrow));

            th.appendChild(checkbox);
            th.appendChild(label);
            th.appendChild(arrow);

            headerRow.appendChild(th);
        });

        tableHead.appendChild(headerRow);

        // Body rows
        for (let i = 1; i < rows.length; i++) {
            if (rows[i].length === 1 && rows[i][0].trim() === "") continue;
            const tr = document.createElement("tr");

            // Delete button
            const actionTd = document.createElement("td");
            const delBtn = document.createElement("button");
            delBtn.textContent = "X";
            delBtn.addEventListener("click", () => {
                tr.remove();
            });
            actionTd.appendChild(delBtn);
            tr.appendChild(actionTd);

            // Klik op rij = markeren
            tr.addEventListener("click", (e) => {
                if (e.target.tagName !== "BUTTON") {
                    tr.classList.toggle("highlighted");
                }
            });

            rows[i].forEach(cell => {
                const td = document.createElement("td");
                td.textContent = cell;
                tr.appendChild(td);
            });

            tableBody.appendChild(tr);
        }
    }

    tableContainer.classList.add('active');
}

// Bewaar gemarkeerde rijen van huidige sheet
function saveMarkedRows() {
    if (!currentSheet) return;
    
    const table = document.getElementById("csvTable");
    const markedIndices = [];
    
    for (let i = 1; i < table.rows.length; i++) {
        if (table.rows[i].classList.contains('highlighted')) {
            // Bewaar de data van deze rij om later te kunnen identificeren
            const rowData = [];
            for (let j = 1; j < table.rows[i].cells.length; j++) {
                rowData.push(table.rows[i].cells[j].textContent);
            }
            markedIndices.push(rowData.join('|||')); // Gebruik unieke separator
        }
    }
    
    if (markedIndices.length > 0) {
        markedRowsPerSheet[currentSheet] = markedIndices;
    } else {
        delete markedRowsPerSheet[currentSheet];
    }
}

// Herstel gemarkeerde rijen voor huidige sheet
function restoreMarkedRows() {
    if (!currentSheet || !markedRowsPerSheet[currentSheet]) return;
    
    const table = document.getElementById("csvTable");
    const markedData = markedRowsPerSheet[currentSheet];
    
    for (let i = 1; i < table.rows.length; i++) {
        const rowData = [];
        for (let j = 1; j < table.rows[i].cells.length; j++) {
            rowData.push(table.rows[i].cells[j].textContent);
        }
        const rowKey = rowData.join('|||');
        
        if (markedData.includes(rowKey)) {
            table.rows[i].classList.add('highlighted');
        }
    }
}

// --- Sorteren ---
function sortTable(colIndex, arrowEl) {
    const table = document.getElementById("csvTable");
    const tbody = table.tBodies[0];
    const rows = Array.from(tbody.querySelectorAll("tr"));

    const direction = sortState[colIndex] === "asc" ? "desc" : "asc";
    sortState = {}; // reset andere kolommen
    sortState[colIndex] = direction;

    rows.sort((a, b) => {
        const aText = a.cells[colIndex + 1].innerText; // +1 door Acties
        const bText = b.cells[colIndex + 1].innerText;

        const aNum = parseFloat(aText.replace(",", "."));
        const bNum = parseFloat(bText.replace(",", "."));

        if (!isNaN(aNum) && !isNaN(bNum)) {
            return direction === "asc" ? aNum - bNum : bNum - aNum;
        } else {
            return direction === "asc"
                ? aText.localeCompare(bText)
                : bText.localeCompare(aText);
        }
    });

    rows.forEach(r => tbody.appendChild(r));

    // Sorteerpijlen bijwerken
    document.querySelectorAll(".sort-arrow").forEach(el => el.textContent = "");
    arrowEl.textContent = direction === "asc" ? "▲" : "▼";
}

// --- Master checkbox ---
document.getElementById("masterCheckbox").addEventListener("change", function () {
    const checkboxes = document.querySelectorAll("#csvTable thead input[type=checkbox]");
    checkboxes.forEach(cb => cb.checked = this.checked);
});

// --- File input ---
document.getElementById("csvFileInput").addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) loadFile(file);
});

// --- Reload button ---
document.getElementById("reloadButton").addEventListener("click", function () {
    if (currentFile) {
        loadFile(currentFile);
    } else {
        alert("Kies eerst een bestand om te herladen.");
    }
});

// --- Delimiter change: herlaad huidige sheet ---
document.getElementById("delimiter").addEventListener("change", function () {
    if (currentSheet && allSheets[currentSheet]) {
        renderTable(allSheets[currentSheet]);
    }
});

// --- Lege rijen verbergen/tonen ---
document.getElementById("toggleEmptyRowsButton").addEventListener("click", function () {
    console.log("Toggle button clicked!"); // Debug log
    
    const table = document.getElementById("csvTable");
    const tbody = table.querySelector("tbody");
    
    if (!tbody || tbody.rows.length === 0) {
        alert("Geen data om te verwerken.");
        return;
    }
    
    const button = document.getElementById("toggleEmptyRowsButton");
    
    emptyRowsHidden = !emptyRowsHidden;
    
    console.log("Empty rows hidden:", emptyRowsHidden); // Debug log
    
    if (emptyRowsHidden) {
        // Verberg lege rijen
        let hiddenCount = 0;
        for (let i = 0; i < tbody.rows.length; i++) {
            const row = tbody.rows[i];
            let isEmpty = true;
            
            // Check alle cellen behalve de eerste (acties kolom)
            for (let j = 1; j < row.cells.length; j++) {
                if (row.cells[j].textContent.trim() !== '') {
                    isEmpty = false;
                    break;
                }
            }
            
            if (isEmpty) {
                row.style.display = 'none';
                hiddenCount++;
            }
        }
        console.log("Hidden rows:", hiddenCount); // Debug log
        button.textContent = 'Toon Lege Rijen';
        button.style.backgroundColor = '#ffc107';
    } else {
        // Toon alle rijen
        for (let i = 0; i < tbody.rows.length; i++) {
            tbody.rows[i].style.display = '';
        }
        button.textContent = 'Verberg Lege Rijen';
        button.style.backgroundColor = '#17a2b8';
    }
});

// --- Export button (normaal) ---
document.getElementById("exportButton").addEventListener("click", function () {
    const checkboxes = document.querySelectorAll("#csvTable thead input[type=checkbox]");
    const selectedIndices = [];
    checkboxes.forEach((cb, index) => {
        if (cb.checked) selectedIndices.push(index);
    });

    if (selectedIndices.length === 0) {
        alert("Selecteer minimaal één kolom om te exporteren.");
        return;
    }

    const table = document.getElementById("csvTable");
    let exportRows = [];

    // Headers
    const headers = [];
    selectedIndices.forEach(index => {
        headers.push(table.rows[0].cells[index + 1].innerText.trim());
    });
    exportRows.push(headers.join(";"));

    // Body (alle zichtbare rijen)
    for (let i = 1; i < table.rows.length; i++) {
        const rowElement = table.rows[i];
        if (rowElement.style.display === "none") continue;

        const row = [];
        selectedIndices.forEach(index => {
            row.push(rowElement.cells[index + 1].innerText.trim());
        });

        exportRows.push(row.join(";"));
    }

    const filename = currentSheet ? `${currentSheet}_export.csv` : "export.csv";
    downloadCSV(exportRows, filename);
});

// --- Export alleen gemarkeerde rijen (uit alle tabbladen) ---
document.getElementById("exportMarkedButton").addEventListener("click", function () {
    // Bewaar eerst de huidige sheet markers
    saveMarkedRows();
    
    const checkboxes = document.querySelectorAll("#csvTable thead input[type=checkbox]");
    const selectedIndices = [];
    checkboxes.forEach((cb, index) => {
        if (cb.checked) selectedIndices.push(index);
    });

    if (selectedIndices.length === 0) {
        alert("Selecteer minimaal één kolom om te exporteren.");
        return;
    }

    // Check of er meerdere sheets zijn met gemarkeerde rijen
    const hasMultipleSheets = Object.keys(markedRowsPerSheet).length > 1;
    
    if (hasMultipleSheets) {
        // Exporteer uit alle tabbladen
        exportAllMarkedRows(selectedIndices);
    } else {
        // Exporteer alleen uit huidige tabblad (oude functionaliteit)
        exportCurrentSheetMarkedRows(selectedIndices);
    }
});

// Exporteer gemarkeerde rijen uit huidige sheet
function exportCurrentSheetMarkedRows(selectedIndices) {
    const table = document.getElementById("csvTable");
    let exportRows = [];

    // Headers
    const headers = [];
    selectedIndices.forEach(index => {
        headers.push(table.rows[0].cells[index + 1].innerText.trim());
    });
    exportRows.push(headers.join(";"));

    // Alleen gemarkeerde rijen meenemen
    let foundMarked = false;
    for (let i = 1; i < table.rows.length; i++) {
        const rowElement = table.rows[i];
        if (!rowElement.classList.contains("highlighted")) continue;

        foundMarked = true;
        const row = [];
        selectedIndices.forEach(index => {
            row.push(rowElement.cells[index + 1].innerText.trim());
        });
        exportRows.push(row.join(";"));
    }

    if (!foundMarked) {
        alert("Geen gemarkeerde rijen gevonden om te exporteren.");
        return;
    }

    const filename = currentSheet ? `${currentSheet}_gemarkeerd.csv` : "gemarkeerd_export.csv";
    downloadCSV(exportRows, filename);
}

// Exporteer gemarkeerde rijen uit alle sheets
function exportAllMarkedRows(selectedIndices) {
    if (Object.keys(markedRowsPerSheet).length === 0) {
        alert("Geen gemarkeerde rijen gevonden in alle tabbladen.");
        return;
    }
    
    let allExportRows = [];
    
    // Loop door alle sheets met gemarkeerde rijen
    Object.keys(markedRowsPerSheet).forEach((sheetName, sheetIndex) => {
        const csvData = allSheets[sheetName];
        const delimiter = document.getElementById("delimiter").value;
        const rows = csvData.split("\n").map(row => row.split(delimiter));
        
        // Voeg sheet naam toe als sectie header
        if (sheetIndex > 0) {
            allExportRows.push(""); // Lege regel tussen sheets
        }
        allExportRows.push(`=== ${sheetName} ===`);
        
        // Headers toevoegen
        const headers = [];
        selectedIndices.forEach(index => {
            if (rows[0] && rows[0][index]) {
                headers.push(rows[0][index].trim());
            }
        });
        allExportRows.push(headers.join(";"));
        
        // Gemarkeerde rijen toevoegen
        const markedData = markedRowsPerSheet[sheetName];
        for (let i = 1; i < rows.length; i++) {
            if (rows[i].length === 1 && rows[i][0].trim() === "") continue;
            
            const rowKey = rows[i].join('|||');
            if (markedData.includes(rowKey)) {
                const row = [];
                selectedIndices.forEach(index => {
                    if (rows[i][index] !== undefined) {
                        row.push(rows[i][index].trim());
                    }
                });
                allExportRows.push(row.join(";"));
            }
        }
    });
    
    downloadCSV(allExportRows, "gemarkeerde_rijen_alle_tabs.csv");
}

// --- Export alle gemarkeerde rijen uit ALLE tabbladen ---
document.getElementById("exportAllMarkedButton").addEventListener("click", function () {
    // Bewaar eerst de huidige sheet markers
    saveMarkedRows();
    
    // Controleer of er überhaupt gemarkeerde rijen zijn
    if (Object.keys(markedRowsPerSheet).length === 0) {
        alert("Geen gemarkeerde rijen gevonden in alle tabbladen.");
        return;
    }
    
    // Vraag welke kolommen geëxporteerd moeten worden (van huidige sheet)
    const checkboxes = document.querySelectorAll("#csvTable thead input[type=checkbox]");
    const selectedIndices = [];
    checkboxes.forEach((cb, index) => {
        if (cb.checked) selectedIndices.push(index);
    });
    
    if (selectedIndices.length === 0) {
        alert("Selecteer minimaal één kolom om te exporteren.");
        return;
    }
    
    let allExportRows = [];
    
    // Loop door alle sheets met gemarkeerde rijen
    Object.keys(markedRowsPerSheet).forEach(sheetName => {
        const csvData = allSheets[sheetName];
        const delimiter = document.getElementById("delimiter").value;
        const rows = csvData.split("\n").map(row => row.split(delimiter));
        
        // Voeg sheet naam toe als header
        allExportRows.push(`\n=== ${sheetName} ===`);
        
        // Headers toevoegen
        const headers = [];
        selectedIndices.forEach(index => {
            if (rows[0] && rows[0][index]) {
                headers.push(rows[0][index].trim());
            }
        });
        allExportRows.push(headers.join(";"));
        
        // Gemarkeerde rijen toevoegen
        const markedData = markedRowsPerSheet[sheetName];
        for (let i = 1; i < rows.length; i++) {
            if (rows[i].length === 1 && rows[i][0].trim() === "") continue;
            
            const rowKey = rows[i].join('|||');
            if (markedData.includes(rowKey)) {
                const row = [];
                selectedIndices.forEach(index => {
                    if (rows[i][index] !== undefined) {
                        row.push(rows[i][index].trim());
                    }
                });
                allExportRows.push(row.join(";"));
            }
        }
    });
    
    if (allExportRows.length === 0) {
        alert("Geen gemarkeerde rijen gevonden om te exporteren.");
        return;
    }
    
    downloadCSV(allExportRows, "alle_gemarkeerde_rijen_export.csv");
});

// --- Helper functie voor CSV download ---
function downloadCSV(rows, filename) {
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
