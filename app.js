let currentFile = null;
let sortState = {}; // kolom-index → asc/desc

// Functie om CSV te parsen en tabel te vullen
function parseCSV(file) {
    currentFile = file;
    const delimiter = document.getElementById("delimiter").value;

    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        const rows = text.split("\n").map(row => row.split(delimiter));

        const tableHead = document.querySelector("#csvTable thead");
        const tableBody = document.querySelector("#csvTable tbody");

        tableHead.innerHTML = "";
        tableBody.innerHTML = "";

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

        document.getElementById("exportControls").style.display = "block";
    };
    reader.readAsText(file, "UTF-8");
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
    if (file) parseCSV(file);
});

// --- Reload button ---
document.getElementById("reloadButton").addEventListener("click", function () {
    if (currentFile) {
        parseCSV(currentFile);
    } else {
        alert("Kies eerst een bestand om te herladen.");
    }
});

// --- Delimiter change: herlaad automatisch ---
document.getElementById("delimiter").addEventListener("change", function () {
    if (currentFile) {
        parseCSV(currentFile);
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

    downloadCSV(exportRows, "export.csv");
});

// --- Export alleen gemarkeerde rijen ---
document.getElementById("exportMarkedButton").addEventListener("click", function () {
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

    downloadCSV(exportRows, "gemarkeerd_export.csv");
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
}
