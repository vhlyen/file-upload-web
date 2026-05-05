
        // Auth State
let isAdmin = false;
let adminName = '';

// Modal State
let uploadModal = {
    selectedFile: null,
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
    setupUploadArea();
    setupModal();
    loadResources();
});

// Initialize Authentication
function initializeAuth() {
    const isAdminStored = localStorage.getItem('isAdmin') === 'true';
    const adminNameStored = localStorage.getItem('adminName');

    if (isAdminStored && adminNameStored) {
        // Verify with backend
        fetch('/auth/verify')
            .then((response) => response.json())
            .then((result) => {
                if (result.authenticated) {
                    setAdminMode(true, adminNameStored);
                } else {
                    clearAdminMode();
                }
            })
            .catch(() => {
                clearAdminMode();
            });
    } else {
        setupPublicMode();
    }
}

// Set Admin Mode
function setAdminMode(admin, name) {
    isAdmin = admin;
    adminName = name;

    const adminBar = document.getElementById('adminBar');
    const uploadSection = document.getElementById('uploadSection');
    const uploadControls = document.getElementById('uploadControls');
    const adminNameEl = document.getElementById('adminName');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginBtn = document.getElementById('loginBtn');

    if (admin) {
        adminBar.style.display = 'block';
        adminNameEl.textContent = `Welcome, ${name}!`;
        uploadSection.style.display = 'block';
        if (uploadControls) uploadControls.style.display = 'none';
        if (loginBtn) loginBtn.style.display = 'none';

        logoutBtn.addEventListener('click', logout);
    }
}

// Clear Admin Mode
function clearAdminMode() {
    setupPublicMode();
}

// Setup Public Mode
function setupPublicMode() {
    isAdmin = false;
    const adminBar = document.getElementById('adminBar');
    const publicNavbar = document.getElementById('publicNavbar');
    const uploadSection = document.getElementById('uploadSection');
    const uploadControls = document.getElementById('uploadControls');
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnNav = document.getElementById('loginBtnNav');

    adminBar.style.display = 'none';
    publicNavbar.style.display = 'block';
    uploadSection.style.display = 'none';
    if (uploadControls) {
        uploadControls.style.display = 'none';
    }
    
    if (loginBtn) {
        loginBtn.onclick = () => {
            window.location.href = 'login.html';
        };
    }
    
    if (loginBtnNav) {
        loginBtnNav.onclick = () => {
            window.location.href = 'login.html';
        };
    }

    localStorage.removeItem('isAdmin');
    localStorage.removeItem('adminName');
}

// Logout
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

// Setup Upload Area (Drag & Drop)
function setupUploadArea() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const addLinkBtn = document.getElementById('addLinkBtn');

    if (!dropZone || !fileInput || !addLinkBtn) return;

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            openUploadModal(e.target.files[0]);
        }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            openUploadModal(files[0]);
        }
    });

    // Add link button
    addLinkBtn.addEventListener('click', () => {
        openUploadModal(null);
    });
}

// Setup Modal
function setupModal() {
    const modal = document.getElementById('uploadModal');
    const closeBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const submitBtn = document.getElementById('submitBtn');
    const fileInput2 = document.getElementById('fileInput2');

    if (!modal) return;

    // Close modal
    closeBtn.addEventListener('click', () => {
        closeUploadModal();
    });

    cancelBtn.addEventListener('click', () => {
        closeUploadModal();
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeUploadModal();
        }
    });

    // File input change
    fileInput2.addEventListener('change', (e) => {
        const fileNameDisplay = document.getElementById('fileNameDisplay2');
        if (e.target.files.length > 0) {
            uploadModal.selectedFile = e.target.files[0];
            fileNameDisplay.textContent = e.target.files[0].name;
        } else {
            uploadModal.selectedFile = null;
            fileNameDisplay.textContent = 'No file selected';
        }
    });

    // Submit
    submitBtn.addEventListener('click', () => {
        submitUpload();
    });
}

// Open Upload Modal
function openUploadModal(file = null) {
    const modal = document.getElementById('uploadModal');
    const sectionSelect = document.getElementById('sectionSelect');
    const fileInput2 = document.getElementById('fileInput2');
    const fileNameDisplay = document.getElementById('fileNameDisplay2');

    // Reset form
    sectionSelect.value = '';
    document.getElementById('descriptionInput').value = '';
    document.getElementById('documentLinkInput').value = '';
    document.getElementById('videoLinkInput').value = '';
    fileInput2.value = '';

    // Set file if provided
    if (file) {
        uploadModal.selectedFile = file;
        fileNameDisplay.textContent = file.name;
    } else {
        uploadModal.selectedFile = null;
        fileNameDisplay.textContent = 'No file selected';
    }

    modal.style.display = 'block';
}

