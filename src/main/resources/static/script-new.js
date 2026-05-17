let isAdmin = false;
let adminName = '';
let uploadModal = { selectedFiles: [], mode: 'add', section: null, index: null };
let resourcesBySection = {};
let activeSearchTerm = '';
let activeTypeFilter = 'all';
let activePeriodFilter = 'all';
let activeOwnerFilter = 'all';
let activeSort = 'newest';
let activeView = 'dashboard';
let showFavoritesOnly = false;
let favoriteIds = new Set(JSON.parse(localStorage.getItem('favoriteResources') || '[]'));
let activeUploadRequest = null;

const sections = [
    { id: 'general', name: 'General Resources' },
    { id: 'semester252', name: 'Semester 252' },
    { id: 'semester261', name: 'Semester 261' }
];

const resourceTemplates = {
    lecture: {
        title: 'Lecture slides',
        smallDescription: 'Slides and notes for class review'
    },
    assignment: {
        title: 'Assignment brief',
        smallDescription: 'Instructions, starter files, and submission notes'
    },
    reference: {
        title: 'Reference material',
        smallDescription: 'Supporting reading or external documentation'
    }
};

const maxUploadBytes = 50 * 1024 * 1024;

document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
    setupUploadArea();
    setupModal();
    setupResourceTools();
    setupNavigation();
    setupPreviewModal();
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
        <span class="admin-label">Welcome, ${escapeHtml(name)}</span>
        <button class="btn-outline" id="logoutBtn">Logout</button>
    `;
    document.getElementById('adminToolbar').style.display = 'block';
    document.getElementById('templateStrip').style.display = 'flex';
    document.getElementById('loginBtnNav').style.display = 'none';
    document.getElementById('logoutBtn').addEventListener('click', logout);
    updateSessionState();
}

function clearAdminMode() {
    setupPublicMode();
}

function setupPublicMode() {
    isAdmin = false;
    document.getElementById('adminSection').style.display = 'none';
    document.getElementById('adminToolbar').style.display = 'none';
    document.getElementById('templateStrip').style.display = 'none';
    document.getElementById('loginBtnNav').style.display = 'block';
    document.getElementById('loginBtnNav').addEventListener('click', () => {
        window.location.href = 'login.html';
    });
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('adminName');
    updateSessionState();
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
    const dropZone = document.getElementById('dropZone');

    closeBtn.addEventListener('click', closeUploadModal);
    cancelBtn.addEventListener('click', () => {
        if (activeUploadRequest) {
            activeUploadRequest.abort();
            activeUploadRequest = null;
            setUploadStatus('Cancelled');
            renderUploadQueue('cancelled');
            return;
        }

        closeUploadModal();
    });
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeUploadModal();
    });

    fileInput2.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            setSelectedFiles([...e.target.files]);
        }
    });

    dropZone.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropZone.classList.add('dragging');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragging');
    });

    dropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        dropZone.classList.remove('dragging');
        if (event.dataTransfer.files.length > 0) {
            setSelectedFiles([...event.dataTransfer.files]);
        }
    });

    submitBtn.addEventListener('click', submitUpload);
}

function setupResourceTools() {
    const searchInput = document.getElementById('resourceSearch');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const typeFilter = document.getElementById('typeFilter');
    const periodFilter = document.getElementById('periodFilter');
    const ownerFilter = document.getElementById('ownerFilter');
    const sortSelect = document.getElementById('sortSelect');
    const favoritesFilterBtn = document.getElementById('favoritesFilterBtn');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const templateButtons = document.querySelectorAll('.template-btn');

    searchInput.addEventListener('input', (event) => {
        activeSearchTerm = event.target.value.trim().toLowerCase();
        renderResources();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        activeSearchTerm = '';
        renderResources();
    });

    typeFilter.addEventListener('change', (event) => {
        activeTypeFilter = event.target.value;
        renderResources();
    });

    periodFilter.addEventListener('change', (event) => {
        activePeriodFilter = event.target.value;
        renderResources();
    });

    ownerFilter.addEventListener('change', (event) => {
        activeOwnerFilter = event.target.value;
        renderResources();
    });

    sortSelect.addEventListener('change', (event) => {
        activeSort = event.target.value;
        renderResources();
    });

    favoritesFilterBtn.addEventListener('click', () => {
        showFavoritesOnly = !showFavoritesOnly;
        favoritesFilterBtn.classList.toggle('active', showFavoritesOnly);
        favoritesFilterBtn.setAttribute('aria-pressed', String(showFavoritesOnly));
        renderResources();
    });

    templateButtons.forEach((button) => {
        button.addEventListener('click', () => openUploadModal(null, button.dataset.template));
    });

    resetFiltersBtn.addEventListener('click', resetFilters);
}

function setupNavigation() {
    document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            setActiveView(item.dataset.view);
        });
    });
}

function setupPreviewModal() {
    const previewModal = document.getElementById('previewModal');
    const closePreviewModal = document.getElementById('closePreviewModal');

    closePreviewModal.addEventListener('click', closePreview);
    window.addEventListener('click', (event) => {
        if (event.target === previewModal) closePreview();
    });
}

function setActiveView(view) {
    activeView = view;
    document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
        item.classList.toggle('active', item.dataset.view === view);
    });
    renderResources();
}

function openUploadModal(file = null, templateKey = null) {
    const template = resourceTemplates[templateKey] || {};
    uploadModal = { selectedFiles: file ? [file] : [], mode: 'add', section: null, index: null };
    document.querySelector('#uploadModal .modal-header h2').textContent = 'Add Resource';
    document.getElementById('submitBtn').textContent = 'Add Resource';
    document.getElementById('sectionSelect').value = '';
    document.getElementById('descriptionInput').value = template.title || '';
    document.getElementById('smallDescriptionInput').value = template.smallDescription || '';
    document.getElementById('documentLinkInput').value = '';
    document.getElementById('videoLinkInput').value = '';
    document.getElementById('fileInput2').value = '';
    updateFileNameDisplay();
    renderUploadQueue('waiting');
    setUploadStatus('');
    document.getElementById('uploadModal').classList.add('active');
}

function openEditModal(section, index) {
    const resource = resourcesBySection[section]?.[index];
    if (!resource || !isAdmin) return;

    uploadModal = { selectedFiles: [], mode: 'edit', section, index };
    document.querySelector('#uploadModal .modal-header h2').textContent = 'Edit Resource';
    document.getElementById('submitBtn').textContent = 'Save Changes';
    document.getElementById('sectionSelect').value = section;
    document.getElementById('descriptionInput').value = resource.title || resource.description || '';
    document.getElementById('smallDescriptionInput').value = resource.smallDescription || '';
    document.getElementById('documentLinkInput').value = resource.documentLink || '';
    document.getElementById('videoLinkInput').value = resource.videoLink || '';
    document.getElementById('fileInput2').value = '';
    document.getElementById('fileNameDisplay2').textContent = resource.file ? `Current file: ${resource.file}` : 'No file selected';
    renderUploadQueue('waiting');
    setUploadStatus('');
    document.getElementById('uploadModal').classList.add('active');
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.remove('active');
    uploadModal = { selectedFiles: [], mode: 'add', section: null, index: null };
    activeUploadRequest = null;
    renderUploadQueue('waiting');
}

async function submitUpload() {
    const submitBtn = document.getElementById('submitBtn');
    const section = document.getElementById('sectionSelect').value;
    const description = document.getElementById('descriptionInput').value;
    const smallDescription = document.getElementById('smallDescriptionInput').value;
    const documentLink = document.getElementById('documentLinkInput').value;
    const videoLink = document.getElementById('videoLinkInput').value;
    const files = uploadModal.selectedFiles;

    if (!section || !description.trim()) {
        setUploadStatus('Please select a section and enter a title');
        return;
    }

    if (uploadModal.mode === 'add' && files.length === 0 && !documentLink.trim() && !videoLink.trim()) {
        setUploadStatus('Please provide a file, document link, or video link');
        return;
    }

    try {
        submitBtn.textContent = uploadModal.mode === 'edit' ? 'Save Changes' : 'Add Resource';
        let endpoint = '/upload';
        if (uploadModal.mode === 'edit') {
            endpoint = '/resources/update';
        }

        const uploadFiles = uploadModal.mode === 'add' && files.length > 1 ? files : [files[0] || null];
        for (let i = 0; i < uploadFiles.length; i += 1) {
            const formData = new FormData();
            const uploadTitle = uploadFiles.length > 1 && uploadFiles[i] ? `${description.trim()} - ${uploadFiles[i].name}` : description.trim();

            formData.append('section', section);
            formData.append('description', uploadTitle);
            formData.append('smallDescription', smallDescription.trim());
            formData.append('documentLink', uploadFiles.length > 1 ? '' : documentLink.trim());
            formData.append('videoLink', uploadFiles.length > 1 ? '' : videoLink.trim());

            if (uploadFiles[i]) {
                formData.append('file', uploadFiles[i]);
            }

            if (uploadModal.mode === 'edit') {
                formData.append('originalSection', uploadModal.section);
                formData.append('index', uploadModal.index);
            }

            const result = await sendResourceForm(endpoint, formData, uploadFiles.length, i + 1);
            if (result.status !== 'success') {
                renderUploadQueue('failed');
                setUploadStatus(result.message || (uploadModal.mode === 'edit' ? 'Failed to update resource' : 'Failed to add resource'));
                submitBtn.textContent = 'Retry Upload';
                return;
            }
        }

        renderUploadQueue('completed');
        showToast(uploadModal.mode === 'edit' ? 'Resource updated' : 'Upload completed');
        closeUploadModal();
        loadResources();
    } catch (error) {
        if (error.name === 'AbortError') return;
        renderUploadQueue('failed');
        setUploadStatus(uploadModal.mode === 'edit' ? 'Error updating resource' : 'Error uploading resource');
        submitBtn.textContent = 'Retry Upload';
    }
}

async function loadResources() {
    for (const section of sections) {
        try {
            const response = await fetch(`/resources?section=${section.id}`);
            const resources = await response.json();
            resourcesBySection[section.id] = resources || [];
        } catch (error) {
            console.error('Error loading resources:', error);
            resourcesBySection[section.id] = [];
        }
    }

    renderResources();
}

async function deleteResource(section, index) {
    if (!confirm('Delete this resource?')) return;
    
    try {
        const response = await fetch('/resources/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section, index })
        });
        const result = await response.json();
        showToast(result.message || 'Resource deleted');
        loadResources();
    } catch (error) {
        showToast('Error deleting resource');
    }
}

function renderResources() {
    renderDashboardSummary();
    renderViewVisibility();

    sections.forEach((section) => {
        const container = document.getElementById(`${section.id}Section`);
        const resources = resourcesBySection[section.id] || [];

        if (!container) return;

        const visibleResources = resources
            .map((resource, index) => ({ resource, index }))
            .filter(({ resource, index }) => resourceMatchesFilters(section, resource, index))
            .sort(compareResources);

        container.innerHTML = '';

        if (visibleResources.length === 0) {
            container.innerHTML = emptyStateText(resources.length);
            return;
        }

        visibleResources.forEach(({ resource, index }) => {
            container.insertAdjacentHTML('beforeend', renderResourceCard(section, resource, index));
        });
    });
}

function renderViewVisibility() {
    sections.forEach((section) => {
        const element = document.getElementById(section.id);
        const shouldShow = activeView === 'dashboard'
            || activeView === section.id
            || activeView === 'favorites'
            || activeView === 'recent';
        element.style.display = shouldShow ? 'block' : 'none';
    });

    const settings = document.getElementById('settings');
    settings.style.display = activeView === 'settings' ? 'block' : 'none';
}

function renderDashboardSummary() {
    const summary = document.getElementById('dashboardSummary');
    const resources = getAllResourceEntries();
    const fileCount = resources.filter(({ resource }) => resource.file).length;
    const favoriteCount = resources.filter(({ section, resource, index }) => favoriteIds.has(getFavoriteId(section.id, resource, index))).length;
    const totalDownloads = resources.reduce((sum, { resource }) => sum + Number(resource.downloadCount || 0), 0);
    const recentCount = resources.filter(({ resource }) => isWithinPeriod(resource.uploadDate, 'week')).length;

    summary.innerHTML = `
        <div class="summary-item"><strong>${resources.length}</strong><span>Resources</span></div>
        <div class="summary-item"><strong>${fileCount}</strong><span>Files</span></div>
        <div class="summary-item"><strong>${favoriteCount}</strong><span>Favorites</span></div>
        <div class="summary-item"><strong>${recentCount}</strong><span>New this week</span></div>
        <div class="summary-item"><strong>${totalDownloads}</strong><span>Downloads</span></div>
    `;
}

function renderResourceCard(section, resource, index) {
    const favoriteId = getFavoriteId(section.id, resource, index);
    const isFavorite = favoriteIds.has(favoriteId);
    const resourceType = getResourceType(resource);
    const uploaded = formatDate(resource.uploadDate);
    const size = formatBytes(resource.fileSize);
    const downloads = Number(resource.downloadCount || 0);

    return `
        <div class="card ${isAdmin ? 'editable-card' : ''}" ${isAdmin ? `onclick="openEditModal('${section.id}', ${index})" title="Edit resource"` : ''}>
            <button class="favorite-btn ${isFavorite ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite(decodeURIComponent('${encodeURIComponent(favoriteId)}'))" title="${isFavorite ? 'Remove favorite' : 'Add favorite'}" aria-pressed="${isFavorite}">${isFavorite ? 'Favorite' : 'Favorite'}</button>
            ${isAdmin ? `<button class="card-delete" onclick="event.stopPropagation(); deleteResource('${section.id}', ${index})" title="Delete resource">&times;</button>` : ''}
            <div class="card-top">
                <span class="resource-icon">${escapeHtml(resourceType)}</span>
                <div>
                    <h3>${escapeHtml(resource.title || resource.description)}</h3>
                    <p class="card-meta">${escapeHtml(section.name)}${uploaded ? ` • ${uploaded}` : ''}</p>
                    ${resource.smallDescription ? `<p class="card-description">${escapeHtml(resource.smallDescription)}</p>` : ''}
                </div>
            </div>
            <dl class="resource-metadata">
                <div><dt>Owner</dt><dd>${escapeHtml(resource.owner || 'standard-user')}</dd></div>
                <div><dt>Size</dt><dd>${escapeHtml(size || 'Link')}</dd></div>
                <div><dt>Downloads</dt><dd>${downloads}</dd></div>
            </dl>
            <div class="card-links">
                ${resource.file ? `<button type="button" onclick="event.stopPropagation(); previewResource(decodeURIComponent('${encodeURIComponent(resource.file)}'), decodeURIComponent('${encodeURIComponent(resource.title || resource.description || resource.file)}'))" class="card-link secondary">Preview</button>` : ''}
                ${resource.file ? `<button type="button" onclick="event.stopPropagation(); downloadResource(decodeURIComponent('${encodeURIComponent(resource.file)}'))" class="card-link primary">Download</button>` : ''}
                ${resource.documentLink ? `<a href="${escapeAttribute(resource.documentLink)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="card-link secondary">Open Link</a>` : ''}
                ${resource.videoLink ? `<a href="${escapeAttribute(resource.videoLink)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="card-link accent">Video</a>` : ''}
            </div>
        </div>
    `;
}

function resourceMatchesFilters(section, resource, index) {
    const favoriteId = getFavoriteId(section.id, resource, index);
    if ((showFavoritesOnly || activeView === 'favorites') && !favoriteIds.has(favoriteId)) return false;
    if (activeView === 'recent' && !isRecentResource(resource)) return false;
    if (activeView !== 'dashboard' && activeView !== 'favorites' && activeView !== 'recent' && activeView !== section.id) return false;
    if (activeTypeFilter !== 'all' && !resourceMatchesType(resource)) return false;
    if (activePeriodFilter !== 'all' && !isWithinPeriod(resource.uploadDate, activePeriodFilter)) return false;
    if (activeOwnerFilter === 'mine' && resource.owner !== adminName) return false;
    if (!activeSearchTerm) return true;

    const searchable = [
        section.name,
        resource.title,
        resource.description,
        resource.smallDescription,
        resource.file,
        resource.owner,
        resource.fileType,
        resource.originalFileName,
        resource.documentLink ? 'document preview link' : '',
        resource.videoLink ? 'video link' : '',
        resource.file ? 'download file' : ''
    ].filter(Boolean).join(' ').toLowerCase();

    return searchable.includes(activeSearchTerm) || fuzzyMatches(searchable, activeSearchTerm);
}

function resourceMatchesType(resource) {
    if (activeTypeFilter === 'file') return Boolean(resource.file);
    if (activeTypeFilter === 'image') return isImageFile(resource.file);
    if (activeTypeFilter === 'pdf') return getExtension(resource.file) === 'pdf';
    if (activeTypeFilter === 'text') return ['txt', 'md', 'csv'].includes(getExtension(resource.file));
    if (activeTypeFilter === 'document') return Boolean(resource.documentLink);
    if (activeTypeFilter === 'video') return Boolean(resource.videoLink);
    return true;
}

function compareResources(a, b) {
    if (activeSort === 'title') {
        return String(a.resource.title || a.resource.description || '').localeCompare(String(b.resource.title || b.resource.description || ''));
    }

    if (activeSort === 'type') {
        return getResourceType(a.resource).localeCompare(getResourceType(b.resource));
    }

    if (activeSort === 'size') {
        return Number(b.resource.fileSize || 0) - Number(a.resource.fileSize || 0);
    }

    if (activeSort === 'downloads') {
        return Number(b.resource.downloadCount || 0) - Number(a.resource.downloadCount || 0);
    }

    if (activeSort === 'recent') {
        return dateValue(b.resource.recentlyAccessed || b.resource.uploadDate) - dateValue(a.resource.recentlyAccessed || a.resource.uploadDate);
    }

    return dateValue(b.resource.uploadDate) - dateValue(a.resource.uploadDate) || b.index - a.index;
}

function toggleFavorite(favoriteId) {
    if (favoriteIds.has(favoriteId)) favoriteIds.delete(favoriteId);
    else favoriteIds.add(favoriteId);

    localStorage.setItem('favoriteResources', JSON.stringify([...favoriteIds]));
    showToast(favoriteIds.has(favoriteId) ? 'Added to favorites' : 'Removed from favorites');
    renderResources();
}

async function downloadResource(fileName) {
    try {
        showToast('Starting download...');
        const response = await fetch(`/download/${encodeURIComponent(fileName)}`);
        if (!response.ok) throw new Error('Download failed');

        const contentLength = Number(response.headers.get('Content-Length')) || 0;
        const reader = response.body.getReader();
        const chunks = [];
        let receivedLength = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            receivedLength += value.length;

            if (contentLength > 0) {
                const percent = Math.round((receivedLength / contentLength) * 100);
                showToast(`Downloading ${percent}%`);
            }
        }

        const blob = new Blob(chunks);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showToast('Download ready');
        loadResources();
    } catch (error) {
        showToast('Download failed. Please try again.');
    }
}

async function previewResource(fileName, title) {
    const extension = getExtension(fileName);
    const url = `/uploads/${encodeURIComponent(fileName)}`;
    const previewBody = document.getElementById('previewBody');
    document.getElementById('previewTitle').textContent = title;

    if (isImageFile(fileName)) {
        previewBody.innerHTML = `<img src="${url}" alt="${escapeAttribute(title)}">`;
    } else if (extension === 'pdf') {
        previewBody.innerHTML = `<iframe src="${url}" title="${escapeAttribute(title)}"></iframe>`;
    } else if (['txt', 'md', 'csv'].includes(extension)) {
        previewBody.innerHTML = '<div class="preview-loading">Loading preview...</div>';
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Preview failed');
            const text = await response.text();
            previewBody.innerHTML = `<pre>${escapeHtml(text.slice(0, 20000))}</pre>`;
        } catch (error) {
            previewBody.innerHTML = '<div class="empty-state">Preview is unavailable for this file.</div>';
        }
    } else {
        previewBody.innerHTML = '<div class="empty-state">Preview is not supported for this file type.</div>';
    }

    document.getElementById('previewModal').classList.add('active');
}

function closePreview() {
    document.getElementById('previewModal').classList.remove('active');
    document.getElementById('previewBody').innerHTML = '';
}

function getFavoriteId(sectionId, resource, index) {
    if (resource.id) return resource.id;

    return [
        sectionId,
        resource.title || resource.description || 'untitled',
        resource.file || resource.documentLink || resource.videoLink || index
    ].join('|');
}

function getResourceType(resource) {
    if (resource.fileType) return resource.fileType.slice(0, 4);
    if (resource.videoLink && !resource.file && !resource.documentLink) return 'VID';
    if (resource.documentLink && !resource.file) return 'LINK';
    return 'DOC';
}

function emptyStateText(hasResources) {
    if (showFavoritesOnly) return '<div class="empty-state">No favorites match this view.</div>';
    if (activeSearchTerm) return '<div class="empty-state">No resources match your search.</div>';
    if (!hasResources) return '<div class="empty-state">No resources yet.</div>';
    return '<div class="empty-state">No resources match this view.</div>';
}

function sendResourceForm(endpoint, formData, totalItems = 1, currentItem = 1) {
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    setUploadStatus(totalItems > 1 ? `Waiting: resource ${currentItem} of ${totalItems}` : 'Waiting');
    renderUploadQueue('waiting', currentItem);

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        activeUploadRequest = xhr;
        xhr.open('POST', endpoint);

        xhr.upload.addEventListener('progress', (event) => {
            if (!event.lengthComputable) return;
            const percent = Math.round((event.loaded / event.total) * 100);
            const prefix = totalItems > 1 ? `File ${currentItem} of ${totalItems}: ` : '';
            setUploadStatus(`${prefix}Uploading ${percent}%`);
            renderUploadQueue('uploading', currentItem, percent);
        });

        xhr.addEventListener('load', () => {
            submitBtn.disabled = false;
            activeUploadRequest = null;
            try {
                const result = JSON.parse(xhr.responseText || '{}');
                renderUploadQueue(result.status === 'success' ? 'processing' : 'failed', currentItem);
                resolve(xhr.status >= 200 && xhr.status < 300 ? result : { status: 'error', message: result.message });
            } catch (error) {
                reject(error);
            }
        });

        xhr.addEventListener('error', () => {
            submitBtn.disabled = false;
            activeUploadRequest = null;
            reject(new Error('Upload failed'));
        });

        xhr.addEventListener('abort', () => {
            submitBtn.disabled = false;
            activeUploadRequest = null;
            const error = new Error('Upload cancelled');
            error.name = 'AbortError';
            reject(error);
        });

        xhr.send(formData);
    });
}

function setSelectedFiles(files) {
    const oversizedFile = files.find((file) => file.size > maxUploadBytes);
    if (oversizedFile) {
        setUploadStatus(`${oversizedFile.name} is larger than the 50 MB upload limit`);
        return;
    }

    const unsupportedFile = files.find((file) => !isAllowedUpload(file.name));
    if (unsupportedFile) {
        setUploadStatus(`${unsupportedFile.name} uses an unsupported file format`);
        return;
    }

    uploadModal.selectedFiles = uploadModal.mode === 'edit' ? files.slice(0, 1) : files;
    updateFileNameDisplay();
    renderUploadQueue('waiting');
}

function updateFileNameDisplay() {
    const fileNameDisplay = document.getElementById('fileNameDisplay2');
    const files = uploadModal.selectedFiles;

    if (files.length === 0) {
        fileNameDisplay.textContent = 'No file selected';
    } else if (files.length === 1) {
        fileNameDisplay.textContent = files[0].name;
    } else {
        fileNameDisplay.textContent = `${files.length} files selected`;
    }
}

function setUploadStatus(message) {
    const uploadStatus = document.getElementById('uploadStatus');
    uploadStatus.textContent = message;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => {
        toast.classList.remove('show');
    }, 2400);
}

function renderUploadQueue(status = 'waiting', activeIndex = 1, percent = 0) {
    const queue = document.getElementById('uploadQueue');
    if (!queue) return;

    if (uploadModal.selectedFiles.length === 0) {
        queue.innerHTML = '';
        return;
    }

    queue.innerHTML = uploadModal.selectedFiles.map((file, index) => {
        const itemStatus = index + 1 === activeIndex ? status : 'waiting';
        const progress = itemStatus === 'completed' ? 100 : (index + 1 === activeIndex ? percent : 0);
        return `
            <div class="queue-item">
                <div>
                    <strong>${escapeHtml(file.name)}</strong>
                    <span>${escapeHtml(formatBytes(file.size))} • ${escapeHtml(capitalize(itemStatus))}</span>
                </div>
                <progress max="100" value="${progress}"></progress>
            </div>
        `;
    }).join('');
}

function resetFilters() {
    document.getElementById('resourceSearch').value = '';
    document.getElementById('typeFilter').value = 'all';
    document.getElementById('periodFilter').value = 'all';
    document.getElementById('ownerFilter').value = 'all';
    document.getElementById('sortSelect').value = 'newest';
    activeSearchTerm = '';
    activeTypeFilter = 'all';
    activePeriodFilter = 'all';
    activeOwnerFilter = 'all';
    activeSort = 'newest';
    showFavoritesOnly = false;
    document.getElementById('favoritesFilterBtn').classList.remove('active');
    document.getElementById('favoritesFilterBtn').setAttribute('aria-pressed', 'false');
    renderResources();
    showToast('Filters reset');
}

function updateSessionState() {
    const sessionState = document.getElementById('sessionState');
    if (!sessionState) return;
    sessionState.textContent = isAdmin ? `Signed in as ${adminName}. Admin tools are available.` : 'Browsing as a standard user. Sign in to manage resources.';
}

function getAllResourceEntries() {
    return sections.flatMap((section) => (resourcesBySection[section.id] || []).map((resource, index) => ({ section, resource, index })));
}

function isRecentResource(resource) {
    return isWithinPeriod(resource.recentlyAccessed || resource.uploadDate, 'week') || isWithinPeriod(resource.uploadDate, 'week');
}

function isWithinPeriod(value, period) {
    if (!value) return false;
    if (period === 'all') return true;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (period === 'today') return date.toDateString() === now.toDateString();
    if (period === 'week') return diff <= 7 * 24 * 60 * 60 * 1000;
    if (period === 'month') return diff <= 30 * 24 * 60 * 60 * 1000;
    return true;
}

function dateValue(value) {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getExtension(fileName = '') {
    const cleanName = String(fileName).split('?')[0].toLowerCase();
    const dotIndex = cleanName.lastIndexOf('.');
    return dotIndex >= 0 ? cleanName.slice(dotIndex + 1) : '';
}

function isImageFile(fileName) {
    return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(getExtension(fileName));
}

function isAllowedUpload(fileName) {
    return ['pdf', 'txt', 'md', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'zip'].includes(getExtension(fileName));
}

function capitalize(value) {
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function fuzzyMatches(searchable, term) {
    if (term.length < 3) return false;
    const queryTokens = term.split(/\s+/).filter(Boolean);
    const sourceTokens = searchable.split(/[^a-z0-9]+/).filter(Boolean);

    return queryTokens.every((query) => sourceTokens.some((token) => {
        if (token.includes(query) || query.includes(token)) return true;
        return levenshteinDistance(token.slice(0, Math.max(query.length + 1, 4)), query) <= 1;
    }));
}

function levenshteinDistance(a, b) {
    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

    for (let i = 1; i <= a.length; i += 1) {
        const current = [i];
        for (let j = 1; j <= b.length; j += 1) {
            current[j] = Math.min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
        previous.splice(0, previous.length, ...current);
    }

    return previous[b.length];
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function escapeAttribute(text) {
    return escapeHtml(text).replace(/`/g, '&#096;');
}
