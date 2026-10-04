/**
 * RevTrack — Personal Dashboard Visualizations (Chart.js 4.4)
 */

document.addEventListener('DOMContentLoaded', () => {
    const calcDataElem = document.getElementById('calc-data');
    const currencyElem = document.getElementById('user-currency');

    if (!calcDataElem) return;

    let calcData = {};
    let currency = '$';

    try {
        calcData = JSON.parse(calcDataElem.textContent);
        currency = JSON.parse(currencyElem.textContent) || '$';
    } catch (e) {
        console.error("Could not parse calculation data", e);
        return;
    }

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const textColor = currentTheme === 'dark' ? '#94a3b8' : '#475569';
    const gridColor = currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

    // -------------------------------------------------------------
    // 1. Deduction Donut Chart (Monthly Breakdown)
    // -------------------------------------------------------------
    const donutCtx = document.getElementById('deductionDonutChart');
    let deductionDonutChart = null;

    if (donutCtx && calcData.monthly) {
        const net = calcData.monthly.net;
        const tax = calcData.monthly.tax;
        const pension = calcData.monthly.pension;
        const insuranceAndOther = (calcData.monthly.insurance || 0) + (calcData.monthly.other_deductions || 0);

        deductionDonutChart = new Chart(donutCtx, {
            type: 'doughnut',
            data: {
                labels: ['Net Take-Home', 'Income Tax', 'Pension / 401(k)', 'Insurance & Other'],
                datasets: [{
                    data: [net, tax, pension, insuranceAndOther],
                    backgroundColor: [
                        '#10b981', // Emerald
                        '#f43f5e', // Rose/Red
                        '#818cf8', // Indigo
                        '#f59e0b'  // Amber
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
                            padding: 14,
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
                cutout: '70%'
            }
        });
    }

    // -------------------------------------------------------------
    // 2. Horizon Comparison Bar Chart (Weekly, Monthly, Yearly)
    // -------------------------------------------------------------
    const barCtx = document.getElementById('horizonBarChart');
    let horizonBarChart = null;

    if (barCtx && calcData) {
        horizonBarChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: ['Gross Income', 'Total Deductions', 'Net Take-Home'],
                datasets: [{
                    label: 'Amount (' + currency + ')',
                    data: [calcData.monthly.gross, calcData.monthly.total_deductions, calcData.monthly.net],
                    backgroundColor: [
                        '#6366f1', // Indigo (Gross)
                        '#f43f5e', // Rose (Deductions)
                        '#10b981'  // Emerald (Net)
                    ],
                    borderRadius: 6,
                    maxBarThickness: 54
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor, font: { family: 'Inter', size: 12, weight: '600' } }
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
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: context => ` ${context.label}: ${currency}${context.raw.toLocaleString(undefined, {minimumFractionDigits: 2})}`
                        }
                    }
                }
            }
        });
    }

    // Horizon Switcher function
    window.switchHorizon = function(horizon) {
        const horizonButtons = document.querySelectorAll('#horizonButtons button');
        horizonButtons.forEach(b => b.classList.remove('active'));
        event.target.classList.add('active');

        if (!horizonBarChart || !calcData[horizon]) return;

        const period = calcData[horizon];
        horizonBarChart.data.datasets[0].data = [period.gross, period.total_deductions, period.net];
        horizonBarChart.update();

        const detailsElem = document.getElementById('horizonDetails');
        if (detailsElem) {
            const hCapital = horizon.charAt(0).toUpperCase() + horizon.slice(1);
            detailsElem.innerHTML = `Showing <strong>${hCapital}</strong> breakdown: Gross <strong>${currency}${period.gross.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong> vs Net <strong>${currency}${period.net.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong>.`;
        }
    };

    // -------------------------------------------------------------
    // 3. Historical Net Revenue Line Chart
    // -------------------------------------------------------------
    const lineCtx = document.getElementById('netHistoryLineChart');
    const emptyStateElem = document.getElementById('netHistoryEmptyState');
    if (lineCtx) {
        fetch('/api/personal-chart-data')
            .then(res => res.json())
            .then(data => {
                const history = data.history;
                if (!history || !history.labels || history.labels.length === 0) {
                    // Show friendly empty state instead of fake dummy numbers
                    lineCtx.style.display = 'none';
                    if (emptyStateElem) emptyStateElem.style.display = 'flex';
                    return;
                }
                lineCtx.style.display = 'block';
                if (emptyStateElem) emptyStateElem.style.display = 'none';
                renderHistoryLineChart(history.labels, history.net);
            })
            .catch(() => {
                lineCtx.style.display = 'none';
                if (emptyStateElem) emptyStateElem.style.display = 'flex';
            });
    }

    function renderHistoryLineChart(labels, values) {
        new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Net Take-Home',
                    data: values,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#ffffff',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor, font: { family: 'Inter', size: 11 } }
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
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: context => ` Net: ${currency}${context.raw.toLocaleString(undefined, {minimumFractionDigits: 2})}`
                        }
                    }
                }
            }
        });
    }
});
