// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.7.107/pdf.worker.min.js';

// Debug Logging
function logDebug(message) {
    console.log(`[PDF Compressor] ${message}`);
}

logDebug('Script loaded');

document.addEventListener('DOMContentLoaded', function() {
    logDebug('DOM Content Loaded');

    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const uploadForm = document.getElementById('upload-form');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('status-text');
    const resultsContainer = document.getElementById('results-container');
    const uploadContainer = document.getElementById('upload-container');
    const downloadBtn = document.getElementById('download-btn');
    const newFileBtn = document.getElementById('new-file-btn');
    const fileNameSpan = document.getElementById('file-name');
    const originalSizeSpan = document.getElementById('original-size');
    const compressedSizeSpan = document.getElementById('compressed-size');
    const reductionPercentSpan = document.getElementById('reduction-percent');
    const compressionRatioSpan = document.getElementById('compression-ratio');
    const errorContainer = document.getElementById('error-container');
    const errorText = document.getElementById('error-text');

    let currentFileName = null;
    let originalPdfBytes = null;
    let compressedPdfBytes = null;

    // Prevent default behavior for drag events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop area when dragging file over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropArea.classList.add('highlight');
    }

    function unhighlight() {
        dropArea.classList.remove('highlight');
    }

    // Handle dropped files
    dropArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelected();
        }
    }

    // Handle file selection from file input
    fileInput.addEventListener('change', handleFileSelected);

    function handleFileSelected() {
        if (fileInput.files.length === 0) return;
        
        const file = fileInput.files[0];
        
        // Check if it's a PDF
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            showError('Please select a PDF file');
            fileInput.value = '';
            return;
        }
        
        // Check file size (100MB max)
        if (file.size > 100 * 1024 * 1024) {
            showError('File size exceeds the 100MB limit');
            fileInput.value = '';
            return;
        }
        
        // Hide any previous errors
        hideError();
        
        // Show the file name
        fileNameSpan.textContent = file.name;
        currentFileName = file.name;
        
        // Show file info and prepare for compression
        handleFileUpload(file);
    }

    // Process the selected file
    async function handleFileUpload(file) {
        try {
            // Show progress container
            progressContainer.classList.remove('d-none');
            uploadContainer.classList.add('d-none');
            resultsContainer.classList.add('d-none');
            
            // Update status
            statusText.textContent = 'Loading file...';
            progressBar.style.width = '25%';
            progressBar.setAttribute('aria-valuenow', 25);
            
            // Read file as array buffer
            const arrayBuffer = await readFileAsArrayBuffer(file);
            originalPdfBytes = new Uint8Array(arrayBuffer);
            
            // Calculate original size
            const originalSize = file.size / (1024 * 1024); // Size in MB
            originalSizeSpan.textContent = originalSize.toFixed(2);
            
            // Update progress
            statusText.textContent = 'Starting compression...';
            progressBar.style.width = '50%';
            progressBar.setAttribute('aria-valuenow', 50);
            
            // Start compression immediately
            startCompression();
        } catch (error) {
            showError('Error loading PDF: ' + error.message);
            resetUploadForm();
        }
    }
    
    // Function to start compression process
    async function startCompression() {
        if (!originalPdfBytes) {
            logDebug('No PDF bytes found to compress');
            showError('No PDF file loaded');
            resetUploadForm();
            return;
        }
        
        // Update status
        statusText.textContent = 'Compressing...';
        progressBar.style.width = '75%';
        progressBar.setAttribute('aria-valuenow', 75);
        
        try {
            logDebug('Starting PDF compression process');
            
            // Compress the PDF - always returns at least the original bytes
            compressedPdfBytes = await compressPdf(originalPdfBytes);
            
            // Calculate sizes
            const originalSize = originalPdfBytes.length / (1024 * 1024); // Size in MB
            const compressedSize = compressedPdfBytes.length / (1024 * 1024); // Size in MB
            const percentReduction = ((1 - (compressedSize / originalSize)) * 100).toFixed(2);
            const compressionRatio = (originalSize / Math.max(compressedSize, 0.01)).toFixed(2);
            
            logDebug(`Compression results: 
                Original size: ${originalSize.toFixed(2)} MB
                Compressed size: ${compressedSize.toFixed(2)} MB
                Reduction: ${percentReduction}%
                Ratio: ${compressionRatio}
            `);
            
            // Update UI
            originalSizeSpan.textContent = originalSize.toFixed(2);
            compressedSizeSpan.textContent = compressedSize.toFixed(2);
            reductionPercentSpan.textContent = percentReduction;
            compressionRatioSpan.textContent = compressionRatio;
            
            // Update progress
            statusText.textContent = 'Compression complete!';
            progressBar.style.width = '100%';
            progressBar.setAttribute('aria-valuenow', 100);
            
            logDebug('Showing compression results');
            
            // Show results container and download button
            setTimeout(() => {
                progressContainer.classList.add('d-none');
                resultsContainer.classList.remove('d-none');
                downloadBtn.classList.remove('d-none');
                newFileBtn.classList.remove('d-none');
            }, 1000);
        } catch (error) {
            logDebug(`Error during compression: ${error.message}`);
            console.error('Compression error:', error);
            
            // Even if compression fails, we can still offer the original file
            compressedPdfBytes = originalPdfBytes;
            
            // Calculate sizes (no compression)
            const size = originalPdfBytes.length / (1024 * 1024); // Size in MB
            
            // Update UI to show no compression occurred
            originalSizeSpan.textContent = size.toFixed(2);
            compressedSizeSpan.textContent = size.toFixed(2);
            reductionPercentSpan.textContent = "0";
            compressionRatioSpan.textContent = "1.00";
            
            // Update progress
            statusText.textContent = 'Compression skipped (error occurred)';
            progressBar.style.width = '100%';
            progressBar.setAttribute('aria-valuenow', 100);
            
            // Show results anyway so user can download the original file
            setTimeout(() => {
                progressContainer.classList.add('d-none');
                resultsContainer.classList.remove('d-none');
                downloadBtn.classList.remove('d-none');
                newFileBtn.classList.remove('d-none');
            }, 1000);
        }
    }

    // Read file as ArrayBuffer
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // We've removed the compress button and its event listener
    // Compression now starts automatically after file upload

    // Client-side PDF compression - simplified version
    async function compressPdf(pdfBytes) {
        try {
            logDebug('Starting PDF compression');
            statusText.textContent = 'Compressing PDF...';
            
            try {
                // Load the PDF document using pdf-lib
                logDebug('Loading PDF document');
                const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
                
                // Get all pages
                const pages = pdfDoc.getPages();
                logDebug(`PDF has ${pages.length} pages`);
                
                statusText.textContent = `Optimizing ${pages.length} page(s)...`;
                
                // Apply basic compression options
                logDebug('Applying compression settings');
                const compressedPdfBytes = await pdfDoc.save({
                    useObjectStreams: true,
                    addDefaultPage: false,
                });
                
                // Check if compression was successful
                const originalSize = pdfBytes.length / 1024 / 1024;
                const compressedSize = compressedPdfBytes.length / 1024 / 1024;
                logDebug(`Original size: ${originalSize.toFixed(2)} MB`);
                logDebug(`Compressed size: ${compressedSize.toFixed(2)} MB`);
                
                // If compression actually made the file bigger, return original
                if (compressedPdfBytes.length >= pdfBytes.length) {
                    logDebug('Compression did not reduce size, returning original');
                    return pdfBytes;
                }
                
                logDebug('Compression successful');
                return compressedPdfBytes;
            } catch (e) {
                logDebug(`Error during compression: ${e.message}`);
                // If any error occurs, return the original file
                return pdfBytes;
            }
        } catch (error) {
            console.error('Error during compression:', error);
            // Always return something to avoid breaking the app
            return pdfBytes;
        }
    }

    // Download the compressed file
    downloadBtn.addEventListener('click', function() {
        if (!compressedPdfBytes) return;
        
        // Create blob from array buffer
        const blob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
        
        // Create download URL
        const url = URL.createObjectURL(blob);
        
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = currentFileName.replace('.pdf', '_compressed.pdf');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
    });

    // Handle new file button
    newFileBtn.addEventListener('click', function() {
        resetUploadForm();
    });

    // Reset the upload form
    function resetUploadForm() {
        fileInput.value = '';
        currentFileName = null;
        originalPdfBytes = null;
        compressedPdfBytes = null;
        
        progressContainer.classList.add('d-none');
        resultsContainer.classList.add('d-none');
        uploadContainer.classList.remove('d-none');
        
        downloadBtn.classList.add('d-none');
        newFileBtn.classList.add('d-none');
        
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', 0);
        statusText.textContent = '';
    }

    // Show error message
    function showError(message) {
        errorText.textContent = message;
        errorContainer.classList.remove('d-none');
    }

    // Hide error message
    function hideError() {
        errorContainer.classList.add('d-none');
    }
});