// Close Upload Modal
function closeUploadModal() {
    const modal = document.getElementById('uploadModal');
    modal.style.display = 'none';
    uploadModal.selectedFile = null;
}

// Submit Upload
async function submitUpload() {
    const section = document.getElementById('sectionSelect').value;
    const description = document.getElementById('descriptionInput').value;
    const documentLink = document.getElementById('documentLinkInput').value;
    const videoLink = document.getElementById('videoLinkInput').value;
    const file = uploadModal.selectedFile;

    // Validation
    if (!section) {
        alert('Please select a section');
        return;
    }

    if (!description.trim()) {
        alert('Please enter a title/description');
        return;
    }

    if (!file && !documentLink.trim() && !videoLink.trim()) {
        alert('Please provide at least one resource (file or link)');
        return;
    }

    try {
        if (file) {
            // Upload file
            const formData = new FormData();
            formData.append('file', file);
            formData.append('section', section);
            formData.append('description', description);

            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                alert('Failed to upload file. Please try again.');
                return;
            }
        }

        if (documentLink.trim() || videoLink.trim()) {
            // Upload links
            const response = await fetch('/upload/link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    section,
                    description,
                    documentLink: documentLink.trim() || null,
                    videoLink: videoLink.trim() || null,
                }),
            });

            if (!response.ok) {
                alert('Failed to add links. Please try again.');
                return;
            }
        }

        alert('Resource added successfully!');
        closeUploadModal();
        loadResources();
    } catch (error) {
        console.error('Upload error:', error);
        alert('Error uploading resource. Please try again.');
    }
}

// Load Resources from all sections
async function loadResources() {
    try {
        // Fetch resources for each section
        const sections = [
            { id: 'general', name: 'General Resources' },
            { id: 'semester252', name: 'Semester 252' },
            { id: 'semester261', name: 'Semester 261' },
        ];

        for (const section of sections) {
            const response = await fetch(`/resources?section=${section.id}`);
            const resources = await response.json();

            // Find the section container and update it
            const sectionElement = document.querySelector(
                `#${section.id}Section`
            );

            if (sectionElement) {
                // Clear existing content
                sectionElement.innerHTML = '';

                if (resources && resources.length > 0) {
                    resources.forEach((resource, index) => {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'resource-item-wrapper';
                        if (isAdmin) wrapper.classList.add('admin');

                        const div = document.createElement('div');
                        div.className = 'resource-item';

                        let html = `<h3 class="resource-title">${escapeHtml(resource.title || resource.description)}</h3>`;

                        const resourceLinks = [];

                        // File download link
                        if (resource.file) {
                            resourceLinks.push(
                                `<a href="/uploads/${encodeURIComponent(resource.file)}" download class="resource-link-btn file">Download</a>`
                            );
                        }

                        // Document link
                        if (resource.documentLink) {
                            resourceLinks.push(
                                `<a href="${escapeHtml(resource.documentLink)}" target="_blank" class="resource-link-btn document">Document</a>`
                            );
                        }

                        // Video link
                        if (resource.videoLink) {
                            resourceLinks.push(
                                `<a href="${escapeHtml(resource.videoLink)}" target="_blank" class="resource-link-btn video">Video</a>`
                            );
                        }

                        if (resourceLinks.length > 0) {
                            html += `<div class="resource-links">${resourceLinks.join('')}</div>`;
                        }

                        div.innerHTML = html;
                        wrapper.appendChild(div);

                        // Add delete button for admin
                        if (isAdmin) {
                            const deleteDiv = document.createElement('div');
                            deleteDiv.className = 'resource-item-delete';
                            deleteDiv.innerHTML = `<button class="delete-btn" onclick="deleteResource('${section.id}', ${index})">Delete</button>`;
                            wrapper.appendChild(deleteDiv);
                        }

                        sectionElement.appendChild(wrapper);
                    });
                } else {
                    sectionElement.innerHTML =
                        '<p style="color: #94A3B8; text-align: center; padding: 20px;">No resources added yet.</p>';
                }
            }
        }
    } catch (error) {
        console.error('Error loading resources:', error);
    }
}

// Delete Resource
async function deleteResource(section, index) {
    if (!isAdmin) {
        alert('You do not have permission to delete resources.');
        return;
    }

    if (!confirm('Are you sure you want to delete this resource?')) {
        return;
    }

    try {
        const response = await fetch('/resources/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                section,
                index,
            }),
        });

        if (response.ok) {
            alert('Resource deleted successfully!');
            loadResources();
        } else {
            alert('Failed to delete resource. Please try again.');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Error deleting resource. Please try again.');
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

