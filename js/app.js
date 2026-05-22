// Global state
let currentData = null, originalData = null, currentDweller = null;
let backups = [], changeHistory = [];
let originalFileName = null, seasonPassFileName = null;
let originalFieldValues = {};

// DOM Helpers to reduce boilerplate
const getEl = id => document.getElementById(id);
const getEls = sel => document.querySelectorAll(sel);
const addEvt = (id, evt, cb) => getEl(id)?.addEventListener(evt, cb);

// Guides organized into sections.
const GUIDE_SECTIONS = [
    { id: 'getting-started', title: 'Getting Started', guides: [
        { id: 'intro', title: 'Introduction & UI Overview', videoUrl: '', content: '<p>Welcome to Wasteland Editor. This walkthrough explains the main UI areas: file upload, tabs for Vault/Dwellers/Rooms, and the Raw JSON editor. Start by uploading a save file using the <strong>Upload Save File</strong> control.</p><ul><li><strong>Upload</strong>: Supports .sav, .dat, .json files.</li><li><strong>Tabs</strong>: Switch between Vault, Dwellers, Rooms, Inventory and more.</li><li><strong>Backups</strong>: The editor creates automatic backups—use them if you need to revert changes.</li></ul>' },
        { id: 'backup-restore', title: 'Backup & Restore Best Practices', videoUrl: '', content: '<p>Before making any edits, create a copy of your original save file and use the editor\'s backup functionality. This guide explains how to create and restore backups safely.</p><ol><li>Download a local copy of your save file.</li><li>Use the editor\'s <em>Create Backup</em> or rely on automatic snapshots.</li><li>If something goes wrong, use <em>Restore Backup</em> to revert.</li></ol>' }
    ]},
    { id: 'dwellers', title: 'Dwellers', guides: [
        { id: 'edit-dwellers', title: 'Edit Names, Stats & Level', videoUrl: '', content: '<p>This guide covers safely changing dweller attributes: first/last name, S.P.E.C.I.A.L. stats, level and experience. Always check the <strong>Serialize ID</strong> field before creating new dwellers.</p><p>Tip: Use <strong>Max All Stats</strong> sparingly—it changes gameplay progression.</p>' },
        { id: 'equipment-outfits', title: 'Weapons, Outfits & Inventory', videoUrl: '', content: '<p>Assign weapons and outfits via the dweller panel or the inventory tab. Removing or adding items directly modifies the vault inventory array.</p><p>Note: The game stores items as individual entries—there is no quantity field.</p>' },
        { id: 'relationships', title: 'Relationships & Babies', videoUrl: '', content: '<p>Manage relationships by editing partner IDs and pregnancy flags. Incorrect values may produce unexpected game behavior—always back up first.</p>' }
    ]},
    { id: 'rooms', title: 'Rooms & Vault Layout', guides: [
        { id: 'upgrade-rooms', title: 'Upgrading and Unlocking Rooms', videoUrl: '', content: '<p>This guide explains how room tiers and unlock flags are represented in the save file. Use the <strong>Unlock All Rooms</strong> bulk action to set unlock flags across your vault.</p>' },
        { id: 'bulk-actions', title: 'Bulk Actions & Safety', videoUrl: '', content: '<p>Bulk actions can corrupt saves if used without care. Always keep a backup and apply one action at a time to verify results.</p>' }
    ]},
    { id: 'inventory', title: 'Inventory', guides: [
        { id: 'add-remove-items', title: 'Add / Remove Items Safely', videoUrl: '', content: '<p>Use the Add Item modal to append new items. When removing items, verify the correct item instance is removed to avoid unintended deletions.</p>' },
        { id: 'equip-weapons', title: 'Equip Items to Dwellers', videoUrl: '', content: '<p>Assign equipment via the dweller panel to ensure references and indices remain consistent. For large-scale changes, prefer exporting, editing, and re-importing as JSON.</p>' }
    ]},
    { id: 'wasteland', title: 'Wasteland', guides: [
        { id: 'teams', title: 'Managing Wasteland Teams', videoUrl: '', content: '<p>This guide explains how to create, save, and recall wasteland teams. You can max team resources or recall teams back to the vault safely.</p>' },
        { id: 'resources', title: 'Maximizing Team Resources', videoUrl: '', content: '<p>Optimize team compositions to increase resource yields. The editor allows you to tweak team stats and carried resources directly.</p>' }
    ]},
    { id: 'season-pass', title: 'Season Pass', guides: [
        { id: 'season-overview', title: 'Season Pass Editor Overview', videoUrl: '', content: '<p>The season pass contains level, tokens, and reward unlock flags. Modifying these values can violate service terms—use the download warning modal before exporting.</p>' }
    ]},
    { id: 'advanced', title: 'Advanced / Raw JSON', guides: [
        { id: 'raw-json', title: 'Using the Raw JSON Editor', videoUrl: '', content: '<p>The Raw JSON editor exposes the entire save file. Make minimal changes and validate JSON syntax before saving. Use the Format JSON button to pretty-print content.</p>' },
        { id: 'history', title: 'Change History & Backups', videoUrl: '', content: '<p>Review the change history panel to inspect edits and restore previous backups if needed. The editor maintains up to 10 backups automatically.</p>' }
    ]},
    { id: 'safety', title: 'Safety & Legal', guides: [
        { id: 'legal', title: 'Legal Disclaimer & Best Practices', videoUrl: '', content: '<p>Modifying save files can violate Terms of Service. This tool is for educational purposes. Always keep backups and do not use modified files in competitive or online contexts.</p>' }
    ]}
];