// Advanced Image Compression Function
// Note: Client-side PDF image compression is limited compared to server-side
async function compressImage(imageData, quality = 0.7, maxWidth = 1200, maxHeight = 1200) {
    return new Promise((resolve, reject) => {
        try {
            // Create canvas to draw the image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Create image object
            const img = new Image();
            
            // Set up image loading handler
            img.onload = function() {
                // Calculate dimensions while preserving aspect ratio
                let width = img.width;
                let height = img.height;
                
                // Resize if larger than maximum dimensions
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = height * (maxWidth / width);
                        width = maxWidth;
                    } else {
                        width = width * (maxHeight / height);
                        height = maxHeight;
                    }
                }
                
                // Set canvas size to calculated dimensions
                canvas.width = width;
                canvas.height = height;
                
                // Use bicubic interpolation for smoother resizing
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Draw image on canvas at new dimensions
                ctx.drawImage(img, 0, 0, width, height);
                
                // Get compressed image data as base64 with specified quality
                const compressedData = canvas.toDataURL('image/jpeg', quality);
                
                // Resolve with the compressed data
                resolve(compressedData);
            };
            
            // Handle load errors
            img.onerror = function() {
                reject(new Error('Failed to load image for compression'));
            };
            
            // Set image source to the provided data
            img.src = imageData;
        } catch (error) {
            reject(error);
        }
    });
}

