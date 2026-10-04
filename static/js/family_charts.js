/**
 * RevTrack — Family & Household Visualizations (Chart.js 4.4)
 */

document.addEventListener('DOMContentLoaded', () => {
    const donutCtx = document.getElementById('familyDonutChart');
    const barCtx = document.getElementById('familyBarChart');

    if (!donutCtx && !barCtx) return;

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const textColor = currentTheme === 'dark' ? '#94a3b8' : '#475569';
    const gridColor = currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

    const palette = [
        '#6366f1', // Indigo
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#ec4899', // Pink
        '#8b5cf6', // Violet
        '#0ea5e9'  // Sky
    ];

    fetch('/api/family-chart-data')
        .then(res => res.json())
        .then(data => {
            const labels = data.labels || [];
            const netValues = data.net_values || [];
            const grossValues = data.gross_values || [];

            if (labels.length === 0) return;

            // 1. Family Member Contribution Donut
            if (donutCtx) {
                new Chart(donutCtx, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: netValues,
                            backgroundColor: palette.slice(0, labels.length),
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
                                        return ` ${context.label}: $${val.toLocaleString(undefined, {minimumFractionDigits: 2})} (${pct}%)`;
                                    }
                                }
                            }
                        },
                        cutout: '65%'
                    }
                });
            }

            // 2. Member Gross vs Net Comparison Bar Chart
            if (barCtx) {
                new Chart(barCtx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Monthly Gross',
                                data: grossValues,
                                backgroundColor: 'rgba(99, 102, 241, 0.7)',
                                borderRadius: 6,
                                maxBarThickness: 38
                            },
                            {
                                label: 'Monthly Net Take-Home',
                                data: netValues,
                                backgroundColor: 'rgba(16, 185, 129, 0.85)',
                                borderRadius: 6,
                                maxBarThickness: 38
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
                                    callback: value => '$' + value.toLocaleString()
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
                                    label: context => ` ${context.dataset.label}: $${context.raw.toLocaleString(undefined, {minimumFractionDigits: 2})}`
                                }
                            }
                        }
                    }
                });
            }
        })
        .catch(err => console.error("Error loading family charts", err));
});