// Event Listeners Setup
function initializeEventListeners() {
    document.querySelector('.upload-label').addEventListener('click', () => getEl('fileInput').click());
    addEvt('fileInput', 'change', handleFileUpload);
    addEvt('downloadBtn', 'click', downloadSave);
    addEvt('formatBtn', 'click', formatJSON);
    addEvt('historyBtn', 'click', showHistoryModal);
    addEvt('clearBtn', 'click', clearEditor);
    addEvt('jsonEditor', 'input', debounce(handleEditorChange, 500));
    addEvt('searchInput', 'input', debounce(handleSearch, 300));
    
    getEls('.tab-btn').forEach(btn => btn.addEventListener('click', switchTab));

    // Vault panel listeners
    ['vaultName', 'vaultNumber', 'caps', 'food', 'water', 'power', 'radaway', 'stimpacks', 'nukacola', 'nukaquantum'].forEach(id => {
        addEvt(id, 'change', updateVaultData);
        addEvt(id, 'input', () => trackFieldChange(id));
    });

    ['lunchboxCount', 'handyCount', 'petCarrierCount', 'starterPackCount'].forEach(id => {
        addEvt(id, 'change', updateItemCounts);
        addEvt(id, 'input', () => trackFieldChange(id));
    });

    // Bulk action buttons
    addEvt('unlockRoomsBtn', 'click', unlockAllRooms);
    addEvt('maxAllStatsBtn', 'click', maxAllDwellerStats);
    addEvt('maxHappinessBtn', 'click', maxAllHappiness);
    addEvt('healAllBtn', 'click', healAllDwellers);
    addEvt('clearEmergenciesBtn', 'click', clearAllEmergencies);
    addEvt('unlockThemesBtn', 'click', unlockAllThemes);
    addEvt('showRecipesEditorBtn', 'click', showRecipesEditor);

    // Recipes editor listeners
    addEvt('saveRecipesBtn', 'click', saveRecipesChanges);
    addEvt('closeRecipesEditorBtn', 'click', closeRecipesEditor);
    addEvt('recipeSelectAllBtn', 'click', recipeSelectAll);
    addEvt('recipeDeselectAllBtn', 'click', recipeDeselectAll);
    addEvt('recipeSearchInput', 'input', e => filterRecipes(e.target.value));

    // Season pass listeners
    ['currentLevel', 'currentTokens', 'schemaVersion', 'isPremium', 'isPremiumPlus', 'maxRankAchieved', 'battlepassWindowLevel'].forEach(id => {
        addEvt(id, 'change', updateSeasonPassData);
    });
    
    addEvt('currentSeason', 'change', (e) => {
        if (currentData) {
            currentData.currentSeason = e.target.value;
            populateSeasonPassData();
            updateSeasonPassData();
        }
    });
    
    addEvt('maxSeasonLevelBtn', 'click', maxSeasonLevel);
    addEvt('unlockAllRewardsBtn', 'click', unlockAllSeasonRewards);
    addEvt('enablePremiumBtn', 'click', enablePremiumPass);
    addEvt('downloadSeasonPassBtn', 'click', downloadSeasonPass);

    // Wasteland listeners
    addEvt('wastelandSearch', 'input', e => filterWastelandTeams(e.target.value));
    addEvt('saveTeamBtn', 'click', updateWastelandTeam);
    addEvt('recallTeamBtn', 'click', recallTeam);
    addEvt('maxTeamResourcesBtn', 'click', maxTeamResources);
    addEvt('wastelandBackBtn', 'click', () => {
        getEl('wastelandTeamDetails').style.display = 'none';
        getEls('.wasteland-team-item').forEach(item => item.classList.remove('active'));
    });

    // Inventory listeners
    getEls('.inventory-subtab-btn').forEach(btn => btn.addEventListener('click', () => switchInventorySubtab(btn.dataset.subtab)));
    addEvt('weaponSearch', 'input', e => filterInventory('weapons', e.target.value));
    addEvt('outfitSearch', 'input', e => filterInventory('outfits', e.target.value));
    addEvt('junkSearch', 'input', e => filterInventory('junk', e.target.value));
    addEvt('guideSearch', 'input', debounce(e => filterGuides(e.target.value), 200));
    addEvt('addWeaponBtn', 'click', () => addInventoryItem('weapon'));
    addEvt('addOutfitBtn', 'click', () => addInventoryItem('outfit'));
    addEvt('addJunkBtn', 'click', () => addInventoryItem('junk'));

    // Dweller panel listeners
    ['dwellerFirstName', 'dwellerLastName', 'dwellerGender', 'dwellerLevel', 'dwellerExp',
     'dwellerHealth', 'dwellerHappiness', 'dwellerSkinColor', 'dwellerHairColor', 'dwellerHairStyle',
     'dwellerOutfit', 'dwellerWeapon', 'dwellerMaxHealth', 'dwellerRadiation', 'dwellerRarity',
     'dwellerSavedRoom', 'dwellerPregnant', 'dwellerBabyReady', 'dwellerPartner'].forEach(id => {
        addEvt(id, 'change', updateDwellerData);
        addEvt(id, 'input', () => trackFieldChange(id));
    });

    addEvt('dwellerSearch', 'input', debounce(filterDwellers, 300));
    addEvt('dwellerSort', 'change', populateDwellersList);
    addEvt('dwellerSortOrder', 'click', toggleDwellerSortOrder);
    addEvt('maxStatsBtn', 'click', maxDwellerStats);
    addEvt('saveDwellerBtn', 'click', saveDwellerChanges);

    getEls('.stat-item input').forEach(input => {
        input.addEventListener('change', updateDwellerData);
        input.addEventListener('input', e => trackFieldChange(e.target.id));
    });

    // Back links handler
    document.addEventListener('click', e => {
        if (e.target.classList.contains('back-link')) {
            e.preventDefault();
            // Dweller back link
            const dList = getEl('dwellersList');
            if (dList?.style.display === 'none' || !dList) {
                if (getEl('dwellersList')) getEl('dwellersList').style.display = 'block';
                if (getEl('dwellerDetailsEmptyState')) getEl('dwellerDetailsEmptyState').style.display = 'flex';
                if (getEl('dwellerDetailsContent')) getEl('dwellerDetailsContent').style.display = 'none';
                currentDweller = null;
            }
            // Guide back link
            if (getEl('guideDetailsContent')?.style.display === 'block') {
                getEl('guideDetailsContent').style.display = 'none';
                if (getEl('guideDetailsEmptyState')) getEl('guideDetailsEmptyState').style.display = 'flex';
            }
        }
    });

    renderGuidesList();
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();
    
    reader.onload = event => {
        try {
            originalFileName = file.name;
            const isSPDFile = fileName.includes('spd');
            const text = event.target.result;
            let result;
            
            try {
                result = { success: true, data: JSON.parse(text) };
            } catch (err) {
                if (fileName.endsWith('.sav') || fileName.endsWith('.dat')) {
                    result = SaveDecryptor.decrypt(text, file.name);
                } else {
                    result = { success: false, error: `Invalid format: ${err.message}` };
                }
            }
            
            if (result.success && result.data) {
                currentData = result.data;
                originalData = JSON.parse(JSON.stringify(currentData));
                
                getEl('fileInfo').textContent = `Loaded: ${file.name} (${formatFileSize(file.size)})`;
                getEl('errorMessage').textContent = '';
                ['downloadBtn', 'formatBtn', 'historyBtn', 'clearBtn'].forEach(id => getEl(id).disabled = false);
                
                addToHistory('File Loaded', `Loaded ${file.name} (${formatFileSize(file.size)})`);
                
                populateSelects();
                populateSeasonSelector();
                
                if (isSPDFile && currentData.seasonsData) seasonPassFileName = file.name;
                
                getEl('jsonEditor').value = JSON.stringify(currentData, null, 2);
                updateFileSize();
                enableEditorUI();
                
                populateVaultData();
                populateItemData();
                populateDwellersList();
                populateRoomsList();
                populateWastelandTeams();
                populateInventory();
                populateSeasonPassData();
                populateVaultStats();
                
                showWastelandContent();
                showInventoryContent();
                showDwellersContent();
                showRoomsContent();
                
                createBackup('Initial Load');
            } else {
                getEl('errorMessage').textContent = result.error || 'Unknown error parsing file';
                currentData = null;
                disableEditorUI();
            }
        } catch (error) {
            getEl('errorMessage').textContent = `Error: ${error.message}`;
            currentData = null;
            console.error('File upload error:', error);
        }
    };
    reader.readAsText(file);
}

function populateSelects() {
    const wSel = getEl('dwellerWeapon'), oSel = getEl('dwellerOutfit');
    if (wSel) wSel.innerHTML = '<option value="">No Weapon</option>' + Object.entries(WEAPONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    if (oSel) oSel.innerHTML = '<option value="">No Outfit</option>' + Object.entries(OUTFITS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
}

function populateSeasonSelector() {
    const seasonSelect = getEl('currentSeason');
    if (!seasonSelect || !currentData?.seasonsData) return;
    
    seasonSelect.innerHTML = '';
    const seasons = Object.keys(currentData.seasonsData);
    if (!seasons.length) {
        seasonSelect.innerHTML = '<option value="">No seasons found</option>';
        return;
    }
    
    seasonSelect.innerHTML = seasons.map(s => `<option value="${s}">${s}</option>`).join('');
    seasonSelect.value = currentData.currentSeason || seasons[0];
}

function createBackup(label = 'Backup') {
    if (!currentData) return;
    const backup = { label: label || `Backup ${new Date().toLocaleTimeString()}`, timestamp: Date.now(), data: JSON.parse(JSON.stringify(currentData)) };
    backups.push(backup);
    if (backups.length > 10) backups.shift();
    showToast(`Backup created: ${backup.label}`);
}

function restoreBackup(index) {
    if (!backups[index]) return;
    currentData = JSON.parse(JSON.stringify(backups[index].data));
    getEl('jsonEditor').value = JSON.stringify(currentData, null, 2);
    updateFileSize();
    populateVaultData();
    populateDwellersList();
    showToast(`Restored: ${backups[index].label}`);
}

function showToast(message) {
    let container = getEl('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:10000;display:flex;flex-direction:column-reverse;gap:10px;pointer-events:none;';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.style.cssText = 'background:#8B4513;color:#F5DEB3;padding:15px 20px;border-radius:5px;font-family:Georgia,serif;border:2px solid #654321;box-shadow:0 4px 8px rgba(0,0,0,0.3);animation:slideIn 0.3s ease-out;pointer-events:auto;max-width:300px;';
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => { toast.remove(); if (!container.children.length) container.remove(); }, 300);
    }, 3000);
}

