let currentFile = null;
let allSheets = {}; // Bevat alle sheets/tabbladen: { sheetName: csvData }
let currentSheet = null; // Huidige actieve sheet
let sortState = {}; // kolom-index → asc/desc
let markedRowsPerSheet = {}; // Bewaar gemarkeerde rijen per sheet: { sheetName: [rowKeys] }
let emptyRowsHidden = false; // Houd bij of lege rijen verborgen zijn

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

// CSV bestand laden
function loadCSV(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result.replace(/\r\n/g, "\n").trimEnd();

        // CSV heeft maar één "sheet"
        allSheets = { 'CSV Data': text };
        currentSheet = 'CSV Data';
        markedRowsPerSheet = {}; // Reset marked rows

        // Verberg tabbladen container (CSV heeft geen meerdere sheets)
        const tabs = document.getElementById('tabsContainer');
        if (tabs) tabs.classList.remove('active');

        // Toon de tabel
        renderTable(text);

        // Toon controls
        const exportControls = document.getElementById('exportControls');
        const infoMessage = document.getElementById('infoMessage');
        if (exportControls) exportControls.classList.add('active');
        if (infoMessage) infoMessage.style.display = 'none';

        // Herstel eventuele gemarkeerde rijen voor deze sheet
        restoreMarkedRows();
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
            // Converteer naar CSV met puntkomma als delimiter (standaard)
            const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
            allSheets[sheetName] = csv.replace(/\r\n/g, "\n").trimEnd();
        });

        // Eerste sheet als standaard instellen
        currentSheet = workbook.SheetNames[0];

        // Tabbladen weergeven
        renderTabs();

        // Eerste sheet tonen
        renderTable(allSheets[currentSheet]);

        // Controls tonen
        const exportControls = document.getElementById('exportControls');
        const infoMessage = document.getElementById('infoMessage');
        if (exportControls) exportControls.classList.add('active');
        if (infoMessage) infoMessage.style.display = 'none';

        // Herstel gemarkeerde rijen indien aanwezig
        restoreMarkedRows();
    };
    reader.readAsArrayBuffer(file);
}

// Tabbladen weergeven (voor Excel)
function renderTabs() {
    const tabsContainer = document.getElementById('tabsContainer');
    if (!tabsContainer) return;

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
    let delimiter = document.getElementById("delimiter") ? document.getElementById("delimiter").value : ";";
    if (delimiter === "\\t") delimiter = "\t"; // Als de value literal "\\t" is

    // Guard voor lege data
    if (!csvData) {
        document.getElementById('tableContainer')?.classList.remove('active');
        return;
    }

    const rows = csvData.split("\n").map(row => row.split(delimiter));

    const tableHead = document.querySelector("#csvTable thead");
    const tableBody = document.querySelector("#csvTable tbody");
    const tableContainer = document.getElementById("tableContainer");

    if (!tableHead || !tableBody || !tableContainer) return;

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
            label.textContent = " " + (header || "");
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
            // Skip volledig lege regel
            if (rows[i].length === 1 && rows[i][0].trim() === "") continue;

            const tr = document.createElement("tr");

            // Delete button
            const actionTd = document.createElement("td");
            const delBtn = document.createElement("button");
            delBtn.textContent = "X";
            delBtn.addEventListener("click", (ev) => {
                ev.stopPropagation();
                tr.remove();
                // Update opgeslagen markers na verwijderen
                saveMarkedRows();
            });
            actionTd.appendChild(delBtn);
            tr.appendChild(actionTd);

            // Klik op rij = markeren (negeer button clicks)
            tr.addEventListener("click", (e) => {
                if (e.target.tagName !== "BUTTON") {
                    tr.classList.toggle("highlighted");
                }
            });

            rows[i].forEach(cell => {
                const td = document.createElement("td");
                td.textContent = cell ?? "";
                tr.appendChild(td);
            });

            tableBody.appendChild(tr);
        }
    }

    tableContainer.classList.add('active');
}

// Haal row key (unieke representatie) uit een <tr>
function getRowKeyFromTr(row) {
    const parts = [];
    for (let j = 1; j < row.cells.length; j++) {
        parts.push(row.cells[j].textContent);
    }
    return parts.join('|||');
}

// Sla gemarkeerde rijen op voor huidige sheet
function saveMarkedRows() {
    if (!currentSheet) return;
    const table = document.getElementById("csvTable");
    if (!table) return;

    const marked = [];
    for (let i = 1; i < table.rows.length; i++) {
        const tr = table.rows[i];
        if (tr.classList && tr.classList.contains('highlighted')) {
            marked.push(getRowKeyFromTr(tr));
        }
    }

    if (marked.length > 0) {
        // Unieke waarden bewaren
        markedRowsPerSheet[currentSheet] = Array.from(new Set(marked));
    } else {
        delete markedRowsPerSheet[currentSheet];
    }
}

