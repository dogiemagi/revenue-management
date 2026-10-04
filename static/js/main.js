/**
 * RevTrack — Core Client Utilities
 * Handles Modal Dialogs, Theme Switching, Sidebar Toggle, and Clipboard.
 */

// Password visibility toggle
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
        btn.title = 'Hide password';
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
        btn.title = 'Show password';
    }
}

// Modal Management
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Close modal when clicking outside dialog content
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Close modal on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => {
            m.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
});

// Theme Toggle (Dark / Light) with LocalStorage persistence
const themeToggleBtn = document.getElementById('themeToggleBtn');
if (themeToggleBtn) {
    const savedTheme = localStorage.getItem('revtrack_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('revtrack_theme', nextTheme);

        // Notify chart re-renders if available
        if (window.onThemeChange) {
            window.onThemeChange(nextTheme);
        }
    });
}

// Mobile Sidebar Toggle
const sidebar = document.getElementById('sidebar');
const sidebarOpenBtn = document.getElementById('sidebarOpenBtn');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

if (sidebarOpenBtn && sidebar) {
    sidebarOpenBtn.addEventListener('click', () => {
        sidebar.classList.add('open');
    });
}

if (sidebarCloseBtn && sidebar) {
    sidebarCloseBtn.addEventListener('click', () => {
        sidebar.classList.remove('open');
    });
}

// ================= ONBOARDING SETUP WIZARD =================
window.goToWizardStep = function(stepNum) {
    // Hide all steps
    document.querySelectorAll('.wizard-step').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.step-indicator').forEach(i => i.classList.remove('active'));

    const targetStep = document.getElementById(`wizardStep${stepNum}`);
    const targetIndicator = document.getElementById(`stepIndicator${stepNum}`);

    if (targetStep) targetStep.style.display = 'block';
    if (targetIndicator) targetIndicator.classList.add('active');
};

// ================= AI FINANCIAL ASSISTANT CHAT =================
window.toggleAIChat = function() {
    const drawer = document.getElementById('aiChatDrawer');
    if (!drawer) return;
    
    if (drawer.style.display === 'none' || !drawer.style.display) {
        drawer.style.display = 'flex';
        const input = document.getElementById('aiQueryInput');
        if (input) setTimeout(() => input.focus(), 150);
    } else {
        drawer.style.display = 'none';
    }
};

window.askQuickAI = function(question) {
    const input = document.getElementById('aiQueryInput');
    if (input) {
        input.value = question;
        submitAIQuery();
    }
};

window.submitAIQuery = function() {
    const input = document.getElementById('aiQueryInput');
    const messages = document.getElementById('aiChatMessages');
    const sendBtn = document.getElementById('aiSendBtn');
    if (!input || !messages) return;

    const query = input.value.trim();
    if (!query) return;

    // 1. Append User Message
    const userMsg = document.createElement('div');
    userMsg.className = 'ai-msg ai-msg-user';
    userMsg.innerHTML = `<div class="ai-msg-bubble">${escapeHtml(query)}</div>`;
    messages.appendChild(userMsg);

    input.value = '';
    if (sendBtn) sendBtn.disabled = true;

    // 2. Append Typing Indicator
    const typingMsg = document.createElement('div');
    typingMsg.className = 'ai-msg ai-msg-bot ai-typing';
    typingMsg.id = 'aiTypingIndicator';
    typingMsg.innerHTML = `
        <div class="ai-msg-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
        <div class="ai-msg-bubble">
            <div class="typing-dots"><span></span><span></span><span></span></div>
        </div>
    `;
    messages.appendChild(typingMsg);
    messages.scrollTop = messages.scrollHeight;

    // 3. Request AI Insights from Backend
    fetch('/api/ai-finance-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query })
    })
    .then(res => res.json())
    .then(data => {
        // Remove typing indicator
        const typing = document.getElementById('aiTypingIndicator');
        if (typing) typing.remove();

        const botMsg = document.createElement('div');
        botMsg.className = 'ai-msg ai-msg-bot';
        const replyText = data.reply || "I analyzed your query, but could not produce a response. Please try rephrasing.";
        
        botMsg.innerHTML = `
            <div class="ai-msg-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="ai-msg-bubble">
                ${formatAIMarkdown(replyText)}
                ${data.powered_by ? `<div class="ai-powered-tag"><i class="fa-solid fa-shield-halved"></i> Powered by ${data.powered_by}</div>` : ''}
            </div>
        `;
        messages.appendChild(botMsg);
        messages.scrollTop = messages.scrollHeight;
    })
    .catch(err => {
        const typing = document.getElementById('aiTypingIndicator');
        if (typing) typing.remove();

        const botMsg = document.createElement('div');
        botMsg.className = 'ai-msg ai-msg-bot';
        botMsg.innerHTML = `
            <div class="ai-msg-avatar"><i class="fa-solid fa-triangle-exclamation" style="color:var(--danger);"></i></div>
            <div class="ai-msg-bubble" style="border-left: 3px solid var(--danger);">
                Could not connect to the financial analysis service. Please try again.
            </div>
        `;
        messages.appendChild(botMsg);
        messages.scrollTop = messages.scrollHeight;
    })
    .finally(() => {
        if (sendBtn) sendBtn.disabled = false;
        input.focus();
    });
};

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatAIMarkdown(text) {
    return text
        .replace(/### (.*?)\n/g, '<h4 style="margin: 0.35rem 0 0.5rem 0; font-size: 0.95rem; color: var(--text-primary); font-weight: 700;">$1</h4>')
        .replace(/#### (.*?)\n/g, '<h5 style="margin: 0.3rem 0 0.4rem 0; font-size: 0.88rem; color: var(--primary); font-weight: 600;">$1</h5>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.*?)$/gm, '<li style="margin-left: 1.2rem; margin-bottom: 0.25rem;">$1</li>')
        .replace(/\n\n/g, '<div style="height: 0.45rem;"></div>')
        .replace(/\n/g, '<br>');
}
