// pdf2excel.js
// Functies voor PDF naar Excel conversie met pdf.js en SheetJS

// Visuele preview van de PDF tonen
async function showPdfVisualPreview(file, previewDiv, containerDiv, pageInfoDiv) {
    console.log('showPdfVisualPreview called');
    
    if (!previewDiv || !containerDiv) {
        console.error('Preview elements not found');
        return;
    }
    
    previewDiv.innerHTML = '<em>PDF wordt geladen...</em>';
    containerDiv.style.display = 'block';
    
    try {
        // Wacht even zodat de PDF.js library zeker geladen is
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
        console.log('pdfjsLib:', pdfjsLib);
        
        if (!pdfjsLib) {
            throw new Error('PDF.js library niet geladen. Herlaad de pagina en probeer opnieuw.');
        }
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        const reader = new FileReader();
        
        reader.onerror = function() {
            previewDiv.innerHTML = '<div style="color: #e74c3c; padding: 12px; background: #fadbd8; border-radius: 6px;">Fout bij het lezen van het bestand.</div>';
        };
        
        reader.onload = async function(e) {
            try {
                const typedarray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument({data: typedarray}).promise;
                
                pageInfoDiv.textContent = `${pdf.numPages} pagina${pdf.numPages !== 1 ? "'s" : ''} gevonden`;
                
                previewDiv.innerHTML = '';
                
                // Render eerste 3 pagina's als preview
                const pagesToRender = Math.min(3, pdf.numPages);
                
                for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const scale = 1.5;
                    const viewport = page.getViewport({ scale: scale });
                    
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    canvas.style.display = 'block';
                    canvas.style.margin = '10px auto';
                    canvas.style.border = '1px solid #ddd';
                    canvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    
                    const renderContext = {
                        canvasContext: context,
                        viewport: viewport
                    };
                    
                    await page.render(renderContext).promise;
                    
                    const pageLabel = document.createElement('div');
                    pageLabel.textContent = `Pagina ${pageNum}`;
                    pageLabel.style.textAlign = 'center';
                    pageLabel.style.marginTop = '10px';
                    pageLabel.style.fontWeight = '600';
                    pageLabel.style.color = '#7f8c8d';
                    
                    previewDiv.appendChild(pageLabel);
                    previewDiv.appendChild(canvas);
                }
                
                if (pdf.numPages > 3) {
                    const morePages = document.createElement('div');
                    morePages.textContent = `... en nog ${pdf.numPages - 3} pagina's`;
                    morePages.style.textAlign = 'center';
                    morePages.style.margin = '20px';
                    morePages.style.color = '#7f8c8d';
                    morePages.style.fontStyle = 'italic';
                    previewDiv.appendChild(morePages);
                }
                
            } catch (err) {
                console.error('PDF preview error:', err);
                previewDiv.innerHTML = '<div style="color: #e74c3c; padding: 12px; background: #fadbd8; border-radius: 6px;"><strong>Fout bij het laden van PDF preview:</strong><br>' + err.message + '</div>';
            }
        };
        
        reader.readAsArrayBuffer(file);
        
    } catch (err) {
        console.error('PDF.js initialization error:', err);
        previewDiv.innerHTML = '<div style="color: #e74c3c; padding: 12px; background: #fadbd8; border-radius: 6px;"><strong>Fout:</strong><br>' + err.message + '</div>';
    }
}