function enableEditorUI() {
    getEls('.tab-content input, .tab-content select, .tab-content button').forEach(el => el.disabled = false);
    getEls('.tab-content').forEach(tab => tab.classList.remove('editor-disabled'));
}

function disableEditorUI() {
    getEls('.tab-content input, .tab-content select, .tab-content button').forEach(el => el.disabled = true);
    getEls('.tab-content').forEach(tab => tab.classList.add('editor-disabled'));
    
    ['wastelandContent', 'inventoryContent', 'dwellersList', 'roomsList'].forEach(id => { if(getEl(id)) getEl(id).style.display = 'none'; });
    ['wastelandEmptyState', 'inventoryEmptyState', 'dwellersEmptyState', 'roomsEmptyState'].forEach(id => { if(getEl(id)) getEl(id).style.display = 'block'; });
    
    resetEditorFields();
}

function resetEditorFields() {
    ['vaultName', 'caps', 'food', 'water', 'power', 'radaway', 'stimpacks', 'nukacola', 'nukaquantum', 'lunchboxCount', 'handyCount', 'petCarrierCount', 'starterPackCount'].forEach(id => {
        if(getEl(id)) getEl(id).value = id === 'vaultName' ? '' : '0';
    });
    ['dwellerFirstName', 'dwellerLastName', 'dwellerLevel', 'dwellerExp', 'dwellerHealth', 'dwellerMaxHealth', 'dwellerHappiness', 'dwellerRadiation'].forEach(id => {
        if(getEl(id)) getEl(id).value = '';
    });
    ['s', 'p', 'e', 'c', 'i', 'a', 'l'].forEach(stat => {
        if(getEl(`stat-${stat}`)) getEl(`stat-${stat}`).value = '1';
    });
    if(getEl('dwellersList')) getEl('dwellersList').innerHTML = '';
    if(getEl('roomsList')) getEl('roomsList').innerHTML = '';
    originalFieldValues = {};
    clearAllFieldIndicators();
}

function trackFieldChange(fieldId) {
    const elem = getEl(fieldId);
    if (!elem) return;
    
    const currentValue = elem.value;
    const originalValue = originalFieldValues[fieldId];
    
    elem.parentElement.querySelector('.field-indicator')?.remove();
    if (originalValue === undefined) { elem.classList.remove('field-modified', 'field-original'); return; }
    
    const isModified = currentValue !== originalValue;
    elem.classList.toggle('field-modified', isModified);
    elem.classList.toggle('field-original', !isModified);
    
    const indicator = document.createElement('span');
    indicator.className = `field-indicator field-indicator-${isModified ? 'modified' : 'original'}`;
    indicator.innerHTML = isModified ? '<i class="fas fa-circle"></i>' : '<i class="fas fa-check"></i>';
    indicator.title = isModified ? `Modified (Original: ${originalValue})` : 'Original value from save file';
    elem.parentElement.appendChild(indicator);
}

function storeOriginalValue(fieldId, value) { originalFieldValues[fieldId] = String(value); }

function clearAllFieldIndicators() {
    getEls('.field-indicator').forEach(el => el.remove());
    getEls('.field-modified, .field-original').forEach(el => el.classList.remove('field-modified', 'field-original'));
}

function populateVaultData() {
    if (!currentData?.vault) return;
    const vault = currentData.vault, storage = vault.storage?.resources || {};
    
    const fields = {
        'vaultName': vault.VaultName || '',
        'vaultNumber': vault.VaultMode || 0,
        'caps': Math.floor(storage.Nuka || 0),
        'food': Math.floor(storage.Food || 0),
        'water': Math.floor(storage.Water || 0),
        'power': Math.floor(storage.Energy || 0),
        'radaway': Math.floor(storage.RadAway || 0),
        'stimpacks': Math.floor(storage.StimPack || 0),
        'nukacola': Math.floor(storage.NukaColaQuantum || 0),
        'nukaquantum': Math.floor(storage.NukaColaQuantum || 0)
    };
    
    Object.entries(fields).forEach(([id, val]) => {
        const el = getEl(id);
        if (el) { el.value = val; storeOriginalValue(id, val); trackFieldChange(id); }
    });
}

let dwellerSortAscending = true;
function toggleDwellerSortOrder() {
    dwellerSortAscending = !dwellerSortAscending;
    const btn = getEl('dwellerSortOrder');
    if (btn) {
        btn.innerHTML = `<i class="fas fa-arrow-${dwellerSortAscending ? 'down-a-z' : 'up-z-a'}"></i>`;
        btn.title = `${dwellerSortAscending ? 'Ascending' : 'Descending'} order`;
    }
    populateDwellersList();
}

function populateDwellersList() {
    const list = getEl('dwellersList');
    if (!list) return;
    if (!currentData?.dwellers?.dwellers?.length) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-${!currentData ? 'folder' : 'frown'}"></i> ${!currentData ? 'No vault loaded yet!<br><small>Upload a save file to get started</small>' : 'No dwellers found in this vault'}</div>`;
        return;
    }
    
    list.innerHTML = '';
    const sortBy = getEl('dwellerSort')?.value || 'name';
    const exploringIds = new Set(currentData.vault?.wasteland?.teams?.flatMap(t => t.members?.map(m => m.id || m.dwellerId) || []) || []);
    
    const inVault = [], exploring = [];
    currentData.dwellers.dwellers.forEach((dweller, index) => {
        (exploringIds.has(dweller.id) ? exploring : inVault).push({ dweller, index });
    });
    
    const sortFn = (a, b) => {
        let res = 0;
        if (sortBy === 'level') res = (b.dweller.experience?.currentLevel || 1) - (a.dweller.experience?.currentLevel || 1);
        else if (sortBy === 'health') res = (b.dweller.health?.healthValue || 0) - (a.dweller.health?.healthValue || 0);
        else if (sortBy === 'gender') res = (a.dweller.gender || 1) - (b.dweller.gender || 1);
        else if (sortBy === 'happiness') res = (b.dweller.happiness?.happinessValue || 0) - (a.dweller.happiness?.happinessValue || 0);
        else res = `${a.dweller.name||''} ${a.dweller.lastName||''}`.trim().toLowerCase().localeCompare(`${b.dweller.name||''} ${b.dweller.lastName||''}`.trim().toLowerCase());
        return dwellerSortAscending ? res : -res;
    };
    
    inVault.sort(sortFn); exploring.sort(sortFn);
    
    const renderSection = (arr, icon, title, isExploring) => {
        if (!arr.length) return;
        const header = document.createElement('div');
        header.className = `dweller-section-header ${isExploring ? 'exploring' : ''}`;
        header.innerHTML = `<i class="fas fa-${icon}"></i> ${title} (${arr.length})`;
        list.appendChild(header);
        
        arr.forEach(({ dweller, index }) => {
            const item = document.createElement('div');
            item.className = `dweller-item ${isExploring ? 'exploring' : 'in-vault'}`;
            const genderIco = dweller.gender === 2 ? '<i class="fas fa-mars" style="color:#4A90E2;"></i>' : '<i class="fas fa-venus" style="color:#E91E63;"></i>';
            item.innerHTML = `${genderIco} ${`${dweller.name||''} ${dweller.lastName||''}`.trim() || 'Unknown'} (Lvl ${dweller.experience?.currentLevel || 1} • HP: ${dweller.health?.healthValue || dweller.health?.maxHealth || 100})`;
            item.addEventListener('click', (e) => selectDweller(dweller, index, e));
            list.appendChild(item);
        });
    };
    
    renderSection(inVault, 'home', 'IN VAULT', false);
    renderSection(exploring, 'globe', 'EXPLORING', true);
}

