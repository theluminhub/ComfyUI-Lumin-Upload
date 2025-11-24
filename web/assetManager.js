import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// Initialize module state
const AssetManagerSystem = {
    isInitialized: false,
    settings: {
        apiKey: '',
        organization: ''
    },
    state: {
        extensionActive: false,
        uploadMode: 'manual',
        selectedProject: '',
        selectedOrganization: '',
        uploadedAssets: new Set(), 
        hiddenAssets: new Set(),
        knownFiles: new Set() 
    },
    automaticUploadTimeout: null 
};

function createAssetManagerModal() {
    if (document.getElementById('asset-manager-modal-overlay')) {
        return document.getElementById('asset-manager-modal-overlay');
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'asset-manager-modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        display: none;
    `;

    const modalDialog = document.createElement('div');
    modalDialog.id = 'asset-manager-modal-dialog';
    modalDialog.style.cssText = `
        background-color: #222;
        border-radius: 5px;
        padding: 20px;
        width: 900px;
        max-width: 90%;
        max-height: 80%;
        overflow-y: auto;
        box-shadow: 0 0 15px rgba(0, 0, 0, 0.3);
        position: relative;
    `;

    const modalContent = document.createElement('div');

    const topCloseButton = document.createElement('button');
    topCloseButton.textContent = '×';
    topCloseButton.title = 'Close';
    topCloseButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background-color: transparent;
        border: none;
        color: #aaa;
        font-size: 32px;
        line-height: 1;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
        transition: all 0.2s;
    `;
    topCloseButton.onmouseenter = (e) => {
        e.currentTarget.style.backgroundColor = '#444';
        e.currentTarget.style.color = '#fff';
    };
    topCloseButton.onmouseleave = (e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = '#aaa';
    };
    topCloseButton.onclick = () => {
        modalOverlay.style.display = 'none';
    };

    const title = document.createElement('h3');
    title.textContent = 'Asset Manager';
    title.style.cssText = `
        margin-top: 0;
        margin-bottom: 15px;
        color: #fff;
    `;

    const tabContainer = document.createElement('div');
    tabContainer.style.cssText = `
        display: flex;
        border-bottom: 1px solid #444;
        margin-bottom: 20px;
    `;

    const mainTabBtn = document.createElement('button');
    mainTabBtn.textContent = 'Main';
    mainTabBtn.id = 'asset-manager-main-tab';
    mainTabBtn.className = 'asset-manager-tab active';
    mainTabBtn.style.cssText = `
        padding: 10px 20px;
        background-color: transparent;
        border: none;
        border-bottom: 2px solid #588157;
        color: #fff;
        cursor: pointer;
        font-size: 14px;
    `;

    const settingsTabBtn = document.createElement('button');
    settingsTabBtn.textContent = 'Settings';
    settingsTabBtn.id = 'asset-manager-settings-tab';
    settingsTabBtn.className = 'asset-manager-tab';
    settingsTabBtn.style.cssText = `
        padding: 10px 20px;
        background-color: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 14px;
    `;

    tabContainer.appendChild(mainTabBtn);
    tabContainer.appendChild(settingsTabBtn);

    const mainContent = document.createElement('div');
    mainContent.id = 'asset-manager-main-content';
    mainContent.style.display = 'block';

    const settingsContent = document.createElement('div');
    settingsContent.id = 'asset-manager-settings-content';
    settingsContent.style.display = 'none';

    buildMainContent(mainContent);

    buildSettingsContent(settingsContent);

    mainTabBtn.onclick = () => {
        mainTabBtn.style.borderBottomColor = '#588157';
        mainTabBtn.style.color = '#fff';
        settingsTabBtn.style.borderBottomColor = 'transparent';
        settingsTabBtn.style.color = '#aaa';
        mainContent.style.display = 'block';
        settingsContent.style.display = 'none';
    };

    settingsTabBtn.onclick = () => {
        settingsTabBtn.style.borderBottomColor = '#588157';
        settingsTabBtn.style.color = '#fff';
        mainTabBtn.style.borderBottomColor = 'transparent';
        mainTabBtn.style.color = '#aaa';
        mainContent.style.display = 'none';
        settingsContent.style.display = 'block';
    };

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
        padding: 8px 15px;
        background-color: #444;
        border: none;
        border-radius: 3px;
        color: #fff;
        cursor: pointer;
        margin-top: 20px;
        margin-bottom: 20px;
        float: right;
    `;
    closeButton.onclick = () => {
        modalOverlay.style.display = 'none';
    };

    modalContent.appendChild(title);
    modalContent.appendChild(tabContainer);
    modalContent.appendChild(mainContent);
    modalContent.appendChild(settingsContent);
    modalContent.appendChild(closeButton);

    modalDialog.appendChild(topCloseButton);
    modalDialog.appendChild(modalContent);
    modalOverlay.appendChild(modalDialog);
    document.body.appendChild(modalOverlay);

    return modalOverlay;
}

function buildMainContent(container) {
    container.innerHTML = '';

    const uploadModeContainer = document.createElement('div');
    uploadModeContainer.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding: 15px;
        background-color: #2a2a2a;
        border-radius: 5px;
    `;

    const uploadModeLabel = document.createElement('label');
    uploadModeLabel.textContent = 'Upload Mode:';
    uploadModeLabel.style.cssText = `
        color: #fff;
        font-weight: bold;
    `;

    const uploadModeToggle = createModeToggle('asset-manager-upload-mode-toggle', AssetManagerSystem.state.uploadMode, (value) => {
        AssetManagerSystem.state.uploadMode = value;

        saveAssetState();

        const capturedContent = document.getElementById('asset-manager-captured-content-container');
        if (capturedContent) {
            capturedContent.style.display = value === 'manual' ? 'block' : 'none';
        }

        updateAutoModeStatus();

        if (value === 'automatic') {
            const hasConfig = AssetManagerSystem.settings.apiKey &&
                AssetManagerSystem.state.selectedOrganization &&
                AssetManagerSystem.state.selectedProject;

            if (hasConfig) {
                showNotification('success', 'Automatic upload enabled - new files will be uploaded automatically');
            } else {
                showNotification('info', 'Automatic mode enabled - please configure API key, organization, and project in settings');
            }
        } else {
            showNotification('info', 'Manual upload mode - files require manual upload');
        }
    });

    const autoModeStatus = document.createElement('div');
    autoModeStatus.id = 'asset-manager-auto-status';
    autoModeStatus.style.cssText = `
        margin-top: 10px;
        padding: 8px 12px;
        border-radius: 3px;
        font-size: 12px;
        display: none;
    `;

    const updateAutoModeStatus = () => {
        const hasConfig = AssetManagerSystem.settings.apiKey &&
            AssetManagerSystem.state.selectedOrganization &&
            AssetManagerSystem.state.selectedProject;

        if (AssetManagerSystem.state.uploadMode === 'automatic') {
            autoModeStatus.style.display = 'block';
            if (hasConfig) {
                autoModeStatus.style.backgroundColor = '#2e7d32';
                autoModeStatus.style.color = '#fff';
                autoModeStatus.innerHTML = '✓ Automatic upload is active and ready';
            } else {
                autoModeStatus.style.backgroundColor = '#f57c00';
                autoModeStatus.style.color = '#fff';
                autoModeStatus.innerHTML = '⚠️ Configure API key, organization, and project to enable automatic uploads';
            }
        } else {
            autoModeStatus.style.display = 'none';
        }
    };

    window.assetManagerUpdateAutoModeStatus = updateAutoModeStatus;

    updateAutoModeStatus();

    uploadModeContainer.appendChild(uploadModeLabel);
    uploadModeContainer.appendChild(uploadModeToggle);
    uploadModeContainer.appendChild(autoModeStatus);

    const projectLabel = document.createElement('label');
    projectLabel.textContent = 'Project:';
    projectLabel.style.cssText = `
        display: block;
        margin-bottom: 5px;
        color: #fff;
        font-weight: bold;
    `;

    const projectDropdown = document.createElement('select');
    projectDropdown.id = 'asset-manager-project-dropdown';
    projectDropdown.style.cssText = `
        width: 100%;
        padding: 8px;
        margin-bottom: 20px;
        background-color: #333;
        border: 1px solid #444;
        border-radius: 3px;
        color: #fff;
        box-sizing: border-box;
    `;

    const defaultOption = document.createElement('option');
    defaultOption.textContent = 'Select a project...';
    defaultOption.value = '';
    projectDropdown.appendChild(defaultOption);

    projectDropdown.onchange = () => {
        AssetManagerSystem.state.selectedProject = projectDropdown.value;
        saveAssetState();

        const statusElement = document.getElementById('asset-manager-auto-status');
        if (statusElement) {
            const updateFunc = window.assetManagerUpdateAutoModeStatus;
            if (updateFunc) updateFunc();
        }
    };

    const capturedContentContainer = document.createElement('div');
    capturedContentContainer.id = 'asset-manager-captured-content-container';
    capturedContentContainer.style.display = AssetManagerSystem.state.uploadMode === 'manual' ? 'block' : 'none';

    const capturedContentHeader = document.createElement('div');
    capturedContentHeader.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    `;

    const capturedContentLabel = document.createElement('label');
    capturedContentLabel.textContent = 'Captured Content:';
    capturedContentLabel.style.cssText = `
        color: #fff;
        font-weight: bold;
    `;

    const headerActionsContainer = document.createElement('div');
    headerActionsContainer.style.cssText = `
        display: flex;
        gap: 10px;
    `;

    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = 'Select All';
    selectAllBtn.style.cssText = `
        padding: 5px 10px;
        background-color: #4a5568;
        border: none;
        border-radius: 3px;
        color: #fff;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
    `;
    selectAllBtn.onmouseenter = (e) => {
        e.currentTarget.style.backgroundColor = '#5a6578';
    };
    selectAllBtn.onmouseleave = (e) => {
        e.currentTarget.style.backgroundColor = '#4a5568';
    };
    selectAllBtn.onclick = () => selectAllFiles();

    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.textContent = 'Deselect All';
    deselectAllBtn.style.cssText = `
        padding: 5px 10px;
        background-color: #4a5568;
        border: none;
        border-radius: 3px;
        color: #fff;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
    `;
    deselectAllBtn.onmouseenter = (e) => {
        e.currentTarget.style.backgroundColor = '#5a6578';
    };
    deselectAllBtn.onmouseleave = (e) => {
        e.currentTarget.style.backgroundColor = '#4a5568';
    };
    deselectAllBtn.onclick = () => deselectAllFiles();

    const bulkUploadBtn = document.createElement('button');
    bulkUploadBtn.id = 'asset-manager-bulk-upload-btn';
    bulkUploadBtn.textContent = 'Upload Selected (0)';
    bulkUploadBtn.style.cssText = `
        padding: 5px 15px;
        background-color: #588157;
        border: none;
        border-radius: 3px;
        color: #fff;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
        display: none;
        transition: all 0.2s;
    `;
    bulkUploadBtn.onmouseenter = (e) => {
        if (!e.currentTarget.disabled) {
            e.currentTarget.style.backgroundColor = '#689167';
        }
    };
    bulkUploadBtn.onmouseleave = (e) => {
        if (!e.currentTarget.disabled) {
            e.currentTarget.style.backgroundColor = '#588157';
        }
    };
    bulkUploadBtn.onclick = () => bulkUploadSelected();

    const showAllBtn = document.createElement('button');
    showAllBtn.textContent = 'Show All Files';
    showAllBtn.title = 'Show uploaded and removed files again';
    showAllBtn.style.cssText = `
        padding: 5px 10px;
        background-color: #6b4c9a;
        border: none;
        border-radius: 3px;
        color: #fff;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
    `;
    showAllBtn.onmouseenter = (e) => {
        e.currentTarget.style.backgroundColor = '#7b5caa';
    };
    showAllBtn.onmouseleave = (e) => {
        e.currentTarget.style.backgroundColor = '#6b4c9a';
    };
    showAllBtn.onclick = () => showAllFiles();

    headerActionsContainer.appendChild(selectAllBtn);
    headerActionsContainer.appendChild(deselectAllBtn);
    headerActionsContainer.appendChild(bulkUploadBtn);
    headerActionsContainer.appendChild(showAllBtn);

    capturedContentHeader.appendChild(capturedContentLabel);
    capturedContentHeader.appendChild(headerActionsContainer);

    const capturedContentArea = document.createElement('div');
    capturedContentArea.id = 'asset-manager-captured-content';
    capturedContentArea.style.cssText = `
        width: 100%;
        height: 400px;
        max-height: 400px;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 10px;
        background-color: #2a2a2a;
        border: 1px solid #444;
        border-radius: 3px;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        grid-auto-rows: minmax(200px, auto);
        gap: 40px;
        align-content: start;
    `;

    capturedContentArea.innerHTML = '<div style="color: #aaa; grid-column: 1 / -1; text-align: center; padding: 20px;">Loading files...</div>';

    capturedContentContainer.appendChild(capturedContentHeader);
    capturedContentContainer.appendChild(capturedContentArea);

    container.appendChild(uploadModeContainer);
    container.appendChild(projectLabel);
    container.appendChild(projectDropdown);
    container.appendChild(capturedContentContainer);
}

function buildSettingsContent(container) {
    container.innerHTML = '';

    const settingsTitle = document.createElement('h4');
    settingsTitle.textContent = 'API Configuration';
    settingsTitle.style.cssText = `
        margin-top: 0;
        margin-bottom: 15px;
        color: #fff;
    `;

    const apiKeyLabel = document.createElement('label');
    apiKeyLabel.textContent = 'API Key:';
    apiKeyLabel.style.cssText = `
        display: block;
        margin-bottom: 5px;
        color: #fff;
    `;

    const apiKeyContainer = document.createElement('div');
    apiKeyContainer.style.cssText = `
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
    `;

    const apiKeyInput = document.createElement('input');
    apiKeyInput.type = 'password';
    apiKeyInput.id = 'asset-manager-api-key';
    apiKeyInput.value = AssetManagerSystem.settings.apiKey;
    apiKeyInput.style.cssText = `
        flex-grow: 1;
        padding: 8px;
        background-color: #333;
        border: 1px solid #444;
        border-radius: 3px;
        color: #fff;
        box-sizing: border-box;
    `;

    const togglePasswordBtn = document.createElement('button');
    togglePasswordBtn.textContent = '👁️';
    togglePasswordBtn.style.cssText = `
        padding: 8px 15px;
        background-color: #444;
        border: none;
        border-radius: 3px;
        color: #fff;
        cursor: pointer;
        font-size: 16px;
    `;
    togglePasswordBtn.onclick = () => {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            togglePasswordBtn.textContent = '🔒';
        } else {
            apiKeyInput.type = 'password';
            togglePasswordBtn.textContent = '👁️';
        }
    };

    apiKeyContainer.appendChild(apiKeyInput);
    apiKeyContainer.appendChild(togglePasswordBtn);

    const organizationLabel = document.createElement('label');
    organizationLabel.textContent = 'Organization:';
    organizationLabel.style.cssText = `
        display: block;
        margin-bottom: 5px;
        color: #fff;
    `;

    const organizationDropdown = document.createElement('select');
    organizationDropdown.id = 'asset-manager-organization-dropdown';
    organizationDropdown.style.cssText = `
        width: 100%;
        padding: 8px;
        margin-bottom: 20px;
        background-color: #333;
        border: 1px solid #444;
        border-radius: 3px;
        color: #fff;
        box-sizing: border-box;
    `;

    const defaultOrgOption = document.createElement('option');
    defaultOrgOption.textContent = 'Select an organization...';
    defaultOrgOption.value = '';
    organizationDropdown.appendChild(defaultOrgOption);

    organizationDropdown.onchange = async () => {
        const selectedOrgId = organizationDropdown.value;
        AssetManagerSystem.state.selectedOrganization = selectedOrgId;
        AssetManagerSystem.settings.organization = selectedOrgId;
        saveAssetState();

        const updateFunc = window.assetManagerUpdateAutoModeStatus;
        if (updateFunc) updateFunc();

        if (selectedOrgId) {
            await loadProjects(selectedOrgId);
        }
    };

    const saveSettingsBtn = document.createElement('button');
    saveSettingsBtn.textContent = 'Save Settings';
    saveSettingsBtn.style.cssText = `
        padding: 10px 20px;
        background-color: #588157;
        border: none;
        border-radius: 3px;
        color: #fff;
        cursor: pointer;
        font-weight: bold;
    `;
    saveSettingsBtn.onclick = () => {
        saveSettings();
    };

    const loadOrgsBtn = document.createElement('button');
    loadOrgsBtn.textContent = 'Load Organizations';
    loadOrgsBtn.style.cssText = `
        padding: 10px 20px;
        background-color: #4a5568;
        border: none;
        border-radius: 3px;
        color: #fff;
        cursor: pointer;
        margin-left: 10px;
    `;
    loadOrgsBtn.onclick = async () => {
        const apiKey = document.getElementById('asset-manager-api-key').value;
        if (!apiKey) {
            showNotification('error', 'Please enter an API key first');
            return;
        }
        await loadOrganizations(apiKey);
    };

    const settingsButtonContainer = document.createElement('div');
    settingsButtonContainer.style.cssText = `
        display: flex;
        gap: 10px;
    `;
    settingsButtonContainer.appendChild(saveSettingsBtn);
    settingsButtonContainer.appendChild(loadOrgsBtn);

    container.appendChild(settingsTitle);
    container.appendChild(apiKeyLabel);
    container.appendChild(apiKeyContainer);
    container.appendChild(organizationLabel);
    container.appendChild(organizationDropdown);
    container.appendChild(settingsButtonContainer);

    if (AssetManagerSystem.settings.apiKey) {
        loadOrganizations(AssetManagerSystem.settings.apiKey);
    }
}

function createToggle(id, initialValue, onChange) {
    const toggleContainer = document.createElement('div');
    toggleContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
    `;

    const toggleSwitch = document.createElement('div');
    toggleSwitch.id = id;
    toggleSwitch.style.cssText = `
        width: 50px;
        height: 25px;
        background-color: ${initialValue ? '#588157' : '#666'};
        border-radius: 25px;
        position: relative;
        cursor: pointer;
        transition: background-color 0.3s;
    `;

    const toggleCircle = document.createElement('div');
    toggleCircle.style.cssText = `
        width: 21px;
        height: 21px;
        background-color: #fff;
        border-radius: 50%;
        position: absolute;
        top: 2px;
        left: ${initialValue ? '27px' : '2px'};
        transition: left 0.3s;
    `;

    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = initialValue ? 'Active' : 'Inactive';
    toggleLabel.style.color = '#fff';

    toggleSwitch.appendChild(toggleCircle);

    let currentValue = initialValue;
    toggleSwitch.onclick = () => {
        currentValue = !currentValue;
        toggleSwitch.style.backgroundColor = currentValue ? '#588157' : '#666';
        toggleCircle.style.left = currentValue ? '27px' : '2px';
        toggleLabel.textContent = currentValue ? 'Active' : 'Inactive';
        onChange(currentValue);
    };

    toggleContainer.appendChild(toggleSwitch);
    toggleContainer.appendChild(toggleLabel);

    return toggleContainer;
}

function createModeToggle(id, initialValue, onChange) {
    const toggleContainer = document.createElement('div');
    toggleContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
    `;

    const toggleSwitch = document.createElement('div');
    toggleSwitch.id = id;
    toggleSwitch.style.cssText = `
        width: 50px;
        height: 25px;
        background-color: ${initialValue === 'automatic' ? '#588157' : '#666'};
        border-radius: 25px;
        position: relative;
        cursor: pointer;
        transition: background-color 0.3s;
    `;

    const toggleCircle = document.createElement('div');
    toggleCircle.style.cssText = `
        width: 21px;
        height: 21px;
        background-color: #fff;
        border-radius: 50%;
        position: absolute;
        top: 2px;
        left: ${initialValue === 'automatic' ? '27px' : '2px'};
        transition: left 0.3s;
    `;

    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = initialValue === 'automatic' ? 'Automatic' : 'Manual';
    toggleLabel.style.color = '#fff';

    toggleSwitch.appendChild(toggleCircle);

    let currentValue = initialValue;
    toggleSwitch.onclick = () => {
        currentValue = currentValue === 'manual' ? 'automatic' : 'manual';
        toggleSwitch.style.backgroundColor = currentValue === 'automatic' ? '#588157' : '#666';
        toggleCircle.style.left = currentValue === 'automatic' ? '27px' : '2px';
        toggleLabel.textContent = currentValue === 'automatic' ? 'Automatic' : 'Manual';
        onChange(currentValue);
    };

    toggleContainer.appendChild(toggleSwitch);
    toggleContainer.appendChild(toggleLabel);

    return toggleContainer;
}

async function loadOutputImages() {
    const capturedContentArea = document.getElementById('asset-manager-captured-content');
    if (!capturedContentArea) {
        return;
    }

    try {
        const response = await api.fetchApi("/asset-manager/get_output_images", {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        let imageData;
        if (response instanceof Response) {
            imageData = await response.json();
        } else {
            imageData = response;
        }

        if (imageData && imageData.status === 'success') {
            if (imageData.images && imageData.images.length > 0) {
                const filteredImages = imageData.images.filter(image => {
                    const isUploaded = AssetManagerSystem.state.uploadedAssets.has(image.path);
                    const isHidden = AssetManagerSystem.state.hiddenAssets.has(image.path);
                    return !isUploaded && !isHidden;
                });

                capturedContentArea.innerHTML = '';

                if (filteredImages.length > 0) {
                    filteredImages.forEach((image) => {
                        const imageCard = createImageCard(image);
                        capturedContentArea.appendChild(imageCard);
                    });
                } else {
                    capturedContentArea.innerHTML = '<div style="color: #aaa; grid-column: 1 / -1; text-align: center; padding: 20px;">No new files to display (all files are uploaded or hidden)</div>';
                }
            } else {
                capturedContentArea.innerHTML = '<div style="color: #aaa; grid-column: 1 / -1; text-align: center; padding: 20px;">No files found in output folder</div>';
            }
        } else {
            capturedContentArea.innerHTML = `<div style="color: #d64545; grid-column: 1 / -1; text-align: center; padding: 20px;">Error: ${imageData?.message || 'Failed to load files'}</div>`;
        }
    } catch (error) {
        capturedContentArea.innerHTML = '<div style="color: #d64545; grid-column: 1 / -1; text-align: center; padding: 20px;">Error loading files. Check console for details.</div>';
    }
}

function createImageCard(imageInfo) {
    const card = document.createElement('div');
    card.className = 'asset-manager-image-card';
    card.dataset.imagePath = imageInfo.path;
    card.dataset.imageName = imageInfo.name;
    card.style.cssText = `
        background-color: #333;
        border-radius: 5px;
        overflow: visible;
        position: relative;
        transition: transform 0.2s;
        border: 2px solid transparent;
    `;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'asset-manager-checkbox';
    checkbox.style.cssText = `
        position: absolute;
        top: 8px;
        left: 8px;
        width: 20px;
        height: 20px;
        cursor: pointer;
        z-index: 10;
        accent-color: #588157;
    `;
    checkbox.onchange = (e) => {
        e.stopPropagation();
        updateBulkUploadButton();
        if (checkbox.checked) {
            card.style.borderColor = '#588157';
        } else {
            card.style.borderColor = 'transparent';
        }
    };

    const fileType = imageInfo.file_type || 'image';
    let previewElement;

    if (fileType === 'image') {
        previewElement = document.createElement('img');
        previewElement.src = imageInfo.url || imageInfo.path;
        previewElement.alt = imageInfo.name;
        previewElement.style.cssText = `
            width: 100%;
            height: 150px;
            object-fit: cover;
            display: block;
        `;

        previewElement.onerror = () => {
            previewElement.style.backgroundColor = '#d64545';
            previewElement.alt = `Failed to load: ${imageInfo.name}`;
        };
    } else if (fileType === 'video') {
        previewElement = document.createElement('video');
        previewElement.src = imageInfo.url || imageInfo.path;
        previewElement.controls = false;
        previewElement.muted = true;
        previewElement.style.cssText = `
            width: 100%;
            height: 150px;
            object-fit: cover;
            display: block;
            background-color: #1a1a1a;
        `;

        previewElement.addEventListener('loadeddata', () => {
            previewElement.currentTime = 0;
        });

        previewElement.onerror = () => {
            previewElement.style.backgroundColor = '#d64545';
        };
    } else if (fileType === 'audio') {
        previewElement = document.createElement('div');
        previewElement.style.cssText = `
            width: 100%;
            height: 150px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #1a1a1a;
            font-size: 48px;
        `;
        previewElement.innerHTML = '🎵';
    } else if (fileType === 'text') {
        previewElement = document.createElement('div');
        previewElement.style.cssText = `
            width: 100%;
            height: 150px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #1a1a1a;
            font-size: 48px;
        `;
        previewElement.innerHTML = '📄';
    } else if (fileType === '3D') {
        previewElement = document.createElement('div');
        previewElement.style.cssText = `
            width: 100%;
            height: 150px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #1a1a1a;
            font-size: 48px;
        `;
        previewElement.innerHTML = '🧊';
    } else {
        previewElement = document.createElement('div');
        previewElement.style.cssText = `
            width: 100%;
            height: 150px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #1a1a1a;
            font-size: 48px;
        `;
        previewElement.innerHTML = '📁';
    }

    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = `
        padding: 8px;
        color: #fff;
        font-size: 12px;
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
        background-color: #333;
    `;
    infoDiv.textContent = imageInfo.name;

    const actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = `
        display: flex;
        gap: 5px;
        padding: 8px;
        background-color: #333;
    `;

    const uploadBtn = document.createElement('button');
    uploadBtn.textContent = 'Upload';
    uploadBtn.className = 'asset-manager-upload-btn';
    uploadBtn.style.cssText = `
        flex: 1;
        padding: 5px;
        background-color: #588157;
        border: none;
        border-radius: 3px;
        color: #fff;
        cursor: pointer;
        font-size: 11px;
        transition: all 0.2s;
        position: relative;
    `;
    uploadBtn.onmouseenter = (e) => {
        if (!e.currentTarget.disabled) {
            e.currentTarget.style.backgroundColor = '#689167';
        }
    };
    uploadBtn.onmouseleave = (e) => {
        if (!e.currentTarget.disabled) {
            e.currentTarget.style.backgroundColor = '#588157';
            e.currentTarget.style.transform = 'scale(1)';
        }
    };
    uploadBtn.onmousedown = (e) => {
        if (!e.currentTarget.disabled) {
            e.currentTarget.style.transform = 'scale(0.95)';
        }
    };
    uploadBtn.onmouseup = (e) => {
        e.currentTarget.style.transform = 'scale(1)';
    };
    uploadBtn.onclick = async (e) => {
        e.stopPropagation();
        await uploadSingleImage(imageInfo, card, uploadBtn);
    };

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.title = 'Remove from list (keeps file on disk)';
    removeBtn.style.cssText = `
        padding: 5px 8px;
        background-color: #4a5568;
        border: none;
        border-radius: 3px;
        color: #fff;
        cursor: pointer;
        font-size: 11px;
        transition: all 0.2s;
    `;
    removeBtn.onmouseenter = (e) => {
        e.currentTarget.style.backgroundColor = '#5a6578';
    };
    removeBtn.onmouseleave = (e) => {
        e.currentTarget.style.backgroundColor = '#4a5568';
        e.currentTarget.style.transform = 'scale(1)';
    };
    removeBtn.onmousedown = (e) => {
        e.currentTarget.style.transform = 'scale(0.95)';
    };
    removeBtn.onmouseup = (e) => {
        e.currentTarget.style.transform = 'scale(1)';
    };
    removeBtn.onclick = (e) => {
        e.stopPropagation();
        hideAsset(imageInfo, card);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Delete from disk';
    deleteBtn.style.cssText = `
        padding: 5px 8px;
        background-color: #d64545;
        border: none;
        border-radius: 3px;
        color: #fff;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
    `;
    deleteBtn.onmouseenter = (e) => {
        e.currentTarget.style.backgroundColor = '#e65555';
    };
    deleteBtn.onmouseleave = (e) => {
        e.currentTarget.style.backgroundColor = '#d64545';
        e.currentTarget.style.transform = 'scale(1)';
    };
    deleteBtn.onmousedown = (e) => {
        e.currentTarget.style.transform = 'scale(0.95)';
    };
    deleteBtn.onmouseup = (e) => {
        e.currentTarget.style.transform = 'scale(1)';
    };
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteSingleImage(imageInfo, card);
    };

    actionsDiv.appendChild(uploadBtn);
    actionsDiv.appendChild(removeBtn);
    actionsDiv.appendChild(deleteBtn);

    card.appendChild(checkbox);
    card.appendChild(previewElement);
    card.appendChild(infoDiv);
    card.appendChild(actionsDiv);

    card.onclick = () => {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
    };

    return card;
}

async function loadOrganizations(apiKey) {
    if (!apiKey) {
        showNotification('error', 'API key is required');
        return;
    }

    try {
        const response = await api.fetchApi(`/asset-manager/get_organizations?api_key=${encodeURIComponent(apiKey)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        let result;
        if (response instanceof Response) {
            result = await response.json();
        } else {
            result = response;
        }

        if (result.status === 'success') {
            const orgDropdown = document.getElementById('asset-manager-organization-dropdown');
            if (orgDropdown) {
                orgDropdown.innerHTML = '<option value="">Select an organization...</option>';

                if (result.organizations && result.organizations.length > 0) {
                    result.organizations.forEach(org => {
                        const option = document.createElement('option');
                        option.value = org.id;
                        option.textContent = org.name;
                        orgDropdown.appendChild(option);
                    });

                    const savedOrg = AssetManagerSystem.state.selectedOrganization || AssetManagerSystem.settings.organization;
                    if (savedOrg) {
                        orgDropdown.value = savedOrg;
                        AssetManagerSystem.state.selectedOrganization = savedOrg;
                        AssetManagerSystem.settings.organization = savedOrg;
                        await loadProjects(savedOrg);
                    }

                    showNotification('success', `${result.organizations.length} organizations loaded`);
                } else {
                    // No organizations
                    const noOrgsOption = document.createElement('option');
                    noOrgsOption.value = '';
                    noOrgsOption.textContent = 'No organizations available';
                    noOrgsOption.disabled = true;
                    orgDropdown.appendChild(noOrgsOption);
                    showNotification('info', 'No organizations found');
                }
            }
        } else {
            showNotification('error', result.message || 'Failed to load organizations');
        }
    } catch (error) {
        console.error('Error loading organizations:', error);
        showNotification('error', 'Failed to load organizations');
    }
}

// Load projects from API
async function loadProjects(organizationId) {
    const apiKey = AssetManagerSystem.settings.apiKey || document.getElementById('asset-manager-api-key')?.value;

    if (!apiKey) {
        showNotification('error', 'API key is required');
        return;
    }

    try {
        let url = `/asset-manager/get_projects?api_key=${encodeURIComponent(apiKey)}`;
        if (organizationId) {
            url += `&organization_id=${encodeURIComponent(organizationId)}`;
        }

        const response = await api.fetchApi(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        let result;
        if (response instanceof Response) {
            result = await response.json();
        } else {
            result = response;
        }

        if (result.status === 'success') {
            const projectDropdown = document.getElementById('asset-manager-project-dropdown');
            if (projectDropdown) {
                // Clear existing options except the first one
                projectDropdown.innerHTML = '<option value="">Select a project...</option>';

                // Add projects (may be empty array, which is valid)
                if (result.projects && result.projects.length > 0) {
                    result.projects.forEach(project => {
                        const option = document.createElement('option');
                        option.value = project.id;
                        option.textContent = project.name;
                        projectDropdown.appendChild(option);
                    });

                    // Restore previously selected project
                    if (AssetManagerSystem.state.selectedProject) {
                        projectDropdown.value = AssetManagerSystem.state.selectedProject;
                    }

                    showNotification('success', `${result.projects.length} projects loaded`);
                } else {
                    // No projects is valid - just inform the user
                    const noProjectsOption = document.createElement('option');
                    noProjectsOption.value = '';
                    noProjectsOption.textContent = 'No projects available';
                    noProjectsOption.disabled = true;
                    projectDropdown.appendChild(noProjectsOption);
                    showNotification('info', 'No projects found for this organization');
                }
            }
        } else {
            showNotification('error', result.message || 'Failed to load projects');
        }
    } catch (error) {
        console.error('Error loading projects:', error);
        showNotification('error', 'Failed to load projects');
    }
}

// Save settings to storage
function saveSettings() {
    const apiKey = document.getElementById('asset-manager-api-key').value;
    const organization = document.getElementById('asset-manager-organization-dropdown').value;

    AssetManagerSystem.settings.apiKey = apiKey;
    AssetManagerSystem.settings.organization = organization;

    // Save to localStorage or API (to be implemented)
    try {
        localStorage.setItem('asset-manager-settings', JSON.stringify(AssetManagerSystem.settings));
        showNotification('success', 'Settings saved successfully!');

        // Update auto mode status if available
        const updateFunc = window.assetManagerUpdateAutoModeStatus;
        if (updateFunc) updateFunc();

        // If we have an API key and no organizations loaded, load them
        if (apiKey) {
            loadOrganizations(apiKey);
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('error', 'Failed to save settings');
    }
}

// Load settings from storage
function loadSettings() {
    try {
        const savedSettings = localStorage.getItem('asset-manager-settings');
        if (savedSettings) {
            AssetManagerSystem.settings = JSON.parse(savedSettings);

            // Update UI if modal is open
            const apiKeyInput = document.getElementById('asset-manager-api-key');
            if (apiKeyInput) {
                apiKeyInput.value = AssetManagerSystem.settings.apiKey;
            }
        }

        // Load asset state
        const savedState = localStorage.getItem('asset-manager-state');
        if (savedState) {
            const state = JSON.parse(savedState);
            AssetManagerSystem.state.uploadedAssets = new Set(state.uploadedAssets || []);
            AssetManagerSystem.state.hiddenAssets = new Set(state.hiddenAssets || []);
            AssetManagerSystem.state.selectedProject = state.selectedProject || '';
            AssetManagerSystem.state.selectedOrganization = state.selectedOrganization || '';
            AssetManagerSystem.state.uploadMode = state.uploadMode || 'manual';

            // Restore organization dropdown if available
            const orgDropdown = document.getElementById('asset-manager-organization-dropdown');
            if (orgDropdown && AssetManagerSystem.state.selectedOrganization) {
                orgDropdown.value = AssetManagerSystem.state.selectedOrganization;
            }

            // Restore project dropdown if available
            const projectDropdown = document.getElementById('asset-manager-project-dropdown');
            if (projectDropdown && AssetManagerSystem.state.selectedProject) {
                projectDropdown.value = AssetManagerSystem.state.selectedProject;
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Save asset state to storage
function saveAssetState() {
    try {
        const state = {
            uploadedAssets: Array.from(AssetManagerSystem.state.uploadedAssets),
            hiddenAssets: Array.from(AssetManagerSystem.state.hiddenAssets),
            selectedProject: AssetManagerSystem.state.selectedProject,
            selectedOrganization: AssetManagerSystem.state.selectedOrganization,
            uploadMode: AssetManagerSystem.state.uploadMode
        };
        localStorage.setItem('asset-manager-state', JSON.stringify(state));
    } catch (error) {
        console.error('Error saving asset state:', error);
    }
}

// Show notification messages
function showNotification(type, message) {
    let notificationEl = document.getElementById('asset-manager-notification');
    if (!notificationEl) {
        notificationEl = document.createElement('div');
        notificationEl.id = 'asset-manager-notification';
        notificationEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 1001;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            max-width: 80%;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(notificationEl);
    }

    if (type === "error") {
        notificationEl.style.backgroundColor = "#d64545";
        notificationEl.style.color = "white";
    } else if (type === "info") {
        notificationEl.style.backgroundColor = "#4a5568";
        notificationEl.style.color = "white";
    } else {
        // success
        notificationEl.style.backgroundColor = "#2e7d32";
        notificationEl.style.color = "white";
    }

    notificationEl.textContent = message;
    notificationEl.style.opacity = "1";

    setTimeout(() => {
        notificationEl.style.opacity = "0";
        setTimeout(() => {
            if (notificationEl.parentNode) {
                document.body.removeChild(notificationEl);
            }
        }, 300);
    }, 3000);
}

// Select all files
function selectAllFiles() {
    const checkboxes = document.querySelectorAll('.asset-manager-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        // Update border
        const card = checkbox.closest('.asset-manager-image-card');
        if (card) {
            card.style.borderColor = '#588157';
        }
    });
    updateBulkUploadButton();
}

// Deselect all files
function deselectAllFiles() {
    const checkboxes = document.querySelectorAll('.asset-manager-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        // Update border
        const card = checkbox.closest('.asset-manager-image-card');
        if (card) {
            card.style.borderColor = 'transparent';
        }
    });
    updateBulkUploadButton();
}

// Show all files (reset uploaded and hidden state)
function showAllFiles() {
    const uploadedCount = AssetManagerSystem.state.uploadedAssets.size;
    const hiddenCount = AssetManagerSystem.state.hiddenAssets.size;

    if (uploadedCount === 0 && hiddenCount === 0) {
        showNotification('info', 'No hidden or uploaded files to show');
        return;
    }

    const confirmReset = confirm(
        `This will show all files again:\n\n` +
        `- ${uploadedCount} uploaded file(s)\n` +
        `- ${hiddenCount} hidden file(s)\n\n` +
        `Continue?`
    );

    if (confirmReset) {
        AssetManagerSystem.state.uploadedAssets.clear();
        AssetManagerSystem.state.hiddenAssets.clear();
        saveAssetState();

        showNotification('success', 'Showing all files');

        // Reload the file list
        loadOutputImages();
    }
}

// Check for new files and automatically upload them if in automatic mode
async function checkAndAutoUpload() {
    // Only proceed if automatic mode is enabled
    if (AssetManagerSystem.state.uploadMode !== 'automatic') {
        return;
    }

    // Check if we have all required settings
    const apiKey = AssetManagerSystem.settings.apiKey;
    const organizationId = AssetManagerSystem.state.selectedOrganization || AssetManagerSystem.settings.organization;
    const projectId = AssetManagerSystem.state.selectedProject;

    if (!apiKey || !organizationId || !projectId) {
        return;
    }

    try {
        // Get current files from output folder
        const response = await api.fetchApi("/asset-manager/get_output_images", {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        let imageData;
        if (response instanceof Response) {
            imageData = await response.json();
        } else {
            imageData = response;
        }

        if (imageData && imageData.status === 'success' && imageData.images) {
            const newFiles = [];

            // Check for new files
            imageData.images.forEach(image => {
                if (!AssetManagerSystem.state.knownFiles.has(image.path) &&
                    !AssetManagerSystem.state.uploadedAssets.has(image.path) &&
                    !AssetManagerSystem.state.hiddenAssets.has(image.path)) {
                    newFiles.push(image);
                    AssetManagerSystem.state.knownFiles.add(image.path);
                }
            });

            // Upload new files
            if (newFiles.length > 0) {
                showNotification('info', `Auto-uploading ${newFiles.length} new file(s)...`);

                // Get current workflow JSON
                let workflowJson = null;
                try {
                    const graph = await app.graphToPrompt();
                    workflowJson = graph["output"];
                } catch (error) {
                    console.warn('Failed to get workflow JSON:', error);
                }

                // Upload files
                const response = await api.fetchApi('/asset-manager/upload_assets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        assets: newFiles.map(f => f.path),
                        project_id: projectId,
                        folder_id: projectId,
                        organization_id: organizationId,
                        api_key: apiKey,
                        metadata: {
                            automatic_upload: true,
                            count: newFiles.length,
                            workflow: workflowJson
                        }
                    })
                });

                let result;
                if (response instanceof Response) {
                    result = await response.json();
                } else {
                    result = response;
                }

                if (result.status === 'success' || result.status === 'partial') {
                    // Mark files as uploaded
                    newFiles.forEach(file => {
                        AssetManagerSystem.state.uploadedAssets.add(file.path);
                    });
                    saveAssetState();

                    showNotification('success', `Auto-uploaded ${newFiles.length} file(s)`);

                    // Refresh the UI if modal is open
                    const modal = document.getElementById('asset-manager-modal-overlay');
                    if (modal && modal.style.display === 'flex') {
                        loadOutputImages();
                    }
                } else {
                    showNotification('error', 'Automatic upload failed');
                }
            }
        }
    } catch (error) {
        // Silent fail for auto-upload
    }
}

// Initialize known files list
async function initializeKnownFiles() {
    try {
        const response = await api.fetchApi("/asset-manager/get_output_images", {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        let imageData;
        if (response instanceof Response) {
            imageData = await response.json();
        } else {
            imageData = response;
        }

        if (imageData && imageData.status === 'success' && imageData.images) {
            imageData.images.forEach(image => {
                AssetManagerSystem.state.knownFiles.add(image.path);
            });
        }
    } catch (error) {
        // Silent fail
    }
}

// Update bulk upload button visibility and count
function updateBulkUploadButton() {
    const checkboxes = document.querySelectorAll('.asset-manager-checkbox:checked');
    const bulkUploadBtn = document.getElementById('asset-manager-bulk-upload-btn');

    if (bulkUploadBtn) {
        if (checkboxes.length > 0) {
            bulkUploadBtn.style.display = 'block';
            bulkUploadBtn.textContent = `Upload Selected (${checkboxes.length})`;
        } else {
            bulkUploadBtn.style.display = 'none';
        }
    }
}

// Upload single image
async function uploadSingleImage(imageInfo, cardElement, buttonElement) {
    const projectId = document.getElementById('asset-manager-project-dropdown')?.value;

    if (!projectId) {
        showNotification('error', 'Please select a project first');
        return;
    }

    const apiKey = AssetManagerSystem.settings.apiKey;
    if (!apiKey) {
        showNotification('error', 'Please configure API key in settings');
        return;
    }

    const organizationId = AssetManagerSystem.settings.organization;
    if (!organizationId) {
        showNotification('error', 'Please select an organization in settings');
        return;
    }

    // Get current workflow JSON
    let workflowJson = null;
    try {
        const graph = await app.graphToPrompt();
        workflowJson = graph["output"];
    } catch (error) {
        console.warn('Failed to get workflow JSON:', error);
    }

    // Show loading state
    if (buttonElement) {
        buttonElement.disabled = true;
        buttonElement.style.opacity = '0.6';
        buttonElement.style.cursor = 'not-allowed';

        // Create spinner element
        buttonElement.innerHTML = `
            <div style="display: inline-flex; align-items: center; gap: 5px;">
                <div class="asset-manager-spinner"></div>
                <span>Uploading...</span>
            </div>
        `;

        // Add spinner styles if not already added
        if (!document.getElementById('asset-manager-spinner-style')) {
            const style = document.createElement('style');
            style.id = 'asset-manager-spinner-style';
            style.textContent = `
                .asset-manager-spinner {
                    width: 12px;
                    height: 12px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: asset-manager-spin 0.6s linear infinite;
                }
                @keyframes asset-manager-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    try {
        // Call upload API
        const response = await api.fetchApi('/asset-manager/upload_assets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assets: [imageInfo.path],
                project_id: projectId,
                folder_id: projectId, // Using project_id as folder_id for now
                organization_id: organizationId,
                api_key: apiKey,
                metadata: {
                    filename: imageInfo.name,
                    size: imageInfo.size,
                    modified: imageInfo.modified,
                    workflow: workflowJson
                }
            })
        });

        let result;
        if (response instanceof Response) {
            result = await response.json();
        } else {
            result = response;
        }

        if (result.status === 'success' || result.status === 'partial') {
            showNotification('success', result.message || `Uploaded ${imageInfo.name}`);

            // Mark as uploaded and save state
            AssetManagerSystem.state.uploadedAssets.add(imageInfo.path);
            saveAssetState();

            // Remove card from DOM with fade out animation
            if (cardElement && cardElement.parentNode) {
                cardElement.style.transition = 'opacity 0.3s, transform 0.3s';
                cardElement.style.opacity = '0';
                cardElement.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    if (cardElement.parentNode) {
                        cardElement.parentNode.removeChild(cardElement);
                    }
                    updateBulkUploadButton();
                }, 300);
            }
        } else {
            showNotification('error', result.message || 'Upload failed');

            // Reset button state on error
            if (buttonElement) {
                buttonElement.disabled = false;
                buttonElement.style.opacity = '1';
                buttonElement.style.cursor = 'pointer';
                buttonElement.textContent = 'Upload';
            }
        }
    } catch (error) {
        showNotification('error', 'Failed to upload image');

        // Reset button state on error
        if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.style.opacity = '1';
            buttonElement.style.cursor = 'pointer';
            buttonElement.textContent = 'Upload';
        }
    }
}

// Remove asset from view (doesn't delete from disk)
function hideAsset(imageInfo, cardElement) {
    // Add to hidden assets
    AssetManagerSystem.state.hiddenAssets.add(imageInfo.path);
    saveAssetState();

    // Remove card from DOM with fade out animation
    if (cardElement && cardElement.parentNode) {
        cardElement.style.transition = 'opacity 0.3s, transform 0.3s';
        cardElement.style.opacity = '0';
        cardElement.style.transform = 'scale(0.8)';
        setTimeout(() => {
            if (cardElement.parentNode) {
                cardElement.parentNode.removeChild(cardElement);
            }
            updateBulkUploadButton();
        }, 300);
    }

    showNotification('info', `Removed ${imageInfo.name} from list`);
}

// Delete single image
async function deleteSingleImage(imageInfo, cardElement) {
    const confirmDelete = confirm(
        `⚠️ WARNING: This will permanently delete the file from your local system!\n\n` +
        `File: ${imageInfo.name}\n\n` +
        `Are you sure you want to delete this file?`
    );

    if (!confirmDelete) {
        return;
    }

    try {
        // Call delete API
        const response = await api.fetchApi('/asset-manager/delete_image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_path: imageInfo.path
            })
        });

        let result;
        if (response instanceof Response) {
            result = await response.json();
        } else {
            result = response;
        }

        if (result.status === 'success') {
            showNotification('success', `Deleted ${imageInfo.name}`);

            // Remove from tracked sets
            AssetManagerSystem.state.uploadedAssets.delete(imageInfo.path);
            AssetManagerSystem.state.hiddenAssets.delete(imageInfo.path);
            saveAssetState();

            // Remove card from DOM with fade out animation
            if (cardElement && cardElement.parentNode) {
                cardElement.style.transition = 'opacity 0.3s, transform 0.3s';
                cardElement.style.opacity = '0';
                cardElement.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    if (cardElement.parentNode) {
                        cardElement.parentNode.removeChild(cardElement);
                    }
                    updateBulkUploadButton();
                }, 300);
            }
        } else {
            showNotification('error', result.message || 'Delete failed');
        }
    } catch (error) {
        showNotification('error', 'Failed to delete image');
    }
}

// Bulk upload selected images
async function bulkUploadSelected() {
    const projectId = document.getElementById('asset-manager-project-dropdown')?.value;

    if (!projectId) {
        showNotification('error', 'Please select a project first');
        return;
    }

    const apiKey = AssetManagerSystem.settings.apiKey;
    if (!apiKey) {
        showNotification('error', 'Please configure API key in settings');
        return;
    }

    const organizationId = AssetManagerSystem.settings.organization;
    if (!organizationId) {
        showNotification('error', 'Please select an organization in settings');
        return;
    }

    // Get all checked images
    const checkboxes = document.querySelectorAll('.asset-manager-checkbox:checked');
    const selectedCards = Array.from(checkboxes).map(checkbox => checkbox.closest('.asset-manager-image-card'));
    const selectedImages = selectedCards.map(card => ({
        path: card.dataset.imagePath,
        name: card.dataset.imageName,
        card: card
    }));

    if (selectedImages.length === 0) {
        showNotification('error', 'No images selected');
        return;
    }

    // Get current workflow JSON
    let workflowJson = null;
    try {
        const graph = await app.graphToPrompt();
        workflowJson = graph["output"];
    } catch (error) {
        console.warn('Failed to get workflow JSON:', error);
    }

    const bulkUploadBtn = document.getElementById('asset-manager-bulk-upload-btn');

    // Show loading state
    if (bulkUploadBtn) {
        bulkUploadBtn.disabled = true;
        bulkUploadBtn.style.opacity = '0.6';
        bulkUploadBtn.style.cursor = 'not-allowed';
        bulkUploadBtn.innerHTML = `
            <div style="display: inline-flex; align-items: center; gap: 5px;">
                <div class="asset-manager-spinner"></div>
                <span>Uploading...</span>
            </div>
        `;
    }

    try {
        // Call bulk upload API
        const response = await api.fetchApi('/asset-manager/upload_assets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assets: selectedImages.map(img => img.path),
                project_id: projectId,
                folder_id: projectId, // Using project_id as folder_id for now
                organization_id: organizationId,
                api_key: apiKey,
                metadata: {
                    bulk_upload: true,
                    count: selectedImages.length,
                    workflow: workflowJson
                }
            })
        });

        let result;
        if (response instanceof Response) {
            result = await response.json();
        } else {
            result = response;
        }

        if (result.status === 'success' || result.status === 'partial') {
            showNotification('success', result.message || `Successfully uploaded ${selectedImages.length} files`);

            // Mark all as uploaded and remove cards
            selectedImages.forEach(img => {
                AssetManagerSystem.state.uploadedAssets.add(img.path);

                // Remove card with animation
                if (img.card && img.card.parentNode) {
                    img.card.style.transition = 'opacity 0.3s, transform 0.3s';
                    img.card.style.opacity = '0';
                    img.card.style.transform = 'scale(0.8)';
                    setTimeout(() => {
                        if (img.card.parentNode) {
                            img.card.parentNode.removeChild(img.card);
                        }
                    }, 300);
                }
            });

            saveAssetState();

            // Update button after animation completes
            setTimeout(() => {
                updateBulkUploadButton();
            }, 350);
        } else {
            showNotification('error', result.message || 'Bulk upload failed');

            // Reset button state on error
            if (bulkUploadBtn) {
                bulkUploadBtn.disabled = false;
                bulkUploadBtn.style.opacity = '1';
                bulkUploadBtn.style.cursor = 'pointer';
                updateBulkUploadButton();
            }
        }
    } catch (error) {
        showNotification('error', 'Failed to upload images');

        // Reset button state on error
        if (bulkUploadBtn) {
            bulkUploadBtn.disabled = false;
            bulkUploadBtn.style.opacity = '1';
            bulkUploadBtn.style.cursor = 'pointer';
            updateBulkUploadButton();
        }
    }
}

// Show the modal
async function showAssetManagerModal() {
    const modal = createAssetManagerModal();
    modal.style.display = 'flex';

    // Load settings when modal opens
    loadSettings();

    // Load organizations if we have an API key
    if (AssetManagerSystem.settings.apiKey) {
        await loadOrganizations(AssetManagerSystem.settings.apiKey);
    }

    // Load output images (now that modal is in DOM)
    loadOutputImages();
}

// Setup automatic upload listeners
function setupAutomaticUpload() {
    // Initialize known files
    initializeKnownFiles();

    // Listen to execution events
    api.addEventListener("executed", (event) => {
        // Debounce automatic uploads (wait 2 seconds after last execution)
        if (AssetManagerSystem.automaticUploadTimeout) {
            clearTimeout(AssetManagerSystem.automaticUploadTimeout);
        }

        AssetManagerSystem.automaticUploadTimeout = setTimeout(() => {
            checkAndAutoUpload();
        }, 2000); // Wait 2 seconds after execution completes
    });

    // Also listen for execution_success event if available
    api.addEventListener("execution_success", () => {
        if (AssetManagerSystem.automaticUploadTimeout) {
            clearTimeout(AssetManagerSystem.automaticUploadTimeout);
        }

        AssetManagerSystem.automaticUploadTimeout = setTimeout(() => {
            checkAndAutoUpload();
        }, 2000);
    });
}

// Initialize the extension
function initializeAssetManager() {
    if (AssetManagerSystem.isInitialized) {
        return;
    }

    if (!app.extensions || !app.extensions.find(ext => ext.name === "asset-manager.menu.button")) {
        app.registerExtension({
            name: "asset-manager.menu.button",
            async setup() {
                try {
                    let assetManagerButton = new (await import("../../scripts/ui/components/button.js")).ComfyButton({
                        action: (e) => {
                            if (e && e.preventDefault) e.preventDefault();
                            if (e && e.stopPropagation) e.stopPropagation();

                            showAssetManagerModal();

                            return false;
                        },
                        tooltip: "Asset Manager - Upload generated outputs to API",
                        content: "Asset Manager",
                    }).element;

                    app.menu?.settingsGroup.element.before(assetManagerButton);

                    // Setup automatic upload functionality
                    setupAutomaticUpload();

                    AssetManagerSystem.isInitialized = true;
                }
                catch (exception) {
                    console.error("Asset Manager initialization error:", exception);
                }
            },
        });
    }
}

// Initialize the extension
initializeAssetManager();

