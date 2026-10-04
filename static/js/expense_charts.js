/**
 * RevTrack — Expense Visualizations (Chart.js 4.4)
 * Handles Category Breakdown Donut (Groceries, Clothes, Other) and Horizon Bars.
 */

document.addEventListener('DOMContentLoaded', () => {
    const summaryDataElem = document.getElementById('expense-summary-data');
    const currencyElem = document.getElementById('user-currency-symbol');
    const salaryElem = document.getElementById('monthly-net-salary');

    if (!summaryDataElem) return;

    let summary = {};
    let currency = '₹';
    let monthlySalary = 0;

    try {
        summary = JSON.parse(summaryDataElem.textContent);
        currency = JSON.parse(currencyElem.textContent) || '₹';
        monthlySalary = parseFloat(salaryElem.textContent) || 0;
    } catch (e) {
        console.error("Could not parse expense summary data", e);
        return;
    }

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const textColor = currentTheme === 'dark' ? '#94a3b8' : '#475569';
    const gridColor = currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

    // -------------------------------------------------------------
    // 1. Expense Category Donut Chart
    // -------------------------------------------------------------
    const donutCtx = document.getElementById('expenseCategoryDonutChart');
    if (donutCtx && summary.categories) {
        const cats = summary.categories;
        const labels = ['Groceries', 'Clothing', 'Other Purchases', 'Utilities', 'Dining', 'Transportation'];
        const values = [
            cats.groceries || 0,
            cats.clothing || 0,
            cats.other || 0,
            cats.utilities || 0,
            cats.dining || 0,
            cats.transportation || 0
        ];

        new Chart(donutCtx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: [
                        '#10b981', // Groceries (Emerald)
                        '#ec4899', // Clothing (Pink)
                        '#14b8a6', // Other Purchases (Teal)
                        '#0ea5e9', // Utilities (Sky)
                        '#f59e0b', // Dining (Amber)
                        '#6366f1'  // Transportation (Indigo)
                    ],
                    borderWidth: 2,
                    borderColor: currentTheme === 'dark' ? '#111827' : '#ffffff',
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor,
                            font: { family: 'Inter', size: 11, weight: '500' },
                            padding: 12,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const val = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                                return ` ${context.label}: ${currency}${val.toLocaleString(undefined, {minimumFractionDigits: 2})} (${pct}%)`;
                            }
                        }
                    }
                },
                cutout: '68%'
            }
        });
    }

    // -------------------------------------------------------------
    // 2. Spending Horizon Bar Chart (Weekly, Monthly, Yearly)
    // -------------------------------------------------------------
    const barCtx = document.getElementById('expenseHorizonBarChart');
    if (barCtx) {
        const weeklyExp = summary.total_weekly || 0;
        const monthlyExp = summary.total_monthly || 0;
        const yearlyExp = summary.total_yearly || 0;

        const weeklySalary = monthlySalary / 4.333;
        const yearlySalary = monthlySalary * 12;

        new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: ['Weekly (7-Day)', 'Monthly', 'Annual (Yearly)'],
                datasets: [
                    {
                        label: 'Take-Home Salary',
                        data: [weeklySalary, monthlySalary, yearlySalary],
                        backgroundColor: 'rgba(16, 185, 129, 0.85)', // Emerald
                        borderRadius: 6,
                        maxBarThickness: 42
                    },
                    {
                        label: 'Expenses & Purchases',
                        data: [weeklyExp, monthlyExp, yearlyExp],
                        backgroundColor: 'rgba(244, 63, 94, 0.85)', // Rose/Red
                        borderRadius: 6,
                        maxBarThickness: 42
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor, font: { family: 'Inter', size: 11, weight: '600' } }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: {
                            color: textColor,
                            callback: value => currency + value.toLocaleString()
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: textColor, font: { family: 'Inter', size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: context => ` ${context.dataset.label}: ${currency}${context.raw.toLocaleString(undefined, {minimumFractionDigits: 2})}`
                        }
                    }
                }
            }
        });
    }
});