function filterDwellers() {
    const q = getEl('dwellerSearch')?.value.toLowerCase();
    if (q === undefined) return;
    getEls('.dweller-item').forEach(item => item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none');
}

function selectDweller(dweller, index, event) {
    currentDweller = { data: dweller, index };
    getEls('.dweller-item').forEach(i => i.classList.remove('active'));
    if (event?.target) event.target.closest('.dweller-item')?.classList.add('active');
    
    if(getEl('dwellerDetailsEmptyState')) getEl('dwellerDetailsEmptyState').style.display = 'none';
    if(getEl('dwellerDetailsContent')) getEl('dwellerDetailsContent').style.display = 'block';
    if(getEl('dwellerName')) getEl('dwellerName').textContent = `${dweller.name||''} ${dweller.lastName||''}`.trim() || 'Unknown';
    
    const setVal = (id, val, hex = false) => {
        const el = getEl(id);
        if (el) { 
            let finalVal = val;
            if (hex && val !== undefined) finalVal = '#' + (val & 0xFFFFFF).toString(16).padStart(6, '0');
            el.value = finalVal; storeOriginalValue(id, finalVal); trackFieldChange(id); 
        }
    };
    
    setVal('dwellerFirstName', dweller.name || '');
    setVal('dwellerLastName', dweller.lastName || '');
    setVal('dwellerGender', dweller.gender || 1);
    setVal('dwellerLevel', dweller.experience?.currentLevel || 1);
    setVal('dwellerExp', dweller.experience?.experienceValue || 0);
    setVal('dwellerHealth', dweller.health?.healthValue || dweller.health?.maxHealth || 100);
    setVal('dwellerMaxHealth', dweller.health?.maxHealth || 100);
    setVal('dwellerRadiation', dweller.health?.radiationValue || 0);
    setVal('dwellerHappiness', Math.round(dweller.happiness?.happinessValue || 50));
    setVal('dwellerSkinColor', dweller.skinColor, true);
    setVal('dwellerHairColor', dweller.hairColor, true);
    setVal('dwellerHairStyle', dweller.hair || '10');
    if(getEl('dwellerSerializeId')) getEl('dwellerSerializeId').value = dweller.serializeId || 1;
    setVal('dwellerRarity', dweller.rarity || 'Common');
    setVal('dwellerSavedRoom', dweller.savedRoom ?? -1);
    setVal('dwellerPregnant', (dweller.pregnant || false).toString());
    setVal('dwellerBabyReady', (dweller.babyReady || false).toString());
    setVal('dwellerPartner', dweller.relations?.partner ?? -1);
    setVal('dwellerWeapon', dweller.equipedWeapon?.id || dweller.equippedWeapon?.id || '');
    setVal('dwellerOutfit', dweller.equipedOutfit?.id || dweller.equippedOutfit?.id || '');

    ['s', 'p', 'e', 'c', 'i', 'a', 'l'].forEach((stat, i) => setVal(`stat-${stat}`, dweller.stats?.stats?.[i]?.value || 1));
}

function updateDwellerData() {
    if (!currentDweller || !currentData) return;
    const d = currentDweller.data;
    
    d.name = getEl('dwellerFirstName')?.value || '';
    d.lastName = getEl('dwellerLastName')?.value || '';
    if(getEl('dwellerGender')) d.gender = parseInt(getEl('dwellerGender').value) || 1;
    
    d.experience = d.experience || {};
    if(getEl('dwellerLevel')) d.experience.currentLevel = parseInt(getEl('dwellerLevel').value) || 1;
    if(getEl('dwellerExp')) d.experience.experienceValue = parseInt(getEl('dwellerExp').value) || 0;
    
    d.health = d.health || {};
    if(getEl('dwellerHealth')) d.health.healthValue = parseInt(getEl('dwellerHealth').value) || 100;
    if(getEl('dwellerMaxHealth')) d.health.maxHealth = parseInt(getEl('dwellerMaxHealth').value) || 100;
    if(getEl('dwellerRadiation')) d.health.radiationValue = parseInt(getEl('dwellerRadiation').value) || 0;
    
    d.happiness = d.happiness || {};
    if(getEl('dwellerHappiness')) d.happiness.happinessValue = parseInt(getEl('dwellerHappiness').value) || 50;
    
    const sCol = getEl('dwellerSkinColor')?.value, hCol = getEl('dwellerHairColor')?.value;
    if (sCol) d.skinColor = (0xFF000000 | parseInt(sCol.replace('#', ''), 16)) >>> 0;
    if (hCol) d.hairColor = (0xFF000000 | parseInt(hCol.replace('#', ''), 16)) >>> 0;
    
    if(getEl('dwellerHairStyle')) d.hair = getEl('dwellerHairStyle').value || '10';
    if(getEl('dwellerRarity')) d.rarity = getEl('dwellerRarity').value || 'Common';
    if(getEl('dwellerSavedRoom')) d.savedRoom = parseInt(getEl('dwellerSavedRoom').value) || -1;
    if(getEl('dwellerPregnant')) d.pregnant = getEl('dwellerPregnant').value === 'true';
    if(getEl('dwellerBabyReady')) d.babyReady = getEl('dwellerBabyReady').value === 'true';
    
    if(getEl('dwellerPartner')) {
        d.relations = d.relations || { relations: [], partner: -1, lastPartner: -1, ascendants: [-1,-1,-1,-1,-1,-1] };
        d.relations.partner = parseInt(getEl('dwellerPartner').value) || -1;
    }
    
    d.stats = d.stats || { stats: [] };
    while (d.stats.stats.length < 7) d.stats.stats.push({ value: 1, mod: 0, exp: 0 });
    ['s', 'p', 'e', 'c', 'i', 'a', 'l'].forEach((id, i) => {
        if(getEl(`stat-${id}`)) d.stats.stats[i].value = parseInt(getEl(`stat-${id}`).value) || 1;
    });
    
    const wVal = getEl('dwellerWeapon')?.value, oVal = getEl('dwellerOutfit')?.value;
    if (getEl('dwellerWeapon')) d.equipedWeapon = { id: wVal || 'Fist', type: 'Weapon', hasBeenAssigned: false, hasRandonWeaponBeenAssigned: false };
    if (getEl('dwellerOutfit')) d.equipedOutfit = { id: oVal || 'jumpsuit', type: 'Outfit', hasBeenAssigned: false, hasRandonWeaponBeenAssigned: false };
    
    getEl('jsonEditor').value = JSON.stringify(currentData, null, 2);
    updateFileSize();
    addToHistory('Dweller Updated', `Modified ${currentDweller.name || 'Unknown'}`);
}

function maxDwellerStats() {
    ['s', 'p', 'e', 'c', 'i', 'a', 'l'].forEach(s => { if(getEl(`stat-${s}`)) getEl(`stat-${s}`).value = 10; });
    updateDwellerData();
    showToast('Dweller stats maximized!');
}

function saveDwellerChanges() { updateDwellerData(); showToast('Dweller changes saved!'); }

function populateRoomsList() {
    const list = getEl('roomsList');
    if (!list) return;
    if (!currentData?.vault?.rooms?.length) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-${!currentData ? 'folder' : 'person-digging'}"></i> ${!currentData ? 'No vault loaded yet!' : 'No rooms listed here :('}</div>`;
        return;
    }
    
    list.innerHTML = '';
    currentData.vault.rooms.forEach((room, index) => {
        const item = document.createElement('div');
        item.className = 'dweller-item room-item';
        item.textContent = `${room.type || 'Unknown'} - Lvl ${room.level || 1}`;
        item.addEventListener('click', () => editRoom(index, room));
        list.appendChild(item);
    });
}

