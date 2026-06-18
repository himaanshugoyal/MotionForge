/**
 * Offline CSV Parser and Mapping Utility for MotionForge AI
 */

// Basic CSV string parser (handles quotes and commas)
export function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Split by comma, preserving contents inside quotes
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
    const cleanCells = matches.map(cell => {
      let cleaned = cell.trim();
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.substring(1, cleaned.length - 1);
      }
      return cleaned;
    });
    
    rows.push(cleanCells);
  }
  return rows;
}

// Convert parsed CSV rows into timed overlays based on selected template
export function mapCSVToTimeline(rows, templateType, totalVideoDuration = 10) {
  if (!rows || rows.length === 0) return [];
  
  // If first row is non-numeric, assume headers
  let hasHeaders = false;
  let headers = [];
  let dataRows = [...rows];
  
  if (rows[0] && isNaN(Number(rows[0][0]))) {
    hasHeaders = true;
    headers = rows[0].map(h => h.toLowerCase());
    dataRows = rows.slice(1);
  }

  const overlays = [];
  const rowCount = dataRows.length;
  if (rowCount === 0) return [];

  // Calculate timeframe windows per row
  const windowSize = totalVideoDuration / rowCount;

  if (templateType === 'captions') {
    // Generate sequential captions / text slides
    dataRows.forEach((row, index) => {
      // Find text column or use the first cell
      const textVal = row[0] || '';
      if (!textVal) return;

      const startTime = index * windowSize;
      const duration = windowSize - 0.2; // leave a small gap

      overlays.push({
        id: `csv-caption-${index}-${Date.now()}`,
        name: 'Smart Captions',
        text: textVal,
        start: parseFloat(startTime.toFixed(1)),
        duration: parseFloat(duration.toFixed(1)),
        fontSize: 24,
        textColor: '#ffffff',
        accentColor: '#eab308',
        x: 50,
        y: 80,
        trackIndex: index + 1,
        animationType: 'fade'
      });
    });
  } 
  
  else if (templateType === 'data-slides') {
    // Generate slideshow showing metrics/progress bars
    dataRows.forEach((row, index) => {
      // Assume column 0 is Label, column 1 is Value
      const label = row[0] || 'Metric';
      const value = row[1] || '';
      
      const startTime = index * windowSize;
      const duration = windowSize - 0.2;

      overlays.push({
        id: `csv-slide-${index}-${Date.now()}`,
        name: 'Dynamic Progress Bar',
        text: `${label}: ${value}`,
        start: parseFloat(startTime.toFixed(1)),
        duration: parseFloat(duration.toFixed(1)),
        fontSize: 16,
        textColor: '#ffffff',
        accentColor: index % 2 === 0 ? '#10b981' : '#06b6d4', // alternate green/cyan
        x: 50,
        y: 88,
        trackIndex: index + 1,
        animationType: 'progress'
      });
    });
  }

  return overlays;
}