// Herstel gemarkeerde rijen voor huidige sheet
function restoreMarkedRows() {
    if (!currentSheet || !markedRowsPerSheet[currentSheet]) return;

    const table = document.getElementById("csvTable");
    if (!table) return;

    const markedData = markedRowsPerSheet[currentSheet];

    for (let i = 1; i < table.rows.length; i++) {
        const tr = table.rows[i];
        const rowKey = getRowKeyFromTr(tr);
        if (markedData.includes(rowKey)) {
            tr.classList.add('highlighted');
        }
    }
}

// Sorteren functie (1 definitie, consistent)
function sortTable(colIndex, arrowEl) {
    const table = document.getElementById("csvTable");
    if (!table) return;

    const tbody = table.tBodies[0];
    if (!tbody) return;

    // Bewaar gemarkeerde rijen vóór sorteren
    saveMarkedRows();

    const rows = Array.from(tbody.querySelectorAll("tr"));

    const direction = sortState[colIndex] === "asc" ? "desc" : "asc";
    sortState = {}; // reset andere kolommen
    sortState[colIndex] = direction;

    rows.sort((a, b) => {
        const aCell = a.cells[colIndex + 1]; // +1 door Acties-kolom
        const bCell = b.cells[colIndex + 1];
        const aText = aCell ? aCell.innerText.trim() : "";
        const bText = bCell ? bCell.innerText.trim() : "";

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
    if (arrowEl) arrowEl.textContent = direction === "asc" ? "▲" : "▼";

    // Herstel gemarkeerde rijen na sorteren
    restoreMarkedRows();
}

// --- Master checkbox ---
const masterCheckboxEl = document.getElementById("masterCheckbox");
if (masterCheckboxEl) {
    masterCheckboxEl.addEventListener("change", function () {
        const checkboxes = document.querySelectorAll("#csvTable thead input[type=checkbox]");
        checkboxes.forEach(cb => cb.checked = this.checked);
    });
}

// --- File input ---
const fileInput = document.getElementById("csvFileInput");
if (fileInput) {
    fileInput.addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (file) loadFile(file);
    });
}

// --- Reload button ---
const reloadButton = document.getElementById("reloadButton");
if (reloadButton) {
    reloadButton.addEventListener("click", function () {
        if (currentFile) {
            loadFile(currentFile);
        } else {
            alert("Kies eerst een bestand om te herladen.");
        }
    });
}

// --- Delimiter change: herlaad huidige sheet ---
const delimiterEl = document.getElementById("delimiter");
if (delimiterEl) {
    delimiterEl.addEventListener("change", function () {
        if (currentSheet && allSheets[currentSheet]) {
            renderTable(allSheets[currentSheet]);
            // Nadat we opnieuw hebben gerenderd: herstel markers
            restoreMarkedRows();
        }
    });
}

// --- (Toggle empty rows) - removed visible handler to match UI. If you later add a visible button, re-enable with a guard. ---
// Het element 'toggleEmptyRowsButton' is in de HTML als hidden placeholder om compatibiliteit te bewaren.

// --- Export button (normaal) ---
const exportBtn = document.getElementById("exportButton");
if (exportBtn) {
    exportBtn.addEventListener("click", function () {
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

        // Bepaal delimiter voor export (gebruik geselecteerde delimiter)
        let exportDelimiter = document.getElementById("delimiter") ? document.getElementById("delimiter").value : ";";
        if (exportDelimiter === "\\t") exportDelimiter = "\t";

        // Headers
        const headers = [];
        if (table && table.rows.length > 0) {
            selectedIndices.forEach(index => {
                const headerText = table.rows[0].cells[index + 1].innerText.trim();
                headers.push(headerText);
            });
        }
        exportRows.push(headers.join(exportDelimiter));

        // Body (alle zichtbare rijen)
        if (table) {
            for (let i = 1; i < table.rows.length; i++) {
                const rowElement = table.rows[i];
                if (rowElement.style.display === "none") continue;

                const row = [];
                selectedIndices.forEach(index => {
                    row.push((rowElement.cells[index + 1] && rowElement.cells[index + 1].innerText.trim()) || "");
                });

                exportRows.push(row.join(exportDelimiter));
            }
        }

        const filename = currentSheet ? `${sanitizeFilename(currentSheet)}_export.csv` : "export.csv";
        downloadCSV(exportRows, filename);
    });
}