// Wasteland & Teams
let currentWastelandTeam = null;
function populateWastelandTeams() {
    const list = getEl('wastelandTeamsList');
    if (!list) return;
    if (!currentData?.vault?.wasteland?.teams?.length) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-${!currentData ? 'folder' : 'mountain-sun'}"></i> ${!currentData ? 'No vault loaded yet!' : 'No teams in the wasteland'}</div>`;
        return;
    }
    
    list.innerHTML = '';
    currentData.vault.wasteland.teams.forEach((team, index) => {
        const item = document.createElement('div');
        item.className = 'wasteland-team-item';
        item.textContent = `${team.name || team.id || `Team ${index + 1}`} - ${team.status || team.state || 'exploring'}`;
        item.addEventListener('click', e => {
            currentWastelandTeam = { data: team, index };
            getEls('.wasteland-team-item').forEach(i => i.classList.remove('active'));
            e.target.closest('.wasteland-team-item').classList.add('active');
            if(getEl('wastelandTeamDetails')) getEl('wastelandTeamDetails').style.display = 'block';
            if(getEl('wastelandTeamName')) getEl('wastelandTeamName').textContent = team.name || team.id || `Team ${index + 1}`;
            if(getEl('teamId')) getEl('teamId').value = team.id || '';
            if(getEl('teamStatus')) getEl('teamStatus').value = team.status || team.state || 'exploring';
            if(getEl('teamQuestId')) getEl('teamQuestId').value = team.questId || team.quest?.id || '';
            if(getEl('teamQuestProgress')) getEl('teamQuestProgress').value = team.progress || team.quest?.progress || 0;
            if(getEl('teamCaps')) getEl('teamCaps').value = team.caps || team.resources?.caps || 0;
            if(getEl('teamItems')) getEl('teamItems').value = team.items?.length || team.itemCount || 0;
        });
        list.appendChild(item);
    });
}

function updateWastelandTeam() {
    if (!currentWastelandTeam || !currentData.vault.wasteland) return;
    const t = currentWastelandTeam.data;
    const stat = getEl('teamStatus')?.value, qId = getEl('teamQuestId')?.value;
    const prog = parseInt(getEl('teamQuestProgress')?.value)||0, caps = parseInt(getEl('teamCaps')?.value)||0, items = parseInt(getEl('teamItems')?.value)||0;
    
    if(t.status !== undefined) t.status = stat; else if(t.state !== undefined) t.state = stat;
    if(t.questId !== undefined) t.questId = qId; else if(t.quest?.id !== undefined) t.quest.id = qId;
    if(t.progress !== undefined) t.progress = prog; else if(t.quest?.progress !== undefined) t.quest.progress = prog;
    if(t.caps !== undefined) t.caps = caps; else if(t.resources?.caps !== undefined) t.resources.caps = caps;
    if(t.itemCount !== undefined) t.itemCount = items;
    
    getEl('jsonEditor').value = JSON.stringify(currentData, null, 2); updateFileSize(); populateWastelandTeams(); showToast('Team updated!');
}

function recallTeam() {
    if (!currentWastelandTeam) return;
    const t = currentWastelandTeam.data;
    if(t.status !== undefined) t.status = 'returning'; else if(t.state !== undefined) t.state = 'returning';
    if(t.progress !== undefined) t.progress = 100; else if(t.quest?.progress !== undefined) t.quest.progress = 100;
    updateWastelandTeam(); showToast('Team recalled!');
}

function maxTeamResources() {
    if (!currentWastelandTeam) return;
    const t = currentWastelandTeam.data;
    if(t.caps !== undefined) t.caps = 999999; else if(t.resources) t.resources.caps = 999999; else t.caps = 999999;
    if(t.itemCount !== undefined) t.itemCount = 999;
    updateWastelandTeam(); showToast('Team resources maximized!');
}

// Inventory
function switchInventorySubtab(subtab) {
    getEls('.inventory-subtab-btn').forEach(b => b.classList.toggle('active', b.dataset.subtab === subtab));
    getEls('.inventory-subtab-content').forEach(c => c.classList.remove('active'));
    getEl(`${subtab}-inventory`)?.classList.add('active');
}

function populateInventory() { if(!currentData) return; populateList('weapons', 'Weapon', 'gun'); populateList('outfits', 'Outfit', 'vest'); populateList('junk', 'Junk', 'wrench'); }

function populateList(id, type, icon) {
    const list = getEl(`${id}List`);
    if (!list) return;
    const items = currentData.vault?.inventory?.items?.filter(i => i.type === type) || currentData.inventory?.[id] || currentData[id] || [];
    if (!items.length) { list.innerHTML = `<div class="empty-state"><i class="fas fa-${icon}"></i> No ${id} in storage</div>`; return; }
    list.innerHTML = items.map((it, idx) => `
        <div class="inventory-item">
            <div class="inventory-item-header"><div class="inventory-item-name" title="${it.id || `${type} ${idx+1}`}">${it.id || `${type} ${idx+1}`}</div><div class="inventory-item-type">${it.type || type}</div></div>
            <div class="inventory-item-details"><span class="inventory-item-stat"><strong>${type==='Weapon'?`DMG ${it.damage||it.damageValue||0}`:type==='Outfit'?(Object.keys(it.stats||{}).length?'<i class="fas fa-check" style="color:green;"></i>':'—'):'Item'}</strong></span></div>
            <div class="inventory-item-actions"><button class="btn btn-secondary" onclick="editInventoryItem(${idx}, '${type.toLowerCase()}')">ℹ️</button><button class="btn btn-secondary" onclick="deleteInventoryItem(${idx}, '${type.toLowerCase()}')">🗑️</button></div>
        </div>
    `).join('');
}

function editInventoryItem(idx, type) {
    const items = currentData.vault?.inventory?.items?.filter(i => i.type.toLowerCase() === type);
    if (!items || idx >= items.length) return;
    alert(`Item: ${items[idx].id}\nType: ${items[idx].type}\nAssigned: ${items[idx].hasBeenAssigned ? 'Yes' : 'No'}\n\nNote: Use Add/Delete buttons for quantities.`);
}

function deleteInventoryItem(idx, type) {
    if (!confirm('Delete this item?')) return;
    const invItems = currentData.vault?.inventory?.items;
    if (!invItems) return;
    const filtered = invItems.filter(i => i.type.toLowerCase() === type);
    if (idx >= filtered.length) return;
    invItems.splice(invItems.indexOf(filtered[idx]), 1);
    getEl('jsonEditor').value = JSON.stringify(currentData, null, 2); updateFileSize(); populateInventory(); showToast('Item deleted!');
}