// Function to extract and compress images from a rendered PDF page
async function extractAndCompressImagesFromPDF(pdfBytes) {
    try {
        // Load the PDF with PDF.js
        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
        const pdfDoc = await loadingTask.promise;
        
        // Create a new PDF document using pdf-lib
        const newPdfDoc = await PDFLib.PDFDocument.create();
        
        // Process each page
        for (let i = 0; i < pdfDoc.numPages; i++) {
            // Get the PDF page
            const page = await pdfDoc.getPage(i + 1);
            
            // Create a canvas for rendering
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // Get page viewport at a reduced scale (70% of original size)
            const viewport = page.getViewport({ scale: 0.7 });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            // Render the page to canvas with lowered quality
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            // Get canvas data as JPEG with 80% quality
            const pageImageData = canvas.toDataURL('image/jpeg', 0.8);
            
            // Create a new page in the output PDF
            const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);
            
            // Convert the base64 image to a format usable by pdf-lib
            const jpgImageBytes = await fetch(pageImageData).then(res => res.arrayBuffer());
            const jpgImage = await newPdfDoc.embedJpg(jpgImageBytes);
            
            // Draw the compressed image on the page
            newPage.drawImage(jpgImage, {
                x: 0,
                y: 0,
                width: viewport.width,
                height: viewport.height
            });
        }
        
        // Save the output PDF
        const compressedPdfBytes = await newPdfDoc.save({
            useObjectStreams: true,
            addDefaultPage: false
        });
        
        return compressedPdfBytes;
    } catch (error) {
        console.error('Error in extract and compress:', error);
        throw error;
    }
}