// --- Export alleen gemarkeerde rijen (uit alle tabbladen of huidig) ---
const exportMarkedBtn = document.getElementById("exportMarkedButton");
if (exportMarkedBtn) {
    exportMarkedBtn.addEventListener("click", function () {
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
            // Exporteer alleen uit huidige tabblad
            exportCurrentSheetMarkedRows(selectedIndices);
        }
    });
}

// Exporteer gemarkeerde rijen uit huidige sheet
function exportCurrentSheetMarkedRows(selectedIndices) {
    const table = document.getElementById("csvTable");
    if (!table) return;

    let exportRows = [];
    let exportDelimiter = document.getElementById("delimiter") ? document.getElementById("delimiter").value : ";";
    if (exportDelimiter === "\\t") exportDelimiter = "\t";

    // Headers
    const headers = [];
    selectedIndices.forEach(index => {
        headers.push(table.rows[0].cells[index + 1].innerText.trim());
    });
    exportRows.push(headers.join(exportDelimiter));

    // Alleen gemarkeerde rijen meenemen
    let foundMarked = false;
    for (let i = 1; i < table.rows.length; i++) {
        const rowElement = table.rows[i];
        if (!rowElement.classList.contains("highlighted")) continue;

        foundMarked = true;
        const row = [];
        selectedIndices.forEach(index => {
            row.push((rowElement.cells[index + 1] && rowElement.cells[index + 1].innerText.trim()) || "");
        });
        exportRows.push(row.join(exportDelimiter));
    }

    if (!foundMarked) {
        alert("Geen gemarkeerde rijen gevonden om te exporteren.");
        return;
    }

    const filename = currentSheet ? `${sanitizeFilename(currentSheet)}_gemarkeerd.csv` : "gemarkeerd_export.csv";
    downloadCSV(exportRows, filename);
}

// Exporteer gemarkeerde rijen uit alle sheets
function exportAllMarkedRows(selectedIndices) {
    if (Object.keys(markedRowsPerSheet).length === 0) {
        alert("Geen gemarkeerde rijen gevonden in alle tabbladen.");
        return;
    }

    let allExportRows = [];
    let exportDelimiter = document.getElementById("delimiter") ? document.getElementById("delimiter").value : ";";
    if (exportDelimiter === "\\t") exportDelimiter = "\t";

    // Loop door alle sheets met gemarkeerde rijen
    let firstSheet = true;
    Object.keys(markedRowsPerSheet).forEach((sheetName) => {
        const csvData = allSheets[sheetName];
        const rows = csvData.split("\n").map(row => row.split(exportDelimiter));

        // Voeg sheet naam toe als sectie header
        if (!firstSheet) {
            allExportRows.push(""); // Lege regel tussen sheets
        }
        firstSheet = false;
        allExportRows.push(`=== ${sheetName} ===`);

        // Headers toevoegen (indien aanwezig)
        const headers = [];
        selectedIndices.forEach(index => {
            if (rows[0] && rows[0][index]) {
                headers.push(rows[0][index].trim());
            } else {
                headers.push("");
            }
        });
        allExportRows.push(headers.join(exportDelimiter));

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
                    } else {
                        row.push("");
                    }
                });
                allExportRows.push(row.join(exportDelimiter));
            }
        }
    });

    downloadCSV(allExportRows, "gemarkeerde_rijen_alle_tabs.csv");
}

// --- Optionele handler voor exportAllMarkedButton (UI kan deze knop missen) ---
const exportAllBtn = document.getElementById("exportAllMarkedButton");
if (exportAllBtn) {
    exportAllBtn.addEventListener("click", function () {
        // Bewaar eerst de huidige sheet markers
        saveMarkedRows();

        if (Object.keys(markedRowsPerSheet).length === 0) {
            alert("Geen gemarkeerde rijen gevonden in alle tabbladen.");
            return;
        }

        const checkboxes = document.querySelectorAll("#csvTable thead input[type=checkbox]");
        const selectedIndices = [];
        checkboxes.forEach((cb, index) => {
            if (cb.checked) selectedIndices.push(index);
        });

        if (selectedIndices.length === 0) {
            alert("Selecteer minimaal één kolom om te exporteren.");
            return;
        }

        // Hergebruik de bestaande exportAllMarkedRows
        exportAllMarkedRows(selectedIndices);
    });
}

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

// Simpele sanitization voor bestandsnaam
function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|]/g, '_');
}
