/**
 * RevTrack — Live Interactive Salary Calculator Engine (Client-side)
 */

document.addEventListener('DOMContentLoaded', () => {
    const defaultsElem = document.getElementById('calc-defaults');
    if (!defaultsElem) return;

    let defaults = {};
    try {
        defaults = JSON.parse(defaultsElem.textContent);
    } catch (e) {
        defaults = { currency: '$' };
    }

    const currency = defaults.currency || '$';
    let liveDonutChart = null;

    // Elements
    const baseSalaryInput = document.getElementById('calc_base_salary');
    const frequencySelect = document.getElementById('calc_frequency');
    const allowancesInput = document.getElementById('calc_allowances');
    const bonusInput = document.getElementById('calc_bonus');
    const taxRateInput = document.getElementById('calc_tax_rate');
    const taxRateLabel = document.getElementById('taxRateLabel');
    const pensionRateInput = document.getElementById('calc_pension_rate');
    const pensionRateLabel = document.getElementById('pensionRateLabel');
    const insuranceInput = document.getElementById('calc_insurance');
    const otherInput = document.getElementById('calc_other');
    const hoursInput = document.getElementById('calc_hours');
    const overtimeHoursInput = document.getElementById('calc_overtime_hours');
    const overtimeMultSelect = document.getElementById('calc_overtime_mult');

    // Result elements
    const resMonthlyNet = document.getElementById('res_monthly_net');
    const resMonthlyGross = document.getElementById('res_monthly_gross');
    const resRetentionBadge = document.getElementById('res_retention_badge');
    const resWeeklyNet = document.getElementById('res_weekly_net');
    const resWeeklyGross = document.getElementById('res_weekly_gross');
    const resBiweeklyNet = document.getElementById('res_biweekly_net');
    const resBiweeklyGross = document.getElementById('res_biweekly_gross');
    const resYearlyNet = document.getElementById('res_yearly_net');
    const resYearlyGross = document.getElementById('res_yearly_gross');
    const resHourlyNet = document.getElementById('res_hourly_net');
    const resDailyNet = document.getElementById('res_daily_net');

    // Debounce timer
    let debounceTimer = null;

    function triggerCalculation() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(runCalculation, 120);
    }

    // Attach listeners
    [
        baseSalaryInput, frequencySelect, allowancesInput, bonusInput,
        insuranceInput, otherInput, hoursInput, overtimeHoursInput, overtimeMultSelect
    ].forEach(el => {
        if (el) el.addEventListener('input', triggerCalculation);
    });

    if (taxRateInput) {
        taxRateInput.addEventListener('input', () => {
            if (taxRateLabel) taxRateLabel.textContent = taxRateInput.value + '%';
            triggerCalculation();
        });
    }

    if (pensionRateInput) {
        pensionRateInput.addEventListener('input', () => {
            if (pensionRateLabel) pensionRateLabel.textContent = pensionRateInput.value + '%';
            triggerCalculation();
        });
    }

    function runCalculation() {
        const payload = {
            base_salary: parseFloat(baseSalaryInput.value) || 0,
            frequency: frequencySelect.value,
            allowances: parseFloat(allowancesInput.value) || 0,
            bonus: parseFloat(bonusInput.value) || 0,
            tax_rate: parseFloat(taxRateInput.value) || 0,
            pension_rate: parseFloat(pensionRateInput.value) || 0,
            insurance: parseFloat(insuranceInput.value) || 0,
            other: parseFloat(otherInput.value) || 0,
            hours: parseFloat(hoursInput.value) || 40,
            overtime_hours: parseFloat(overtimeHoursInput.value) || 0,
            overtime_mult: parseFloat(overtimeMultSelect.value) || 1.5
        };

        fetch('/api/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            updateResultsUI(data);
        })
        .catch(err => console.error("Calculation API error:", err));
    }

    function updateResultsUI(data) {
        const m = data.monthly;
        const w = data.weekly;
        const bw = data.biweekly;
        const y = data.yearly;
        const h = data.hourly;
        const d = data.daily;
        const rates = data.rates;

        // Monthly
        if (resMonthlyNet) resMonthlyNet.textContent = `${currency}${m.net.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        if (resMonthlyGross) resMonthlyGross.textContent = `${currency}${m.gross.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        if (resRetentionBadge) resRetentionBadge.textContent = `${rates.retention_rate}% Retained`;

        // Weekly
        if (resWeeklyNet) resWeeklyNet.textContent = `${currency}${w.net.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        if (resWeeklyGross) resWeeklyGross.textContent = `${currency}${w.gross.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

        // Bi-weekly
        if (resBiweeklyNet) resBiweeklyNet.textContent = `${currency}${bw.net.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        if (resBiweeklyGross) resBiweeklyGross.textContent = `${currency}${bw.gross.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

        // Yearly
        if (resYearlyNet) resYearlyNet.textContent = `${currency}${y.net.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
        if (resYearlyGross) resYearlyGross.textContent = `${currency}${y.gross.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

        // Hourly & Daily
        if (resHourlyNet) resHourlyNet.textContent = `${currency}${h.net_hourly.toLocaleString(undefined, {minimumFractionDigits: 2})}/hr`;
        if (resDailyNet) resDailyNet.textContent = `${currency}${d.net.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

        // Update Live Donut Chart
        updateLiveDonut(m.net, m.tax, m.pension, (m.insurance + m.other_deductions));
    }

    function updateLiveDonut(net, tax, pension, insuranceOther) {
        const ctx = document.getElementById('liveCalcDonutChart');
        if (!ctx) return;

        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const textColor = currentTheme === 'dark' ? '#94a3b8' : '#475569';

        if (!liveDonutChart) {
            liveDonutChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Net Take-Home', 'Income Tax', 'Pension / 401(k)', 'Insurance & Other'],
                    datasets: [{
                        data: [net, tax, pension, insuranceOther],
                        backgroundColor: ['#10b981', '#f43f5e', '#818cf8', '#f59e0b'],
                        borderWidth: 2,
                        borderColor: currentTheme === 'dark' ? '#111827' : '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: textColor, font: { family: 'Inter', size: 11 }, usePointStyle: true }
                        }
                    },
                    cutout: '68%'
                }
            });
        } else {
            liveDonutChart.data.datasets[0].data = [net, tax, pension, insuranceOther];
            liveDonutChart.update();
        }
    }

    window.resetCalculatorDefaults = function() {
        if (baseSalaryInput) baseSalaryInput.value = defaults.base_salary || 5000;
        if (frequencySelect) frequencySelect.value = defaults.frequency || 'monthly';
        if (allowancesInput) allowancesInput.value = defaults.allowances || 500;
        if (bonusInput) bonusInput.value = defaults.bonus || 0;
        if (taxRateInput) {
            taxRateInput.value = defaults.tax_rate || 15;
            if (taxRateLabel) taxRateLabel.textContent = taxRateInput.value + '%';
        }
        if (pensionRateInput) {
            pensionRateInput.value = defaults.pension_rate || 5;
            if (pensionRateLabel) pensionRateLabel.textContent = pensionRateInput.value + '%';
        }
        if (insuranceInput) insuranceInput.value = defaults.insurance || 150;
        if (otherInput) otherInput.value = defaults.other || 50;
        if (hoursInput) hoursInput.value = 40;
        if (overtimeHoursInput) overtimeHoursInput.value = 0;
        runCalculation();
    };

    // Initial calculation run
    runCalculation();
});