// Converteer PDF naar Excel data
async function handlePdfToExcel(file, previewDiv, downloadBtn) {
    previewDiv.innerHTML = '<em>PDF wordt verwerkt...</em>';
    
    try {
        // Check of pdf.js beschikbaar is
        const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
        if (!pdfjsLib) {
            throw new Error('PDF.js library niet geladen. Herlaad de pagina en probeer opnieuw.');
        }
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        const reader = new FileReader();
        
        reader.onerror = function() {
            previewDiv.innerHTML = '<div style="color: #e74c3c; padding: 12px; background: #fadbd8; border-radius: 6px;">Fout bij het lezen van het bestand. Probeer een ander PDF bestand.</div>';
            downloadBtn.disabled = true;
        };
        
        reader.onload = async function(e) {
            try {
                const typedarray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument({data: typedarray}).promise;
                
                let allText = [];
                
                // Verwerk elke pagina
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    
                    // Sorteer items op Y en X positie voor betere structuur
                    const items = content.items.sort((a, b) => {
                        const yDiff = Math.abs(a.transform[5] - b.transform[5]);
                        if (yDiff > 5) {
                            return b.transform[5] - a.transform[5]; // Sort by Y (top to bottom)
                        }
                        return a.transform[4] - b.transform[4]; // Sort by X (left to right)
                    });
                    
                    // Groepeer items per regel
                    let currentY = null;
                    let currentLine = [];
                    let lines = [];
                    
                    items.forEach(item => {
                        const y = Math.round(item.transform[5]);
                        
                        if (currentY === null || Math.abs(y - currentY) > 5) {
                            if (currentLine.length > 0) {
                                lines.push(currentLine.join(' '));
                            }
                            currentLine = [item.str];
                            currentY = y;
                        } else {
                            currentLine.push(item.str);
                        }
                    });
                    
                    if (currentLine.length > 0) {
                        lines.push(currentLine.join(' '));
                    }
                    
                    allText.push(...lines);
                }
                
                if (allText.length === 0) {
                    previewDiv.innerHTML = '<div style="color: #e67e22; padding: 12px; background: #fdebd0; border-radius: 6px;">Geen tekst gevonden in de PDF. Het bestand is mogelijk leeg of bevat alleen afbeeldingen.</div>';
                    downloadBtn.disabled = true;
                    return;
                }
                
                // Probeer te detecteren of er tabs of meerdere spaties zijn voor kolommen
                const rows = allText.map(line => {
                    // Split op tab of meerdere spaties (2 of meer)
                    if (line.includes('\t')) {
                        return line.split('\t');
                    } else {
                        // Split op 2 of meer spaties
                        return line.split(/\s{2,}/).filter(cell => cell.trim() !== '');
                    }
                }).filter(row => row.length > 0);
                
                if (rows.length === 0) {
                    previewDiv.innerHTML = '<div style="color: #e67e22; padding: 12px; background: #fdebd0; border-radius: 6px;">Kon geen tabelstructuur detecteren in de PDF.</div>';
                    downloadBtn.disabled = true;
                    return;
                }
                
                // Preview tonen met styling
                let html = '<div style="margin-bottom: 16px; padding: 12px; background: #e8f4f8; border-radius: 6px;">';
                html += '<strong>Preview van geëxtraheerde data:</strong> ';
                html += `${rows.length} rijen gevonden, `;
                html += `${rows[0] ? rows[0].length : 0} kolommen gedetecteerd`;
                html += '</div>';
                html += '<div style="max-height: 500px; overflow: auto; border: 1px solid #e0e0e0; border-radius: 6px;">';
                html += '<table style="width: 100%; border-collapse: collapse;"><thead><tr>';
                
                // Eerste rij als header
                if (rows.length > 0 && rows[0]) {
                    rows[0].forEach(cell => {
                        html += `<th style="background: #f8f9fa; padding: 10px; border-bottom: 2px solid #dee2e6; font-weight: 600; position: sticky; top: 0; z-index: 10; white-space: nowrap;">${cell || ''}</th>`;
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
                    try {
                        const ws = XLSX.utils.aoa_to_sheet(rows);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, 'PDF Data');
                        XLSX.writeFile(wb, 'pdf2excel.xlsx');
                    } catch (err) {
                        alert('Fout bij het maken van Excel bestand: ' + err.message);
                    }
                };
                
            } catch (err) {
                console.error('PDF parsing error:', err);
                previewDiv.innerHTML = '<div style="color: #e74c3c; padding: 12px; background: #fadbd8; border-radius: 6px;"><strong>Fout bij het verwerken van de PDF:</strong><br>' + err.message + '</div>';
                downloadBtn.disabled = true;
            }
        };
        
        reader.readAsArrayBuffer(file);
        
    } catch (err) {
        console.error('PDF.js initialization error:', err);
        previewDiv.innerHTML = '<div style="color: #e74c3c; padding: 12px; background: #fadbd8; border-radius: 6px;"><strong>Fout:</strong><br>' + err.message + '</div>';
        downloadBtn.disabled = true;
    }
}

window.showPdfVisualPreview = showPdfVisualPreview;
window.handlePdfToExcel = handlePdfToExcel;