let currentModalType = '';
function addInventoryItem(type) {
    currentModalType = type;
    const mod = getEl('addInventoryModal'), sel = getEl('modalItemSelect'), dmg = getEl('modalDamageRow');
    getEl('modalTitle').textContent = `Add ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    sel.innerHTML = '<option value="">Choose...</option>';
    const src = type === 'weapon' ? WEAPONS : type === 'outfit' ? OUTFITS : JUNK;
    dmg.style.display = 'none';
    Object.entries(src).sort((a,b)=>a[1].localeCompare(b[1])).forEach(([k,v]) => { if(k!=='None'&&k!=='Fist') sel.innerHTML += `<option value="${k}">${v}</option>`; });
    getEl('modalQuantity').value = 1;
    mod.classList.add('active');
}

function closeInventoryModal() { getEl('addInventoryModal').classList.remove('active'); currentModalType = ''; }
function confirmAddInventoryItem() {
    const sel = getEl('modalItemSelect'), qty = parseInt(getEl('modalQuantity').value) || 1;
    if (!sel.value || qty < 1) return showToast(!sel.value ? 'Select an item!' : 'Invalid quantity!');
    
    if(!currentData.vault) currentData.vault = {}; if(!currentData.vault.inventory) currentData.vault.inventory = {}; if(!currentData.vault.inventory.items) currentData.vault.inventory.items = [];
    for(let i=0; i<qty; i++) currentData.vault.inventory.items.push({ id: sel.value, type: currentModalType==='weapon'?'Weapon':currentModalType==='outfit'?'Outfit':'Junk', hasBeenAssigned: false, hasRandonWeaponBeenAssigned: false });
    
    getEl('jsonEditor').value = JSON.stringify(currentData, null, 2); updateFileSize(); populateInventory(); showToast(`${qty}x added!`); closeInventoryModal();
}

// Bulk & Utilities
function maxAllDwellerStats() {
    if (!currentData?.dwellers?.dwellers?.length) return showToast('No dwellers');
    currentData.dwellers.dwellers.forEach(d => {
        d.experience = d.experience || {}; d.experience.currentLevel = 50; d.experience.experienceValue = 999999;
        d.stats = d.stats || {stats:[]}; for(let i=0; i<7; i++) d.stats.stats[i] = {value:10, mod:0, exp:999999};
    });
    createBackup('Max All Stats'); getEl('jsonEditor').value = JSON.stringify(currentData, null, 2); updateFileSize(); populateDwellersList(); showToast('Stats maxed!');
}
function maxAllHappiness() {
    if (!currentData?.dwellers?.dwellers?.length) return showToast('No dwellers');
    currentData.dwellers.dwellers.forEach(d => { d.happiness = d.happiness || {}; d.happiness.happinessValue = 100; });
    createBackup('Max Happiness'); getEl('jsonEditor').value = JSON.stringify(currentData, null, 2); updateFileSize(); populateDwellersList(); showToast('Happiness maxed!');
}
function healAllDwellers() {
    if (!currentData?.dwellers?.dwellers?.length) return showToast('No dwellers');
    currentData.dwellers.dwellers.forEach(d => { d.health = d.health || {}; d.health.healthValue = d.health.maxHealth || 105; d.health.radiationValue = 0; });
    createBackup('Heal All'); getEl('jsonEditor').value = JSON.stringify(currentData, null, 2); updateFileSize(); populateDwellersList(); showToast('Dwellers healed!');
}
function unlockAllRooms() {
    if (!currentData?.vault?.rooms?.length) return showToast('No rooms');
    currentData.vault.rooms.forEach(r => { if(r.currentStateName) r.currentStateName='Idle'; if(r.rushTask!==undefined) r.rushTask=-1; if(r.level<3) r.level=3; });
    createBackup('Unlock Rooms'); getEl('jsonEditor').value = JSON.stringify(currentData, null, 2); updateFileSize(); populateRoomsList(); showToast('Rooms upgraded!');
}
function unlockAllThemes() {
    if (!currentData?.specialTheme) return showToast('No themes data');
    Object.keys(currentData.specialTheme).forEach(k => { if(typeof currentData.specialTheme[k]==='boolean') currentData.specialTheme[k]=true; });
    createBackup('Unlock Themes'); getEl('jsonEditor').value = JSON.stringify(currentData, null, 2); updateFileSize(); showToast('Themes unlocked!');
}
function clearAllEmergencies() {
    if (!currentData?.vault?.rooms?.length) return showToast('No rooms');
    currentData.vault.rooms.forEach(r => { r.emergencyDone = true; if(r.currentStateName && r.currentStateName!=='Idle') r.currentStateName='Idle'; });
    createBackup('Clear Emergencies'); getEl('jsonEditor').value = JSON.stringify(currentData, null, 2); updateFileSize(); populateRoomsList(); showToast('Emergencies cleared!');
}

function showWastelandContent() { if(currentData) { getEl('wastelandEmptyState').style.display='none'; getEl('wastelandContent').style.display='block'; } }
function showInventoryContent() { if(currentData) { getEl('inventoryEmptyState').style.display='none'; getEl('inventoryContent').style.display='block'; } }
function showDwellersContent() { if(currentData) { getEl('dwellersEmptyState').style.display='none'; getEl('dwellersList').style.display='block'; } }
function showRoomsContent() { if(currentData) { getEl('roomsEmptyState').style.display='none'; getEl('roomsList').style.display='block'; } }

function filterInventory(type, term) { getEls(`#${type}-inventory .inventory-item`).forEach(i => i.style.display = i.textContent.toLowerCase().includes(term.toLowerCase()) ? 'flex' : 'none'); }
function filterWastelandTeams(term) { getEls('.wasteland-team-item').forEach(i => i.style.display = i.textContent.toLowerCase().includes(term.toLowerCase()) ? 'flex' : 'none'); }
function filterRecipes(term) { getEls('.recipe-checkbox').forEach(i => i.style.display = i.textContent.toLowerCase().includes(term.toLowerCase()) ? 'flex' : 'none'); }

function debounce(func, wait) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => func(...args), wait); }; }
function formatFileSize(bytes) { if (!bytes) return '0 B'; const k = 1024, i = Math.floor(Math.log(bytes) / Math.log(k)); return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + ['B', 'KB', 'MB', 'GB'][i]; }
function updateFileSize() { getEl('fileSize').textContent = `Size: ${currentData ? formatFileSize(new Blob([JSON.stringify(currentData)]).size) : '0 B'}`; }

function handleSearch(e) {
    const q = e.target.value.toLowerCase(), res = getEl('searchResults'); res.innerHTML = '';
    if (!q || !currentData) return;
    const results = []; searchInObject(currentData, q, [], results);
    if (!results.length) { res.innerHTML = '<div style="padding:15px;color:#999;">No results</div>'; return; }
    res.innerHTML = results.slice(0, 20).map(r => `<div class="search-result-item"><div class="search-result-path">${r.path||'root'}</div><div class="search-result-value">${JSON.stringify(r.value).substring(0,100)}</div></div>`).join('');
}
function searchInObject(obj, q, path, res) {
    if (!obj || res.length > 50) return;
    if (Array.isArray(obj)) obj.forEach((v, i) => { const p = [...path, `[${i}]`]; if(JSON.stringify(v).toLowerCase().includes(q)) res.push({path:p.join('.'), value:v}); searchInObject(v, q, p, res); });
    else if (typeof obj === 'object') Object.entries(obj).forEach(([k, v]) => { const p = [...path, k]; if(JSON.stringify(v).toLowerCase().includes(q)) res.push({path:p.join('.'), value:v}); searchInObject(v, q, p, res); });
}

