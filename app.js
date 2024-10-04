// Check if service worker is supported
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
        .then(registration => console.log('Service Worker registered'))
        .catch(error => console.log('Service Worker registration failed:', error));
}

let bankStatements = [];
let creditCardStatements = [];

document.getElementById('bank-statement').addEventListener('change', (event) => {
    bankStatements = Array.from(event.target.files);
});

document.getElementById('credit-card-statement').addEventListener('change', (event) => {
    creditCardStatements = Array.from(event.target.files);
});

document.getElementById('generate-button').addEventListener('click', generateCombinedExcel);
async function generateCombinedExcel() {
    const combinedData = [];

    // Process bank statements
    for (const file of bankStatements) {
        const text = await extractTextFromPDF(file);
        combinedData.push(...processPDFText(text, 'Bank'));
    }

    // Process credit card statements
    for (const file of creditCardStatements) {
        const text = await extractTextFromPDF(file);
        combinedData.push(...processPDFText(text, 'Credit Card'));
    }

    // Categorize expenses
    const categorizedData = categorizeExpenses(combinedData);

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Create detailed transactions worksheet
    const ws_transactions = XLSX.utils.json_to_sheet(categorizedData);
    XLSX.utils.book_append_sheet(wb, ws_transactions, 'Transactions');

    // Create summary worksheet
    const summary = generateSummary(categorizedData);
    const ws_summary = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, ws_summary, 'Summary');

    // Create charts
    const ws_charts = XLSX.utils.aoa_to_sheet([['Category Chart']]);
    XLSX.utils.book_append_sheet(wb, ws_charts, 'Charts');

    // Add category pie chart
    const categoryChart = generateCategoryChart(summary);
    ws_charts['!drawing'] = categoryChart;

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Create download link
    const downloadLink = document.getElementById('download-link');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = 'RupeeSense_Budget_Analysis.xlsx';
    downloadLink.style.display = 'inline';
}
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';
    }

    return text;
}

function processPDFText(text, source) {
    const lines = text.split('\n');
    const data = [];

    // This is a simplified example. You'll need to adjust this based on your actual Indian bank PDF format.
    for (const line of lines) {
        // Assuming date format is DD-MM-YYYY and amount is in Indian Rupees
        const match = line.match(/(\d{2}-\d{2}-\d{4})\s+(.+?)\s+([-]?₹?\s?\d+(?:,\d+)*(?:\.\d{2})?)/);
        if (match) {
            const entry = {
                Date: match[1],
                Description: match[2].trim(),
                Amount: parseFloat(match[3].replace(/[₹,\s]/g, '')),
                Source: source
            };
            data.push(entry);
        }
    }

    return data;
}

function categorizeExpenses(data) {
    const categories = {
        'Groceries': ['supermarket', 'grocery', 'kirana', 'sabzi', 'vegetables'],
        'Utilities': ['electricity', 'water', 'gas', 'internet', 'phone', 'mobile recharge'],
        'Transportation': ['petrol', 'diesel', 'uber', 'ola', 'auto', 'metro', 'bus'],
        'Entertainment': ['restaurant', 'cinema', 'movie', 'concert', 'zomato', 'swiggy'],
        'Shopping': ['amazon', 'flipkart', 'myntra', 'clothing', 'electronics'],
        'Healthcare': ['doctor', 'hospital', 'medical', 'pharmacy', 'medicine'],
        'Housing': ['rent', 'maintenance', 'society', 'property tax'],
        'Education': ['school', 'college', 'tuition', 'books', 'stationery'],
        'Personal Care': ['salon', 'spa', 'grooming'],
        'Insurance': ['life insurance', 'health insurance', 'vehicle insurance'],
        'Investments': ['mutual fund', 'stocks', 'fixed deposit', 'ppf', 'nps'],
    };

    return data.map(entry => {
        let category = 'Other';
        for (const [cat, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => entry.Description.toLowerCase().includes(keyword))) {
                category = cat;
                break;
            }
        }
        return { ...entry, Category: category };
    });
}

function generateSummary(data) {
    const summary = {};
    data.forEach(entry => {
        if (!summary[entry.Category]) {
            summary[entry.Category] = 0;
        }
        summary[entry.Category] += entry.Amount;
    });

    const totalExpenses = Object.values(summary).reduce((a, b) => a + b, 0);

    return Object.entries(summary).map(([category, amount]) => ({
        Category: category,
        Amount: amount,
        Percentage: (amount / totalExpenses * 100).toFixed(2) + '%'
    }));
}

function generateCategoryChart(summary) {
    const chartData = summary.map(item => [item.Category, parseFloat(item.Amount)]);
    const chartOptions = {
        title: 'Expenses by Category',
        type: 'pie',
        series: [{ name: 'Expenses', data: chartData }],
    };

    return {
        type: 'chart',
        position: { col: 0, row: 1 },
        size: { width: 600, height: 400 },
        options: chartOptions,
    };
}