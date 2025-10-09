// pdf2excel.js
// Functies voor PDF naar Excel conversie met pdf.js en SheetJS

// Let op: Voor echte tabellen uit PDF is geavanceerde parsing nodig. Dit is een basisvoorbeeld.

async function handlePdfToExcel(file, previewDiv, downloadBtn) {
    previewDiv.innerHTML = '<em>PDF wordt verwerkt...</em>';
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.js';
    const reader = new FileReader();
    reader.onload = async function(e) {
        const typedarray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument({data: typedarray}).promise;
        let allText = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(' ');
            allText.push(pageText);
        }
        // Simpele parsing: splits op nieuwe regels en tabs
        const rows = allText.join('\n').split(/\n|\r/).map(line => line.split(/\t|\s{2,}/));
        // Preview tonen
        let html = '<table><tbody>';
        for (let i = 0; i < Math.min(10, rows.length); i++) {
            html += '<tr>' + rows[i].map(cell => `<td>${cell}</td>`).join('') + '</tr>';
        }
        html += '</tbody></table>';
        previewDiv.innerHTML = html;
        // Download knop activeren
        downloadBtn.disabled = false;
        downloadBtn.onclick = function() {
            const ws = XLSX.utils.aoa_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'PDF Data');
            XLSX.writeFile(wb, 'pdf2excel.xlsx');
        };
    };
    reader.readAsArrayBuffer(file);
}

window.handlePdfToExcel = handlePdfToExcel;
