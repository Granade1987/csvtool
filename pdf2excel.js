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
        
        // Preview tonen met styling
        let html = '<div style="margin-bottom: 16px; padding: 12px; background: #e8f4f8; border-radius: 6px;">';
        html += '<strong>Preview van geëxtraheerde data:</strong> ';
        html += `${rows.length} rijen gevonden`;
        html += '</div>';
        html += '<div style="max-height: 500px; overflow: auto; border: 1px solid #e0e0e0; border-radius: 6px;">';
        html += '<table style="width: 100%; border-collapse: collapse;"><thead><tr>';
        
        // Eerste rij als header
        if (rows.length > 0) {
            rows[0].forEach(cell => {
                html += `<th style="background: #f8f9fa; padding: 10px; border-bottom: 2px solid #dee2e6; font-weight: 600; position: sticky; top: 0; z-index: 10;">${cell || ''}</th>`;
            });
            html += '</tr></thead><tbody>';
            
            // Rest van de rijen
            for (let i = 1; i < rows.length; i++) {
                html += '<tr style="border-bottom: 1px solid #ecf0f1;">';
                rows[i].forEach(cell => {
                    html += `<td style="padding: 10px; font-size: 13px;">${cell || ''}</td>`;
                });
                html += '</tr>';
            }
        }
        html += '</tbody></table></div>';
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