function handleEditorChange() { try { currentData = JSON.parse(getEl('jsonEditor').value); getEl('errorMessage').textContent = ''; updateFileSize(); } catch (err) { getEl('errorMessage').textContent = `JSON Error: ${err.message}`; } }
function formatJSON() { try { getEl('jsonEditor').value = JSON.stringify(JSON.parse(getEl('jsonEditor').value), null, 2); getEl('errorMessage').textContent = ''; updateFileSize(); showToast('Formatted!'); } catch(e){} }
function clearEditor() {
    if(!confirm('Clear editor?')) return;
    currentData = originalData = currentDweller = originalFileName = null; backups = []; changeHistory = [];
    getEl('jsonEditor').value = ''; getEl('fileInfo').textContent = ''; getEl('errorMessage').textContent = ''; getEl('searchResults').innerHTML = '';
    ['downloadBtn', 'formatBtn', 'clearBtn'].forEach(id => getEl(id).disabled = true); updateFileSize();
    ['vaultName', 'caps', 'food', 'water', 'power', 'radaway', 'stimpacks', 'nukacola', 'lunchboxCount', 'handyCount', 'petCarrierCount', 'dwellerSearch'].forEach(id => { if(getEl(id)) getEl(id).value = ''; });
    if(getEl('dwellersList')) getEl('dwellersList').innerHTML = '';
    showToast('Editor cleared!');
}
function switchTab(e) { getEls('.tab-btn').forEach(b=>b.classList.remove('active')); getEls('.tab-content').forEach(c=>c.classList.remove('active')); e.target.classList.add('active'); getEl(e.target.dataset.tab)?.classList.add('active'); }

function downloadSave() {
    if (!currentData) return;
    const val = validateSaveFile(currentData);
    if (!val.valid && !confirm(`⚠️ Validation warnings:\n${val.warnings.join('\n')}\nDownload anyway?`)) return;
    const format = prompt('1. .sav (encrypted)\n2. .json (plain)\nEnter 1 or 2:', '1');
    const baseName = originalFileName?.replace(/\.[^/.]+$/, '') || `Vault${Math.floor(Math.random()*1000)}`;
    if (format === '1') {
        const res = SaveDecryptor.encrypt(currentData);
        if(res.success) { downloadBlob(res.data, `${baseName}.sav`, 'text/plain'); addToHistory('Download', '.sav'); showToast('Downloaded .sav!'); }
        else getEl('errorMessage').textContent = `Encrypt error: ${res.error}`;
    } else if (format === '2') { downloadBlob(JSON.stringify(currentData, null, 2), `${baseName}.json`, 'application/json'); addToHistory('Download', '.json'); showToast('Downloaded .json!'); }
}
function downloadBlob(data, name, type) { const u = URL.createObjectURL(new Blob([data], {type})); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); }

// Rooms Edit
let currentRoomIndex = null;
function editRoom(idx, room) {
    currentRoomIndex = idx;
    if(getEl('roomTitle')) getEl('roomTitle').textContent = room.name || 'Room';
    const maps = { roomName:['name','Name'], roomType:['type','Type','roomType'], roomLevel:['level','Level','roomLevel'], roomState:['state','State','roomState'], roomPower:['power','powerGeneration'], roomFood:['food','foodProduction'], roomWater:['water','waterProduction'], roomRadiation:['radiation','radiationLevel'] };
    Object.entries(maps).forEach(([id, props]) => {
        const input = getEl(id); if(!input) return;
        const val = props.reduce((res, p) => res !== null ? res : (p in room ? room[p] : null), null);
        input.value = val !== null ? val : (id==='roomLevel'?1:id==='roomState'?'built':0);
        input.disabled = val === null; input.classList.toggle('field-unavailable', val === null); input.title = val === null ? 'Property missing' : '';
    });
    if(getEl('roomDetailsEmptyState')) getEl('roomDetailsEmptyState').style.display='none'; if(getEl('roomDetailsContent')) getEl('roomDetailsContent').style.display='block';
    getEls('.room-item').forEach((it, i) => it.classList.toggle('active', i===idx));
}
function saveRoom() {
    if (currentRoomIndex===null || !currentData.vault.rooms[currentRoomIndex]) return;
    const r = currentData.vault.rooms[currentRoomIndex];
    ['Name','Type','Level','State','Power','Food','Water','Radiation','RushTimer','MergeSize'].forEach(k => {
        const val = getEl(`room${k}`)?.value;
        if(val!==undefined && !getEl(`room${k}`).disabled) { const key = k.toLowerCase(); if(key in r || ['name','type','level','state'].includes(key)) r[key] = isNaN(val)||key==='name'||key==='type'||key==='state'?val:parseInt(val); }
    });
    populateRoomsList(); closeRoomEditor(); handleEditorChange(); showToast('Room updated');
}
function closeRoomEditor() { currentRoomIndex=null; if(getEl('roomDetailsEmptyState')) getEl('roomDetailsEmptyState').style.display='flex'; if(getEl('roomDetailsContent')) getEl('roomDetailsContent').style.display='none'; getEls('.room-item').forEach(i=>i.classList.remove('active')); }

// Seasons Data
function updateSeasonPassData() {
    if(!currentData) return;
    ['Level','Tokens','Version'].forEach(k => { const v=parseInt(getEl(k==='Version'?'schemaVersion':`current${k}`)?.value); if(v) currentData[k==='Version'?'schemaVersion':`current${k}`]=v; });
    const sk = currentData.currentSeason || Object.keys(currentData.seasonsData||{})[0];
    if(sk && currentData.seasonsData?.[sk]) {
        const sd = currentData.seasonsData[sk];
        sd.isPremium = getEl('isPremium')?.value==='true'; sd.isPremiumPlus = getEl('isPremiumPlus')?.value==='true';
        const mx = parseInt(getEl('maxRankAchieved')?.value); if(mx) sd.maxRankAchieved = mx;
    }
    getEl('jsonEditor').value = JSON.stringify(currentData, null, 2); updateFileSize();
}
function populateSeasonPassData() {
    if(!currentData) return;
    if(getEl('currentSeason')) getEl('currentSeason').value = currentData.currentSeason || '';
    ['Level','Tokens','Version'].forEach(k => { if(getEl(k==='Version'?'schemaVersion':`current${k}`)) getEl(k==='Version'?'schemaVersion':`current${k}`).value = parseInt(currentData[k==='Version'?'schemaVersion':`current${k}`])||0; });
    const sk = currentData.currentSeason || Object.keys(currentData.seasonsData||{})[0], sd = currentData.seasonsData?.[sk] || {};
    if(getEl('isPremium')) getEl('isPremium').value = (sd.isPremium==true).toString();
    if(getEl('isPremiumPlus')) getEl('isPremiumPlus').value = (sd.isPremiumPlus==true).toString();
    if(getEl('maxRankAchieved')) getEl('maxRankAchieved').value = parseInt(sd.maxRankAchieved)||0;
    if(getEl('downloadSeasonPassBtn')) getEl('downloadSeasonPassBtn').disabled = false;
    populateSeasonRewards(sd);
}
function populateSeasonRewards(sd) {
    const list = getEl('seasonRewardsList'); if(!list || !currentData) return;
    const fR = sd?.freeRewardsList||[], pR = sd?.premiumRewardsList||[];
    if(!fR.length && !pR.length) { list.innerHTML = '<div class="no-data-message"><p>No season pass data loaded</p></div>'; return; }
    list.innerHTML = '';
    const render = (arr, title, cls) => {
        if(!arr.length) return; list.innerHTML += `<div style="margin-top:${cls?20:0}px"><h4 style="color:${cls?'#D4AF37':'#8B4513'}">${title}</h4></div>` + arr.map(r => `<div class="season-reward-item ${cls}"><div class="reward-info"><div class="reward-level">Level ${r.levelRequired||1}</div><div class="reward-type">${r.rewardType||'unknown'}</div>${r.dataValString||r.dataValInt?`<div class="reward-value">${r.dataValString||r.dataValInt}</div>`:''}</div></div>`).join('');
    };
    render(fR, 'Free Tier Rewards', ''); render(pR, 'Premium Tier Rewards', 'premium');
}

