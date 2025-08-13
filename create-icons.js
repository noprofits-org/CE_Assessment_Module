// This script creates base64 PNG icons for the PWA
// Run this in the browser console to generate the icons

function createIcon(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#2563eb');
    gradient.addColorStop(1, '#1e40af');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // White circle
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2.5, 0, Math.PI * 2);
    ctx.fill();
    
    // CE text
    ctx.fillStyle = '#2563eb';
    ctx.font = `bold ${size/3}px -apple-system, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CE', size/2, size/2);
    
    // House icon at top
    ctx.font = `${size/8}px Arial`;
    ctx.fillText('🏠', size/2, size/5);
    
    return canvas.toDataURL('image/png');
}

// Generate icons
console.log('Icon 192x192 data URL:', createIcon(192));
console.log('Icon 512x512 data URL:', createIcon(512));