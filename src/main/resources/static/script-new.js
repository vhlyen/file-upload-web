let isAdmin = false;
let adminName = '';
let uploadModal = { selectedFile: null };

document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
    setupUploadArea();
    setupModal();
    loadResources();
});

function initializeAuth() {
    const isAdminStored = localStorage.getItem('isAdmin') === 'true';
    const adminNameStored = localStorage.getItem('adminName');

    if (isAdminStored && adminNameStored) {
        fetch('/auth/verify')
            .then(r => r.json())
            .then(res => {
                if (res.authenticated) setAdminMode(true, adminNameStored);
                else clearAdminMode();
            })
            .catch(() => clearAdminMode());
    } else {
        setupPublicMode();
    }
}

function setAdminMode(admin, name) {
    isAdmin = admin;
    adminName = name;
    document.getElementById('adminSection').style.display = 'flex';
    document.getElementById('adminSection').innerHTML = `
        <span class="admin-label">Welcome, ${name}!</span>
        <button class="btn-outline" id="logoutBtn">Logout</button>
    `;
    document.getElementById('adminToolbar').style.display = 'block';
    document.getElementById('loginBtnNav').style.display = 'none';
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('addResourceBtn').addEventListener('click', () => openUploadModal(null));
}

function clearAdminMode() {
    setupPublicMode();
}

function setupPublicMode() {
    isAdmin = false;
    document.getElementById('adminSection').style.display = 'none';
    document.getElementById('adminToolbar').style.display = 'none';
    document.getElementById('loginBtnNav').style.display = 'block';
    document.getElementById('loginBtnNav').addEventListener('click', () => {
        window.location.href = 'login.html';
    });
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('adminName');
}

function logout() {
    fetch('/logout', { method: 'POST' })
        .then(() => {
            localStorage.removeItem('isAdmin');
            localStorage.removeItem('adminName');
            window.location.reload();
        })
        .catch(() => {
            localStorage.removeItem('isAdmin');
            localStorage.removeItem('adminName');
            window.location.reload();
        });
}

function setupUploadArea() {
    const addResourceBtn = document.getElementById('addResourceBtn');
    if (addResourceBtn) {
        addResourceBtn.addEventListener('click', () => openUploadModal(null));
    }
}

function setupModal() {
    const modal = document.getElementById('uploadModal');
    const closeBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const submitBtn = document.getElementById('submitBtn');
    const fileInput2 = document.getElementById('fileInput2');

    closeBtn.addEventListener('click', closeUploadModal);
    cancelBtn.addEventListener('click', closeUploadModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeUploadModal();
    });

    fileInput2.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadModal.selectedFile = e.target.files[0];
            document.getElementById('fileNameDisplay2').textContent = e.target.files[0].name;
        }
    });

    submitBtn.addEventListener('click', submitUpload);
}

function openUploadModal(file = null) {
    document.getElementById('sectionSelect').value = '';
    document.getElementById('descriptionInput').value = '';
    document.getElementById('documentLinkInput').value = '';
    document.getElementById('videoLinkInput').value = '';
    document.getElementById('fileInput2').value = '';
    uploadModal.selectedFile = file;
    document.getElementById('fileNameDisplay2').textContent = file ? file.name : 'No file selected';
    document.getElementById('uploadModal').classList.add('active');
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.remove('active');
    uploadModal.selectedFile = null;
}

async function submitUpload() {
    const section = document.getElementById('sectionSelect').value;
    const description = document.getElementById('descriptionInput').value;
    const documentLink = document.getElementById('documentLinkInput').value;
    const videoLink = document.getElementById('videoLinkInput').value;
    const file = uploadModal.selectedFile;

    if (!section || !description.trim()) {
        alert('Please select section and enter title');
        return;
    }

    if (!file && !documentLink.trim() && !videoLink.trim()) {
        alert('Please provide at least one resource');
        return;
    }

    try {
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('section', section);
            formData.append('description', description);
            await fetch('/upload', { method: 'POST', body: formData });
        }

        if (documentLink.trim() || videoLink.trim()) {
            await fetch('/upload/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section, description,
                    documentLink: documentLink.trim() || null,
                    videoLink: videoLink.trim() || null
                })
            });
        }

        alert('Resource added!');
        closeUploadModal();
        loadResources();
    } catch (error) {
        alert('Error uploading resource');
    }
}

async function loadResources() {
    const sections = [
        { id: 'general', name: 'General Resources' },
        { id: 'semester252', name: 'Semester 252' },
        { id: 'semester261', name: 'Semester 261' }
    ];

    for (const section of sections) {
        try {
            const response = await fetch(`/resources?section=${section.id}`);
            const resources = await response.json();
            const container = document.getElementById(`${section.id}Section`);

            if (!container) continue;

            container.innerHTML = '';

            if (resources && resources.length > 0) {
                resources.forEach((resource, index) => {
                    const html = `
                        <div class="card">
                            ${isAdmin ? `<button class="card-delete" onclick="deleteResource('${section.id}', ${index})" title="Delete resource">×</button>` : ''}
                            <h3>${escapeHtml(resource.title || resource.description)}</h3>
                            <div class="card-links">
                                ${resource.file ? `<a href="/uploads/${encodeURIComponent(resource.file)}" download class="card-link primary">📥 Download</a>` : ''}
                                ${resource.documentLink ? `<a href="${escapeHtml(resource.documentLink)}" target="_blank" class="card-link secondary">📄 Document</a>` : ''}
                                ${resource.videoLink ? `<a href="${escapeHtml(resource.videoLink)}" target="_blank" class="card-link accent">▶ Video</a>` : ''}
                            </div>
                        </div>
                    `;
                    container.innerHTML += html;
                });
            } else {
                container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No resources yet</p>';
            }
        } catch (error) {
            console.error('Error loading resources:', error);
        }
    }
}

async function deleteResource(section, index) {
    if (!confirm('Delete this resource?')) return;
    
    try {
        await fetch('/resources/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section, index })
        });
        loadResources();
    } catch (error) {
        alert('Error deleting resource');
    }
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}