// Recipes
function populateRecipesList() {
    const list = getEl('recipesList'); if(!list) return;
    if(!currentData?.recipes?.length) { list.innerHTML = '<p>No recipes</p>'; return; }
    list.innerHTML = currentData.recipes.map((r,i) => `<div class="recipe-checkbox"><input type="checkbox" id="rec-${i}" ${r.locked!==false?'':'checked'} data-idx="${i}"><label for="rec-${i}">${r.name||r.id||`Recipe ${i+1}`}</label></div>`).join('');
}
function showRecipesEditor() { populateRecipesList(); const p=getEl('recipesEditorPanel'); if(p) { p.style.display='block'; p.scrollIntoView(); } }
function closeRecipesEditor() { if(getEl('recipesEditorPanel')) getEl('recipesEditorPanel').style.display='none'; }
function saveRecipesChanges() { getEls('#recipesList input').forEach(c => { if(currentData.recipes[c.dataset.idx]) currentData.recipes[c.dataset.idx].locked = !c.checked; }); createBackup('Edit Recipes'); getEl('jsonEditor').value=JSON.stringify(currentData,null,2); updateFileSize(); closeRecipesEditor(); showToast('Saved!'); }
function recipeSelectAll() { getEls('#recipesList input').forEach(c => c.checked=true); }
function recipeDeselectAll() { getEls('#recipesList input').forEach(c => c.checked=false); }

// Stats & Validation
function populateVaultStats() {
    const noData = getEl('statsNoData'), grid = getEl('statsGridContainer');
    if(!currentData) { if(noData) noData.style.display='flex'; if(grid) grid.style.display='none'; return; }
    if(noData) noData.style.display='none'; if(grid) grid.style.display='grid';
    const dw = currentData.dwellers?.dwellers||[], r = currentData.vault?.rooms||[], res = currentData.vault?.storage?.resources||{};
    
    getEl('statTotalDwellers').textContent = dw.length;
    getEl('statTotalRooms').textContent = r.length;
    ['Caps','Food','Water','Power'].forEach(k => { if(getEl(`stat${k==='Caps'?'TotalCaps':k}`)) getEl(`stat${k==='Caps'?'TotalCaps':k}`).textContent = (res[k==='Caps'?'Nuka':k==='Power'?'Energy':k]||0).toLocaleString(); });
    populateVaultLayout();
}
function populateVaultLayout() {
    if(!currentData?.vault) { if(getEl('layoutNoData')) getEl('layoutNoData').style.display='flex'; if(getEl('vaultGridContainer')) getEl('vaultGridContainer').style.display='none'; return; }
    if(getEl('layoutNoData')) getEl('layoutNoData').style.display='none'; if(getEl('vaultGridContainer')) getEl('vaultGridContainer').style.display='block';
    const r = currentData.vault.rooms||[], g = getEl('vaultGrid'); g.innerHTML='';
    r.forEach((room, i) => { const t = document.createElement('div'); t.className=`room-tile tier-${Math.max(0,(room.level||1)-1)}`; t.innerHTML=`<div class="room-tile-icon">🏗️</div><div class="room-tile-name">${room.type||'Room'}</div>`; g.appendChild(t); });
}
function validateSaveFile(d) { const w=[]; if(!d.vault) w.push('Missing vault'); if(!d.dwellers) w.push('Missing dwellers'); return {valid:!w.length, warnings:w}; }

// Guides
function renderGuidesList() {
    const c = getEl('guidesList'); if(!c) return; c.innerHTML = GUIDE_SECTIONS.map(s => `<div class="dweller-item guide-section-item" data-id="${s.id}"><strong>${s.title}</strong></div>`).join('');
    getEls('.guide-section-item').forEach(i => i.addEventListener('click', () => selectGuideSection(i.dataset.id)));
}
function selectGuideSection(id) {
    const s = GUIDE_SECTIONS.find(x => x.id===id); if(!s) return;
    getEls('.guide-section-item').forEach(i => i.classList.toggle('active', i.dataset.id===id));
    getEl('guideDetailsEmptyState').style.display='none'; getEl('guideDetailsContent').style.display='block';
    getEl('guideDetailsContent').innerHTML = `<a href="#" class="back-link">← Back</a><div class="panel-section"><h3>${s.title}</h3>${s.guides.map(g=>`<div class="guide-card"><h4>${g.title}</h4><div class="guide-excerpt">${g.content.replace(/<[^>]+>/g,'').slice(0,100)}...</div><button class="btn btn-secondary" onclick="showGuideDetails('${g.id}')">View</button></div>`).join('')}</div>`;
}
function findGuideById(id) { for(const s of GUIDE_SECTIONS) { const g = s.guides.find(x=>x.id===id); if(g) return g; } return null; }
function showGuideDetails(id) { const g=findGuideById(id); if(!g) return; getEl('guideDetailsContent').innerHTML=`<a href="#" class="back-link">← Back</a><div class="panel-section"><h3>${g.title}</h3><div>${g.content}</div></div>`; }
function filterGuides(t) { getEls('.guide-section-item').forEach(i => { const s = GUIDE_SECTIONS.find(x=>x.id===i.dataset.id); i.style.display = s?.title.toLowerCase().includes(t.toLowerCase()) || s?.guides.some(g=>g.title.toLowerCase().includes(t.toLowerCase())) ? 'flex':'none'; }); }

// Modals & History
function addToHistory(action, details) { changeHistory.unshift({action, details, timestamp: new Date().toLocaleString()}); if(changeHistory.length>100) changeHistory.pop(); }
function showHistoryModal() { const m=getEl('historyModal'), l=getEl('historyList'); if(!m||!l) return; l.innerHTML = changeHistory.length ? changeHistory.map(e=>`<div class="history-item"><div class="history-item-header"><span>${e.action}</span><span>${e.timestamp}</span></div><div>${e.details}</div></div>`).join('') : '<p>No changes</p>'; m.style.display='flex'; }
function closeHistoryModal() { if(getEl('historyModal')) getEl('historyModal').style.display='none'; }

// Season Pass Downloads Flow
function downloadSeasonPass() { if(getEl('seasonPassWarningModal')) getEl('seasonPassWarningModal').style.display='flex'; }
function closeSeasonPassWarning() { ['seasonPassWarningModal','seasonPassConfirmModal2','seasonPassConfirmModal3'].forEach(id=>{if(getEl(id)) getEl(id).style.display='none';}); if(getEl('seasonPassRiskConfirmation')) getEl('seasonPassRiskConfirmation').value=''; }
function seasonPassStep2() { getEl('seasonPassWarningModal').style.display='none'; getEl('seasonPassConfirmModal2').style.display='flex'; }
function seasonPassStep3() {
    getEl('seasonPassConfirmModal2').style.display='none'; getEl('seasonPassConfirmModal3').style.display='flex';
    addEvt('seasonPassRiskConfirmation', 'input', e => getEl('finalDownloadBtn').disabled = e.target.value !== 'I ACCEPT THE RISK');
}
function proceedWithSeasonPassDownload() {
    if(!currentData) return; updateSeasonPassData();
    const f = prompt('1. .dat (encrypted)\n2. .json (plain)\nEnter 1 or 2:', '1'); if(!f) return;
    const n = seasonPassFileName?.replace(/\.[^/.]+$/, '') || `season-pass-${currentData.currentSeason}`;
    if (f === '1') {
        const res = SaveDecryptor.encrypt(currentData);
        if(res.success) { downloadBlob(res.data, `${n}.dat`, 'text/plain'); showToast('Downloaded!'); closeSeasonPassWarning(); } else showToast(`Error: ${res.error}`);
    } else if (f === '2') { downloadBlob(JSON.stringify(currentData, null, 2), `${n}.json`, 'application/json'); showToast('Downloaded!'); closeSeasonPassWarning(); }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    addEvt('saveRoomBtn', 'click', saveRoom);
    document.addEventListener('click', e => { if(e.target.closest('#roomDetails .back-link')) { e.preventDefault(); closeRoomEditor(); } });
    disableEditorUI(); populateDwellersList(); populateRoomsList();
    console.log('Wasteland Editor Optimized loaded.'); showToast('Editor Ready');
});