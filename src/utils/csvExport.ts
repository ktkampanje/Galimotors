// CSV Export Utility
export class CSVExporter {
  // Convert array of objects to CSV string
  static toCSV(data: any[], columns?: string[]): string {
    if (data.length === 0) {
      return '';
    }

    // Use provided columns or extract from first object
    const headers = columns || Object.keys(data[0]);
    
    // Create header row
    const headerRow = headers.map(h => this.escapeCSVValue(h)).join(',');
    
    // Create data rows
    const dataRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        return this.escapeCSVValue(value);
      }).join(',');
    });
    
    return [headerRow, ...dataRows].join('\n');
  }

  // Escape CSV values (handle commas, quotes, newlines)
  private static escapeCSVValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = String(value);
    
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }

  // Format date for CSV
  static formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  // Format datetime for CSV
  static formatDateTime(date: Date | string): string {
    const d = new Date(date);
    return d.toISOString().replace('T', ' ').split('.')[0]; // YYYY-MM-DD HH:MM:SS
  }

  // Format currency for CSV
  static formatCurrency(amount: number): string {
    return amount.toFixed(2);
  }
}
