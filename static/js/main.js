/**
 * RevTrack — Core Client Utilities
 * Handles Modal Dialogs, Theme Switching, Sidebar Toggle, and Clipboard.
 */

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
