/* ===================================================
   PDF全能工具箱 - Application Logic
   =================================================== */

(function () {
  'use strict';

  // ---- State ----
  const state = {
    currentView: 'viewHome',
    files: {
      viewPdfToWord: [],
      viewPdfToImage: [],
      viewImageToPdf: [],
      viewMergePdf: [],
      viewSplitPdf: [],
      viewHtmlMarkdown: [],
      viewFileDiffLeft: [],
      viewFileDiffRight: [],
    },
    pageOrder: [],       // array of page indices for Page Manager
    pageRotations: {},   // { pageIndex: degrees }
    pdfPath: null,       // current PDF in Page Manager
    pdfPassword: null,   // password for encrypted PDF in Page Manager
    passwordCallback: null,
    suppressClick: false,   // prevent click handler after drag
    defaultOutputDir: '',   // persisted default output directory
    htmlMdDirection: 'html2md',
    hmOutputContent: '',
    hmSourceFileName: '',
  };

  const viewTitles = {
    viewHome: 'PDF全能工具箱',
    viewPdfToWord: 'PDF转Word',
    viewPdfToImage: 'PDF转图片',
    viewImageToPdf: '图片转PDF',
    viewPageManager: '页面操作',
    viewMergePdf: '合并PDF',
    viewSplitPdf: '拆分PDF',
    viewHtmlMarkdown: 'HTML/Markdown互转',
    viewFileDiff: '文件对比',
  };

  // ---- DOM Refs ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ---- XSS Sanitization ----
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Default Output Directory ----
  const outputDirInputIds = [
    'outputDirPdfToWord',
    'outputDirPdfToImage',
    'outputDirImageToPdf',
    'outputDirPageManager',
    'outputDirSplitPdf',
    'outputDirMergePdf',
    'outputDirHtmlMarkdown',
    'outputDirFileDiff',
  ];

  async function loadDefaultOutputDir() {
    if (window.pywebview && pywebview.api) {
      try {
        const result = await pywebview.api.get_config();
        if (result && result.default_output_dir) {
          state.defaultOutputDir = result.default_output_dir;
        }
      } catch (err) {
        // ignore
      }
    }
    fillOutputDirFields();
  }

  function fillOutputDirFields() {
    for (const id of outputDirInputIds) {
      const input = document.getElementById(id);
      if (input && state.defaultOutputDir) {
        input.value = state.defaultOutputDir;
        input.placeholder = state.defaultOutputDir;
      }
    }
  }

  function clearOutputDirFields() {
    for (const id of outputDirInputIds) {
      const input = document.getElementById(id);
      if (input) {
        input.value = '';
        input.placeholder = '与源文件同目录';
      }
    }
  }

  // ---- Settings Modal ----
  function openSettingsModal() {
    const input = $('#defaultOutputDirInput');
    input.value = state.defaultOutputDir || '';
    $('#defaultDirStatus').style.display = 'none';
    $('#settingsModal').style.display = 'flex';
  }

  function closeSettingsModal() {
    $('#settingsModal').style.display = 'none';
  }

  $('#settingsBtn').addEventListener('click', openSettingsModal);
  $('#settingsModalClose').addEventListener('click', closeSettingsModal);

  // Click overlay to close
  $('#settingsModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSettingsModal();
  });

  // Select default dir
  $('#btnSelectDefaultDir').addEventListener('click', async () => {
    if (window.pywebview && pywebview.api) {
      try {
        const folder = await pywebview.api.select_folder();
        if (folder) {
          $('#defaultOutputDirInput').value = folder;
          const result = await pywebview.api.set_default_output_dir(folder);
          if (result && result.success) {
            state.defaultOutputDir = folder;
            fillOutputDirFields();
            showSettingsStatus('默认输出目录已设置', 'success');
          }
        }
      } catch (err) {
        showSettingsStatus('设置失败: ' + err.message, 'error');
      }
    }
  });

  // Clear default dir
  $('#btnClearDefaultDir').addEventListener('click', async () => {
    if (window.pywebview && pywebview.api) {
      try {
        const result = await pywebview.api.clear_default_output_dir();
        if (result && result.success) {
          state.defaultOutputDir = '';
          $('#defaultOutputDirInput').value = '';
          clearOutputDirFields();
          showSettingsStatus('已清除默认输出目录', 'success');
        }
      } catch (err) {
        showSettingsStatus('清除失败: ' + err.message, 'error');
      }
    }
  });

  function showSettingsStatus(text, type) {
    const el = $('#defaultDirStatus');
    el.textContent = text;
    el.className = 'settings-status ' + type;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 2500);
  }

  // ---- Output Directory Selection ----
  window.selectOutputDir = async function (inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (window.pywebview && pywebview.api) {
      try {
        const folder = await pywebview.api.select_folder();
        if (folder) input.value = folder;
      } catch (err) {
        console.warn('select_folder failed:', err);
      }
    }
  };

  // Helper: resolve output dir from user input or source file directories
  function resolveOutputDir(inputId, files) {
    const userDir = getOutputDir(inputId);
    if (userDir) return userDir;
    // When no user-selected dir, find the first source_dir from file objects
    for (const f of files) {
      if (f.source_dir) return f.source_dir;
    }
    return null;
  }

  // Helper: read output dir value, return null if empty
  function getOutputDir(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return null;
    const val = (input.value || '').trim();
    return val || null;
  }

  // ---- Navigation ----
  function navigateTo(viewId) {
    $$('.view').forEach((v) => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
    state.currentView = viewId;

    // Update navbar
    const isHome = viewId === 'viewHome';
    $('#backBtn').style.display = isHome ? 'none' : 'flex';
    $('#navTitle').textContent = viewTitles[viewId] || 'PDF全能工具箱';

    // Scroll to top
    $('#mainContent').scrollTop = 0;
  }

  // Back button
  $('#backBtn').addEventListener('click', () => navigateTo('viewHome'));

  // Feature cards
  $$('.feature-card').forEach((card) => {
    card.addEventListener('click', () => {
      const viewId = card.dataset.view;
      if (viewId) navigateTo(viewId);
    });
  });

  // ---- Theme Toggle ----
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pdf-toolbox-theme', theme);
  }

  $('#themeBtn').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  // Load saved theme
  const savedTheme = localStorage.getItem('pdf-toolbox-theme');
  if (savedTheme) {
    applyTheme(savedTheme);
  }

  // ---- File Handling ----
  // In PyWebView, drag-and-drop from OS may not expose file .path.
  // We rely primarily on click-to-select (pywebview file dialog) for reliable operation.
  // Drag-and-drop is supported when the runtime exposes .path (e.g. CEF backend).

  function setupDropZone(zoneId, viewId, fileTypes, multiple) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;

    // dragover: allow drop visual feedback
    zone.addEventListener('dragover', (e) => {
      // Only allow if this looks like an external file drag
      if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        zone.classList.add('drag-over');
      }
    });

    zone.addEventListener('dragleave', (e) => {
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('drag-over');
      }
    });

    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');

      // Prevent click from firing after drop
      state.suppressClick = true;
      setTimeout(() => { state.suppressClick = false; }, 300);

      const files = Array.from(e.dataTransfer.files);
      if (!files.length) return;

      const hasPaths = files.some((f) => f.path);
      if (hasPaths) {
        // Paths available (CEF backend) - add files directly
        addFiles(viewId, files, false);
        return;
      }

      // No paths available - read file contents and save via pywebview temp API
      if (window.pywebview && pywebview.api && pywebview.api.save_temp_file) {
        const acceptedExts = (fileTypes || '').split(',').map((f) => f.replace(/^\*?\./, '').trim().toLowerCase()).filter(Boolean);
        const fileObjects = [];
        for (const file of files) {
          const ext = file.name.split('.').pop().toLowerCase();
          if (acceptedExts.length && !acceptedExts.includes(ext)) continue;
          try {
            const base64 = await readFileAsBase64(file);
            const result = await pywebview.api.save_temp_file(file.name, base64);
            // result is {path, source_dir} — source_dir may be empty if undetectable
            const tmpPath = (typeof result === 'string') ? result : result.path;
            const sourceDir = (typeof result === 'string') ? '' : (result.source_dir || '');
            fileObjects.push({ name: file.name, path: tmpPath, source_dir: sourceDir, size: file.size });
          } catch (err) {
            console.warn('Failed to save dropped file:', file.name, err);
          }
        }
        if (fileObjects.length) {
          addFiles(viewId, fileObjects, true);
        }
      }
    });

    // Click to open file dialog
    zone.addEventListener('click', (e) => {
      if (state.suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
      openPywebviewFileDialog(viewId, fileTypes);
    });
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function openPywebviewFileDialog(viewId, fileTypes) {
    if (window.pywebview && pywebview.api) {
      try {
        const exts = (fileTypes || '').split(',').map((f) => f.replace(/^\*?\./, '').trim()).filter(Boolean);
        const paths = await pywebview.api.select_files(exts.length ? exts : ['pdf']);
        if (paths && paths.length) {
          const fileObjects = paths.map((p) => ({ name: p.split(/[\\/]/).pop(), path: p, size: 0 }));
          addFiles(viewId, fileObjects, true);
        }
      } catch (err) {
        console.warn('pywebview file dialog failed:', err);
      }
    }
  }

  function addFiles(viewId, files, isPathObjects) {
    if (!state.files[viewId]) state.files[viewId] = [];

    // Page Manager and Split PDF only allow single PDF
    if (viewId === 'viewPageManager' || viewId === 'viewSplitPdf') {
      state.files[viewId] = [];
      if (viewId === 'viewPageManager') state.pdfPassword = null;
    }

    const items = isPathObjects
      ? files.map((f) => ({ name: f.name, path: f.path, source_dir: f.source_dir || '', size: f.size || 0 }))
      : files.map((f) => ({ name: f.name, path: f.path || '', source_dir: f.source_dir || '', size: f.size }));

    // Filter out files without paths (can't process them)
    const validItems = items.filter((f) => f.path);

    state.files[viewId].push(...validItems);
    renderFileList(viewId);
    updateButtonStates(viewId);

    // Page Manager: load thumbnails
    if (viewId === 'viewPageManager' && state.files[viewId].length > 0) {
      loadThumbnails();
    }

    // Merge PDF: check page sizes
    if (viewId === 'viewMergePdf') {
      checkMergePageSizes();
    }

    // Image to PDF: update base image range
    if (viewId === 'viewImageToPdf') {
      updateBaseImageSelector();
    }

    // Split PDF: update page count info and show settings
    if (viewId === 'viewSplitPdf') {
      updateSplitInfo();
      const settingsEl = $('#splitSettings');
      if (settingsEl && state.files[viewId].length > 0) settingsEl.style.display = 'block';
    }

    // HTML/Markdown converter: single file, read content
    if (viewId === 'viewHtmlMarkdown' && state.files[viewId].length > 0) {
      loadHtmlMdFileContent();
    }

    // File Diff: render file list and trigger comparison
    if (viewId === 'viewFileDiffLeft' || viewId === 'viewFileDiffRight') {
      renderDiffFileList(viewId);
      updateDiffFileInfo();
      if (state.files.viewFileDiffLeft.length > 0 && state.files.viewFileDiffRight.length > 0) {
        startFileDiff();
      }
    }
  }

  function removeFile(viewId, index) {
    state.files[viewId].splice(index, 1);
    renderFileList(viewId);
    updateButtonStates(viewId);

    if (viewId === 'viewMergePdf') checkMergePageSizes();
    if (viewId === 'viewImageToPdf') updateBaseImageSelector();
    if (viewId === 'viewFileDiffLeft' || viewId === 'viewFileDiffRight') {
      renderDiffFileList(viewId);
      updateDiffFileInfo();
    }
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function renderFileList(viewId) {
    const listEl = document.getElementById(viewId.replace('view', 'list'));
    if (!listEl) return;

    const files = state.files[viewId] || [];
    const isSortable = listEl.classList.contains('sortable-list');

    if (files.length === 0) {
      listEl.innerHTML = '';
      return;
    }

    listEl.innerHTML = files
      .map(
        (f, i) => `
      <div class="file-item ${isSortable ? 'sortable-item' : ''}" data-index="${i}">
        ${isSortable ? `
          <span class="drag-handle" title="拖拽排序">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/></svg>
          </span>
        ` : ''}
        <div class="file-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <span class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        ${f.size ? `<span class="file-size">${formatSize(f.size)}</span>` : ''}
        <button class="file-remove" data-index="${i}" title="移除">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `
      )
      .join('');

    // Remove button events
    listEl.querySelectorAll('.file-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        removeFile(viewId, idx);
      });
    });

    // Setup drag reorder if sortable (using mouse events for reliability)
    if (isSortable) setupFileListReorder(listEl, viewId);
  }

  function updateButtonStates(viewId) {
    const files = state.files[viewId] || [];
    const btnMap = {
      viewPdfToWord: '#btnStartPdfToWord',
      viewPdfToImage: '#btnStartPdfToImage',
      viewImageToPdf: '#btnStartImageToPdf',
      viewMergePdf: '#btnStartMergePdf',
      viewSplitPdf: '#btnStartSplitPdf',
    };
    const btn = document.querySelector(btnMap[viewId]);
    if (btn) btn.disabled = files.length === 0;

    // Page Manager special
    if (viewId === 'viewPageManager') {
      const hasPdf = files.length > 0;
      $('#pageToolbar').style.display = hasPdf ? 'flex' : 'none';
      $('#pageManagerSettings').style.display = hasPdf ? 'block' : 'none';
      $('#pageManagerActions').style.display = hasPdf ? 'flex' : 'none';
    }
  }

  // ---- Drag Reorder for File Lists (mouse events) ----
  let fileListDragState = null;

  function setupFileListReorder(listEl, viewId) {
    listEl.querySelectorAll('.file-item').forEach((item) => {
      const handle = item.querySelector('.drag-handle');
      if (!handle) return;

      handle.addEventListener('mousedown', (e) => {
        fileListDragState = {
          listEl: listEl,
          viewId: viewId,
          dragIdx: parseInt(item.dataset.index, 10),
          dragItem: item,
          startY: e.clientY,
          isDragging: false,
          placeholder: null,
        };
      });
    });
  }

  // Remove any existing drop indicator
  function removeFileListDropIndicator() {
    const existing = document.querySelector('.drop-indicator');
    if (existing) existing.remove();
  }

  // Insert a visual drop indicator line before or after an element
  function showFileListDropIndicator(listEl, referenceNode, before) {
    removeFileListDropIndicator();
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    if (before) {
      listEl.insertBefore(indicator, referenceNode);
    } else {
      listEl.insertBefore(indicator, referenceNode.nextSibling);
    }
  }

  // Single pair of document-level listeners for file list drag
  document.addEventListener('mousemove', (e) => {
    if (!fileListDragState) return;
    const ds = fileListDragState;
    const dy = e.clientY - ds.startY;
    if (!ds.isDragging && Math.abs(dy) > 5) {
      ds.isDragging = true;
      ds.dragItem.classList.add('dragging');
    }
    if (!ds.isDragging) return;
    e.preventDefault();

    const items = [...ds.listEl.querySelectorAll('.file-item:not(.dragging)')];
    let targetItem = null;
    for (const it of items) {
      const rect = it.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        targetItem = it;
        break;
      }
    }
    if (targetItem) {
      const targetRect = targetItem.getBoundingClientRect();
      const midY = targetRect.top + targetRect.height / 2;
      const before = e.clientY < midY;
      showFileListDropIndicator(ds.listEl, targetItem, before);
    } else {
      // If below all items, show indicator at end
      if (items.length > 0 && e.clientY > items[items.length - 1].getBoundingClientRect().bottom) {
        showFileListDropIndicator(ds.listEl, items[items.length - 1], false);
      } else {
        removeFileListDropIndicator();
      }
    }
  });

  document.addEventListener('mouseup', () => {
    if (!fileListDragState) return;
    const ds = fileListDragState;

    if (ds.isDragging) {
      ds.dragItem.classList.remove('dragging');

      // Insert drag item at the indicator position
      const indicator = ds.listEl.querySelector('.drop-indicator');
      if (indicator) {
        ds.listEl.insertBefore(ds.dragItem, indicator);
        indicator.remove();
      } else {
        removeFileListDropIndicator();
      }

      const newOrder = [...ds.listEl.querySelectorAll('.file-item')].map(
        (el) => parseInt(el.dataset.index, 10)
      );
      const arr = state.files[ds.viewId];
      const reordered = newOrder.map((idx) => arr[idx]);
      state.files[ds.viewId] = reordered;
      renderFileList(ds.viewId);
    }

    fileListDragState = null;
  });

  // ---- Setup Drop Zones ----
  setupDropZone('dropPdfToWord', 'viewPdfToWord', '.pdf');
  setupDropZone('dropPdfToImage', 'viewPdfToImage', '.pdf');
  setupDropZone('dropImageToPdf', 'viewImageToPdf', '.jpg,.jpeg,.png');
  setupDropZone('dropPageManager', 'viewPageManager', '.pdf', false);
  setupDropZone('dropMergePdf', 'viewMergePdf', '.pdf');
  setupDropZone('dropSplitPdf', 'viewSplitPdf', '.pdf', false);
  setupDropZone('dropHtmlMarkdown', 'viewHtmlMarkdown', '.html,.htm,.md');
  setupDropZone('dropDiffLeft', 'viewFileDiffLeft', '.txt,.md,.html,.htm,.docx,.pptx', false);
  setupDropZone('dropDiffRight', 'viewFileDiffRight', '.txt,.md,.html,.htm,.docx,.pptx', false);

  // ---- Page Mode Toggle (Image to PDF) ----
  $('#pageMode').addEventListener('change', () => {
    const mode = $('#pageMode').value;
    const a4Opt = document.querySelector('.a4-option');
    const origOpt = document.querySelector('.original-option');

    if (mode === 'a4') {
      a4Opt.style.display = 'flex';
      origOpt.style.display = 'none';
    } else {
      a4Opt.style.display = 'none';
      origOpt.style.display = 'flex';
    }
  });

  // Merge mode toggle
  $('#mergeMode').addEventListener('change', () => {
    const mode = $('#mergeMode').value;
    const a4Group = $('#mergeA4OrientationGroup');
    a4Group.style.display = mode === 'fit-a4' ? 'flex' : 'none';
  });

  function updateBaseImageSelector() {
    const count = state.files.viewImageToPdf.length;
    const input = $('#baseImageIndex');
    input.max = count;
    if (parseInt(input.value, 10) > count) input.value = count;
    if (parseInt(input.value, 10) < 1 && count > 0) input.value = 1;
  }

  // ---- Merge Page Size Check ----
  async function checkMergePageSizes() {
    const settingsEl = $('#mergeSettings');
    const infoEl = $('#mergeInfo');
    const files = state.files.viewMergePdf;

    if (files.length < 2) {
      settingsEl.style.display = 'none';
      return;
    }

    settingsEl.style.display = 'block';
    infoEl.innerHTML = `<strong>${files.length}</strong> 个文件待合并`;

    if (window.pywebview && pywebview.api) {
      try {
        const paths = files.map((f) => f.path);
        const result = await pywebview.api.check_merge_page_sizes(paths);
        if (result && result.success && !result.uniform) {
          infoEl.innerHTML += `<br><span class="merge-warn">检测到页面尺寸不一致，建议使用「统一缩放到A4」模式</span>`;
        }
      } catch (err) {
        // Silently ignore
      }
    }
  }

  // ---- Page Manager ----
  async function loadThumbnails() {
    const grid = $('#thumbnailGrid');
    grid.innerHTML = '<div class="empty-state">加载中...</div>';

    const pdfPath = state.files.viewPageManager[0]?.path;
    if (!pdfPath) return;

    state.pdfPath = pdfPath;

    if (window.pywebview && pywebview.api) {
      try {
        const params = { file_path: pdfPath };
        if (state.pdfPassword) params.password = state.pdfPassword;

        const result = await pywebview.api.get_pdf_page_thumbnails(params);
        if (result && result.success) {
          state.pageOrder = result.page_order || result.thumbnails.map((_, i) => i);
          state.pageRotations = result.rotations || {};
          cachedThumbnails = result.thumbnails || [];
          renderThumbnails(cachedThumbnails);
        } else if (result && result.need_password) {
          showPasswordModal(async (password) => {
            state.pdfPassword = password;
            const unlockResult = await pywebview.api.unlock_pdf({ file_path: pdfPath, password: password });
            if (unlockResult && unlockResult.success) {
              loadThumbnails();
            } else {
              alert('密码错误，请重试');
            }
          });
          grid.innerHTML = '<div class="empty-state">文件已加密，请输入密码</div>';
        } else {
          grid.innerHTML = `<div class="empty-state">${escapeHtml(result?.error || '无法加载缩略图')}</div>`;
        }
      } catch (err) {
        grid.innerHTML = '<div class="empty-state">加载缩略图失败</div>';
      }
    } else {
      // Demo mode
      state.pageOrder = [0, 1, 2, 3];
      state.pageRotations = {};
      renderThumbnails([]);
    }
  }

  function renderThumbnails(thumbnailPaths) {
    const grid = $('#thumbnailGrid');
    const order = state.pageOrder;

    if (order.length === 0) {
      grid.innerHTML = '<div class="empty-state">没有页面</div>';
      return;
    }

    grid.innerHTML = order
      .map((pageIdx, displayIdx) => {
        const rotation = state.pageRotations[pageIdx] || 0;
        const src = thumbnailPaths[pageIdx] || '';
        const imgTag = src
          ? `<img src="${src}" style="transform:rotate(${rotation}deg)" alt="Page ${pageIdx + 1}">`
          : `<div class="empty-state" style="aspect-ratio:3/4;display:flex;align-items:center;justify-content:center;">${pageIdx + 1}</div>`;
        return `
        <div class="thumb-card" data-page-index="${pageIdx}" data-display-index="${displayIdx}">
          ${imgTag}
          <div class="thumb-label">第 ${displayIdx + 1} 页</div>
          <div class="thumb-actions">
            <button class="thumb-rotate" data-page-index="${pageIdx}" title="旋转90°">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
            <button class="thumb-delete" data-page-index="${pageIdx}" title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      `;
      })
      .join('');

    // Rotate button
    grid.querySelectorAll('.thumb-rotate').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const idx = parseInt(btn.dataset.pageIndex, 10);
        rotatePage(idx);
      });
    });

    // Delete single page
    grid.querySelectorAll('.thumb-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const idx = parseInt(btn.dataset.pageIndex, 10);
        deleteSinglePage(idx);
      });
    });

    // Setup thumbnail drag reorder using mouse events
    setupThumbnailDragReorder();
  }

  // ---- Thumbnail Drag Reorder (mouse events, not HTML5 DnD) ----
  let thumbDragState = null;

  function setupThumbnailDragReorder() {
    const grid = $('#thumbnailGrid');

    grid.querySelectorAll('.thumb-card').forEach((card) => {
      card.addEventListener('mousedown', (e) => {
        if (e.target.closest('.thumb-actions')) return;

        thumbDragState = {
          dragCard: card,
          dragDisplayIdx: parseInt(card.dataset.displayIndex, 10),
          startX: e.clientX,
          startY: e.clientY,
          isDragging: false,
        };
      });
    });
  }

  // Remove any existing thumbnail drop indicator
  function removeThumbDropIndicator() {
    const existing = document.querySelector('.thumb-drop-indicator');
    if (existing) existing.remove();
  }

  // Single pair of document-level listeners for thumbnail drag
  document.addEventListener('mousemove', (e) => {
    if (!thumbDragState) return;
    const ds = thumbDragState;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;

    if (!ds.isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      ds.isDragging = true;
      ds.dragCard.classList.add('dragging');
    }

    if (!ds.isDragging) return;
    e.preventDefault();

    const grid = $('#thumbnailGrid');
    const cards = [...grid.querySelectorAll('.thumb-card:not(.dragging)')];
    let targetCard = null;
    for (const c of cards) {
      const rect = c.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        targetCard = c;
        break;
      }
    }

    removeThumbDropIndicator();
    if (targetCard) {
      const targetRect = targetCard.getBoundingClientRect();
      const midX = targetRect.left + targetRect.width / 2;
      const indicator = document.createElement('div');
      indicator.className = 'thumb-drop-indicator';
      if (e.clientX < midX) {
        grid.insertBefore(indicator, targetCard);
      } else {
        grid.insertBefore(indicator, targetCard.nextSibling);
      }
    } else if (cards.length > 0) {
      // Below all cards
      const lastRect = cards[cards.length - 1].getBoundingClientRect();
      if (e.clientY > lastRect.bottom || (e.clientX > lastRect.right && e.clientY > lastRect.top)) {
        const indicator = document.createElement('div');
        indicator.className = 'thumb-drop-indicator';
        grid.insertBefore(indicator, cards[cards.length - 1].nextSibling);
      }
    }
  });

  document.addEventListener('mouseup', () => {
    if (!thumbDragState) return;
    const ds = thumbDragState;

    if (ds.isDragging) {
      ds.dragCard.classList.remove('dragging');

      const grid = $('#thumbnailGrid');
      const indicator = grid.querySelector('.thumb-drop-indicator');
      if (indicator) {
        grid.insertBefore(ds.dragCard, indicator);
        indicator.remove();
      }

      const newDisplayOrder = [...grid.querySelectorAll('.thumb-card')].map(
        (c) => parseInt(c.dataset.pageIndex, 10)
      );
      state.pageOrder = newDisplayOrder;
      renderThumbnails(getCurrentThumbnails());
    }

    thumbDragState = null;
  });

  let cachedThumbnails = [];

  function getCurrentThumbnails() {
    return cachedThumbnails;
  }

  function rotatePage(pageIdx) {
    const current = state.pageRotations[pageIdx] || 0;
    state.pageRotations[pageIdx] = (current + 90) % 360;
    renderThumbnails(getCurrentThumbnails());
  }

  function deleteSinglePage(pageIdx) {
    state.pageOrder = state.pageOrder.filter((idx) => idx !== pageIdx);
    renderThumbnails(getCurrentThumbnails());
  }

  // Delete range
  $('#btnDeleteRange').addEventListener('click', () => {
    const rangeStr = $('#deleteRange').value.trim();
    if (!rangeStr) return;

    const indices = parseRange(rangeStr);
    if (indices.length === 0) {
      alert('无效的页面范围');
      return;
    }

    const toDelete = new Set(indices.map((n) => n - 1));
    state.pageOrder = state.pageOrder.filter((idx) => !toDelete.has(idx));
    $('#deleteRange').value = '';
    renderThumbnails(getCurrentThumbnails());
  });

  // Move page
  $('#btnMovePage').addEventListener('click', () => {
    const from = parseInt($('#movePageFrom').value, 10);
    const to = parseInt($('#movePageTo').value, 10);
    if (isNaN(from) || isNaN(to) || from < 1 || to < 1 || from > state.pageOrder.length || to > state.pageOrder.length) {
      alert('请输入有效的页码范围（1~' + state.pageOrder.length + '）');
      return;
    }
    const fromIdx = from - 1;
    const toIdx = to - 1;
    const [moved] = state.pageOrder.splice(fromIdx, 1);
    state.pageOrder.splice(toIdx, 0, moved);
    $('#movePageFrom').value = '';
    $('#movePageTo').value = '';
    renderThumbnails(getCurrentThumbnails());
  });

  function parseRange(str) {
    const indices = [];
    const parts = str.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
          for (let i = start; i <= end; i++) indices.push(i);
        }
      } else {
        const n = parseInt(trimmed, 10);
        if (!isNaN(n) && n > 0) indices.push(n);
      }
    }
    return indices;
  }

  // ---- Password Modal ----
  function showPasswordModal(callback) {
    state.passwordCallback = callback;
    $('#passwordInput').value = '';
    $('#passwordModal').style.display = 'flex';
    setTimeout(() => $('#passwordInput').focus(), 100);
  }

  function closePasswordModal() {
    $('#passwordModal').style.display = 'none';
    state.passwordCallback = null;
  }

  $('#btnPasswordCancel').addEventListener('click', closePasswordModal);

  $('#btnPasswordSubmit').addEventListener('click', () => {
    const password = $('#passwordInput').value;
    if (!password) return;
    const cb = state.passwordCallback;
    closePasswordModal();
    if (cb) cb(password);
  });

  $('#passwordInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      $('#btnPasswordSubmit').click();
    } else if (e.key === 'Escape') {
      closePasswordModal();
    }
  });

  // ---- Loading Overlay ----
  function showLoading(text) {
    $('#loadingText').textContent = text || '处理中...';
    $('#loadingOverlay').style.display = 'flex';
  }

  function hideLoading() {
    $('#loadingOverlay').style.display = 'none';
  }

  // ---- Success Toast ----
  function showSuccess(text) {
    const toast = $('#successToast');
    $('#toastText').textContent = text || '操作成功！';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // ---- Progress Helper ----
  function setProgress(areaId, percent, text) {
    const area = document.getElementById(areaId);
    if (!area) return;
    area.style.display = 'block';
    const fill = area.querySelector('.progress-bar-fill');
    const label = area.querySelector('.progress-text');
    if (fill) fill.style.width = Math.min(100, Math.max(0, percent)) + '%';
    if (label) label.textContent = text || '';
  }

  // ---- Feature Action: PDF to Word ----
  $('#btnStartPdfToWord').addEventListener('click', startPdfToWord);

  async function startPdfToWord() {
    const files = state.files.viewPdfToWord;
    if (!files.length) return;

    showLoading('正在转换PDF为Word...');
    setProgress('progressPdfToWord', 0, '准备中...');

    const outputDir = resolveOutputDir('outputDirPdfToWord', files);

    try {
      const paths = files.map((f) => f.path);
      const result = await pywebview.api.pdf_to_word({ files: paths, output_dir: outputDir });

      if (result.need_password) {
        hideLoading();
        showPasswordModal(async (password) => {
          showLoading('正在解锁并转换...');
          const retry = await pywebview.api.pdf_to_word({ files: paths, password, output_dir: outputDir });
          hideLoading();
          if (retry.success) {
            showSuccess('转换完成！');
            setProgress('progressPdfToWord', 100, '转换完成');
          } else {
            alert(retry.error || '转换失败');
          }
        });
        return;
      }

      hideLoading();
      if (result.success) {
        showSuccess('转换完成！');
        setProgress('progressPdfToWord', 100, '转换完成');
      } else {
        alert(result.error || '转换失败');
      }
    } catch (err) {
      hideLoading();
      alert('发生错误: ' + err.message);
    }
  }

  // ---- Feature Action: PDF to Image ----
  $('#btnStartPdfToImage').addEventListener('click', startPdfToImage);

  async function startPdfToImage() {
    const files = state.files.viewPdfToImage;
    if (!files.length) return;

    const format = $('#imgFormat').value;
    const dpi = parseInt($('#imgDpi').value, 10) || 200;
    const outputDir = resolveOutputDir('outputDirPdfToImage', files);

    showLoading('正在转换PDF为图片...');
    setProgress('progressPdfToImage', 0, '准备中...');

    try {
      const paths = files.map((f) => f.path);
      const result = await pywebview.api.pdf_to_image({ files: paths, format: format, dpi: dpi, output_dir: outputDir });

      if (result.need_password) {
        hideLoading();
        showPasswordModal(async (password) => {
          showLoading('正在解锁并转换...');
          const retry = await pywebview.api.pdf_to_image({ files: paths, format: format, dpi: dpi, password: password, output_dir: outputDir });
          hideLoading();
          if (retry.success) {
            showSuccess('转换完成！');
            setProgress('progressPdfToImage', 100, '转换完成');
          } else {
            alert(retry.error || '转换失败');
          }
        });
        return;
      }

      hideLoading();
      if (result.success) {
        showSuccess('转换完成！');
        setProgress('progressPdfToImage', 100, '转换完成');
      } else {
        alert(result.error || '转换失败');
      }
    } catch (err) {
      hideLoading();
      alert('发生错误: ' + err.message);
    }
  }

  // ---- Feature Action: Image to PDF ----
  $('#btnStartImageToPdf').addEventListener('click', startImageToPdf);

  async function startImageToPdf() {
    const files = state.files.viewImageToPdf;
    if (!files.length) return;

    const pageMode = $('#pageMode').value;
    const a4Orientation = $('#a4Orientation').value;
    const baseImageIndex = parseInt($('#baseImageIndex').value, 10) || 1;
    const dpi = parseInt($('#img2pdfDpi').value, 10) || 200;
    const outputDir = resolveOutputDir('outputDirImageToPdf', files);

    showLoading('正在生成PDF...');

    try {
      const paths = files.map((f) => f.path);
      const params = { files: paths, page_mode: pageMode, dpi: dpi, output_dir: outputDir };
      if (pageMode === 'a4') {
        params.a4_orientation = a4Orientation;
      } else {
        params.base_image_index = baseImageIndex - 1; // 0-based
      }

      const result = await pywebview.api.image_to_pdf(params);
      hideLoading();

      if (result.success) {
        showSuccess('PDF生成成功！');
      } else {
        alert(result.error || '生成失败');
      }
    } catch (err) {
      hideLoading();
      alert('发生错误: ' + err.message);
    }
  }

  // ---- Feature Action: Page Manager Save ----
  $('#btnSavePageManager').addEventListener('click', savePageManager);

  async function savePageManager() {
    if (!state.pdfPath) return;

    showLoading('正在导出PDF...');

    const outputDir = resolveOutputDir('outputDirPageManager', state.files.viewPageManager || []);

    try {
      const params = {
        file_path: state.pdfPath,
        page_order: state.pageOrder,
        rotations: state.pageRotations,
        output_dir: outputDir,
      };
      if (state.pdfPassword) params.password = state.pdfPassword;

      const result = await pywebview.api.reorder_pages(params);

      hideLoading();

      if (result.success) {
        showSuccess('导出成功！文件已保存至: ' + (result.output_path || ''));
      } else if (result.need_password) {
        showPasswordModal(async (password) => {
          state.pdfPassword = password;
          showLoading('正在解锁并导出...');
          const retry = await pywebview.api.reorder_pages({
            file_path: state.pdfPath,
            page_order: state.pageOrder,
            rotations: state.pageRotations,
            password: password,
            output_dir: outputDir,
          });
          hideLoading();
          if (retry.success) {
            showSuccess('导出成功！文件已保存至: ' + (retry.output_path || ''));
          } else {
            alert(retry.error || '导出失败');
          }
        });
      } else {
        alert(result.error || '导出失败');
      }
    } catch (err) {
      hideLoading();
      alert('发生错误: ' + err.message);
    }
  }

  // ---- Feature Action: Merge PDF ----
  $('#btnStartMergePdf').addEventListener('click', startMergePdf);

  async function startMergePdf() {
    const files = state.files.viewMergePdf;
    if (files.length < 2) {
      alert('请至少选择两个PDF文件');
      return;
    }

    const mergeMode = $('#mergeMode').value;
    const mergeA4Orientation = $('#mergeA4Orientation').value;
    const outputDir = resolveOutputDir('outputDirMergePdf', files);

    showLoading('正在合并PDF...');
    setProgress('progressMergePdf', 0, '准备中...');

    try {
      const paths = files.map((f) => f.path);
      const result = await pywebview.api.merge_pdfs({ files: paths, merge_mode: mergeMode, a4_orientation: mergeA4Orientation, output_dir: outputDir });

      hideLoading();

      if (result.need_password) {
        showPasswordModal(async (password) => {
          showLoading('正在解锁并合并...');
          const retry = await pywebview.api.merge_pdfs({ files: paths, merge_mode: mergeMode, a4_orientation: mergeA4Orientation, password: password, output_dir: outputDir });
          hideLoading();
          if (retry.success) {
            showSuccess('合并完成！');
            setProgress('progressMergePdf', 100, '合并完成');
          } else {
            alert(retry.error || '合并失败');
          }
        });
        return;
      }

      if (result.success) {
        showSuccess('合并完成！');
        setProgress('progressMergePdf', 100, '合并完成');
      } else {
        alert(result.error || '合并失败');
      }
    } catch (err) {
      hideLoading();
      alert('发生错误: ' + err.message);
    }
  }

  // ---- Feature Action: Split PDF ----
  async function updateSplitInfo() {
    const files = state.files.viewSplitPdf;
    const infoEl = $('#splitInfo');
    if (!files.length) {
      infoEl.textContent = '';
      return;
    }

    if (window.pywebview && pywebview.api) {
      try {
        const result = await pywebview.api.get_pdf_page_count({ file_path: files[0].path });
        if (result.success) {
          infoEl.textContent = `共 ${result.page_count} 页`;
          $('#splitRanges').placeholder = `例如: 1-3, 4-6, 7-10（共${result.page_count}页）`;
        }
      } catch (err) {
        // ignore
      }
    }
  }

  $('#btnStartSplitPdf').addEventListener('click', startSplitPdf);

  async function startSplitPdf() {
    const files = state.files.viewSplitPdf;
    if (!files.length) return;

    const rangesStr = $('#splitRanges').value.trim();
    const outputDir = resolveOutputDir('outputDirSplitPdf', files);

    if (!rangesStr) {
      alert('请输入拆分范围');
      return;
    }

    showLoading('正在拆分PDF...');

    try {
      const params = {
        file_path: files[0].path,
        ranges: rangesStr,
        output_dir: outputDir,
      };

      const result = await pywebview.api.split_pdf(params);
      hideLoading();

      if (result.need_password) {
        showPasswordModal(async (password) => {
          showLoading('正在解锁并拆分...');
          const retry = await pywebview.api.split_pdf({ ...params, password });
          hideLoading();
          if (retry.success) {
            showSuccess(`拆分完成！生成了 ${retry.output_count} 个文件`);
          } else {
            alert(retry.error || '拆分失败');
          }
        });
        return;
      }

      if (result.success) {
        showSuccess(`拆分完成！生成了 ${result.output_count} 个文件`);
      } else {
        alert(result.error || '拆分失败');
      }
    } catch (err) {
      hideLoading();
      alert('发生错误: ' + err.message);
    }
  }

  // ---- Direction Tabs (HTML/Markdown Converter) ----
  $$('.direction-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.direction-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.htmlMdDirection = tab.dataset.direction;
      updateHtmlMdLabels();
      state.files.viewHtmlMarkdown = [];
      renderFileList('viewHtmlMarkdown');
      $('#hmInputArea').value = '';
      $('#hmOutputArea').value = '';
      state.hmOutputContent = '';
      state.hmSourceFileName = '';
      $('#btnExportHtmlMarkdown').style.display = 'none';
    });
  });

  function updateHtmlMdLabels() {
    const dir = state.htmlMdDirection;
    if (dir === 'html2md') {
      $('#hmInputLabel').textContent = 'HTML 源码';
      $('#hmOutputLabel').textContent = 'Markdown';
      $('#hmDropText').textContent = '拖拽HTML文件到此处';
      $('#hmDropHint').textContent = '支持 .html / .htm 文件，或点击选择';
      $('#dropHtmlMarkdown input').setAttribute('accept', '.html,.htm');
    } else {
      $('#hmInputLabel').textContent = 'Markdown';
      $('#hmOutputLabel').textContent = 'HTML';
      $('#hmDropText').textContent = '拖拽Markdown文件到此处';
      $('#hmDropHint').textContent = '支持 .md 文件，或点击选择';
      $('#dropHtmlMarkdown input').setAttribute('accept', '.md');
    }
  }

  async function loadHtmlMdFileContent() {
    const files = state.files.viewHtmlMarkdown;
    if (!files.length) return;
    const fpath = files[0].path;
    state.hmSourceFileName = files[0].name;

    if (window.pywebview && pywebview.api) {
      try {
        const result = await pywebview.api.read_text_file({ file_path: fpath });
        if (result.success) {
          $('#hmInputArea').value = result.content;
        } else {
          alert(result.error || '读取文件失败');
        }
      } catch (err) {
        alert('读取文件失败: ' + err.message);
      }
    }
  }

  $('#btnClearInput').addEventListener('click', () => {
    $('#hmInputArea').value = '';
    $('#hmOutputArea').value = '';
    state.hmOutputContent = '';
    state.files.viewHtmlMarkdown = [];
    renderFileList('viewHtmlMarkdown');
    state.hmSourceFileName = '';
    $('#btnExportHtmlMarkdown').style.display = 'none';
  });

  $('#btnStartHtmlMarkdown').addEventListener('click', () => {
    const input = $('#hmInputArea').value;
    if (!input.trim()) {
      alert('请输入或导入内容');
      return;
    }

    let output = '';
    if (state.htmlMdDirection === 'html2md') {
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-'
      });
      // Strip inline/style tags that have no Markdown equivalent
      const inlineElements = [
        'span', 'font', 'center', 'strike', 'u', 'big', 'small',
        'abbr', 'acronym', 'bdi', 'bdo', 'cite', 'dfn', 'kbd',
        'mark', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'sub', 'sup',
        'time', 'var', 'wbr', 'ins', 'del'
      ];
      inlineElements.forEach(tag => {
        turndownService.addRule(`strip_${tag}`, {
          filter: tag,
          replacement: function(content) { return content; }
        });
      });
      // Strip div/p/section/article/aside/header/footer/nav/main/figure/figcaption/details/summary
      // keeping their text content
      const blockElements = [
        'div', 'section', 'article', 'aside', 'header', 'footer',
        'nav', 'main', 'figure', 'figcaption', 'details', 'summary',
        'address', 'fieldset', 'form', 'legend'
      ];
      blockElements.forEach(tag => {
        turndownService.addRule(`strip_block_${tag}`, {
          filter: tag,
          replacement: function(content) { return '\n\n' + content + '\n\n'; }
        });
      });
      // Strip table attrs but keep table structure (turndown handles table by default)
      turndownService.addRule('strip_table_attrs', {
        filter: ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col', 'caption'],
        replacement: function(content, node, options) {
          // Use turndown's default table handling
          return content;
        }
      });
      // Clean up multiple blank lines
      output = turndownService.turndown(input);
      output = output.replace(/\n{3,}/g, '\n\n').trim();
    } else {
      output = marked.parse(input, { breaks: true, gfm: true });
    }

    $('#hmOutputArea').value = output;
    state.hmOutputContent = output;
    $('#btnExportHtmlMarkdown').style.display = 'inline-flex';
    showSuccess('转换完成！');
  });

  $('#btnCopyOutput').addEventListener('click', () => {
    const text = $('#hmOutputArea').value;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showSuccess('已复制到剪贴板');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showSuccess('已复制到剪贴板');
    });
  });

  $('#btnExportHtmlMarkdown').addEventListener('click', async () => {
    if (!state.hmOutputContent) return;

    const isHtml2Md = state.htmlMdDirection === 'html2md';
    const defaultName = state.hmSourceFileName
      ? state.hmSourceFileName.replace(/\.[^.]+$/, isHtml2Md ? '.md' : '.html')
      : (isHtml2Md ? 'output.md' : 'output.html');

    const outputDir = getOutputDir('outputDirHtmlMarkdown');
    let savePath;
    if (outputDir) {
      savePath = outputDir + '/' + defaultName;
    } else if (state.files.viewHtmlMarkdown.length > 0 && state.files.viewHtmlMarkdown[0].source_dir) {
      savePath = state.files.viewHtmlMarkdown[0].source_dir + '/' + defaultName;
    } else {
      savePath = defaultName;
    }

    if (window.pywebview && pywebview.api) {
      try {
        const result = await pywebview.api.save_text_file({ content: state.hmOutputContent, file_path: savePath });
        if (result.success) {
          showSuccess('文件已保存至: ' + result.file_path);
        } else {
          alert(result.error || '保存失败');
        }
      } catch (err) {
        alert('保存失败: ' + err.message);
      }
    }
  });

  // ---- File Diff ----
  function updateDiffFileInfo() {
    const leftFiles = state.files.viewFileDiffLeft;
    const rightFiles = state.files.viewFileDiffRight;
    const infoEl = $('#diffFileInfo');

    if (leftFiles.length > 0 || rightFiles.length > 0) {
      infoEl.style.display = 'flex';
      $('#diffFileNameA').textContent = leftFiles.length ? leftFiles[0].name : '未选择';
      $('#diffFileNameB').textContent = rightFiles.length ? rightFiles[0].name : '未选择';
    } else {
      infoEl.style.display = 'none';
    }
  }

  function renderDiffFileList(viewId) {
    const isLeft = viewId === 'viewFileDiffLeft';
    const zone = isLeft ? $('#dropDiffLeft') : $('#dropDiffRight');
    const files = state.files[viewId] || [];

    if (files.length > 0) {
      zone.innerHTML = `<div style="padding:8px 0;font-size:13px;font-weight:500;color:var(--text);">${escapeHtml(files[0].name)}<button class="file-remove" style="margin-left:8px;width:22px;height:22px;border:none;border-radius:50%;background:transparent;color:var(--text-muted);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;" data-view="${viewId}" title="移除"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>`;
      zone.querySelector('.file-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        state.files[viewId] = [];
        resetDiffDropZone(viewId);
        updateDiffFileInfo();
        $('#diffResult').style.display = 'none';
        $('#diffSettings').style.display = 'none';
      });
    } else {
      resetDiffDropZone(viewId);
    }
  }

  function resetDiffDropZone(viewId) {
    const isLeft = viewId === 'viewFileDiffLeft';
    const zone = isLeft ? $('#dropDiffLeft') : $('#dropDiffRight');
    const label = isLeft ? '文件 A' : '文件 B';
    const accept = '.txt,.md,.html,.htm,.docx,.pptx';
    zone.innerHTML = `
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <p>${label}</p>
      <span class="drop-hint">拖拽文件或点击选择</span>
      <input type="file" accept="${accept}" style="display:none">`;
    // Re-setup drop zone events
    zone.addEventListener('dragover', (e) => {
      if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        zone.classList.add('drag-over');
      }
    });
    zone.addEventListener('dragleave', (e) => {
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('drag-over');
      }
    });
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');
      state.suppressClick = true;
      setTimeout(() => { state.suppressClick = false; }, 300);
      const files = Array.from(e.dataTransfer.files);
      if (!files.length) return;
      const hasPaths = files.some((f) => f.path);
      if (hasPaths) {
        addFiles(viewId, files, false);
        return;
      }
      if (window.pywebview && pywebview.api && pywebview.api.save_temp_file) {
        const acceptedExts = accept.split(',').map((f) => f.replace(/^\*?\./, '').trim().toLowerCase()).filter(Boolean);
        const fileObjects = [];
        for (const file of files) {
          const ext = file.name.split('.').pop().toLowerCase();
          if (acceptedExts.length && !acceptedExts.includes(ext)) continue;
          try {
            const base64 = await readFileAsBase64(file);
            const result = await pywebview.api.save_temp_file(file.name, base64);
            const tmpPath = (typeof result === 'string') ? result : result.path;
            const sourceDir = (typeof result === 'string') ? '' : (result.source_dir || '');
            fileObjects.push({ name: file.name, path: tmpPath, source_dir: sourceDir, size: file.size });
          } catch (err) {
            console.warn('Failed to save dropped file:', file.name, err);
          }
        }
        if (fileObjects.length) {
          addFiles(viewId, fileObjects, true);
        }
      }
    });
    zone.addEventListener('click', (e) => {
      if (state.suppressClick) return;
      if (e.target.closest('.file-remove')) return;
      e.preventDefault();
      e.stopPropagation();
      openPywebviewFileDialog(viewId, accept);
    });
  }

  async function startFileDiff() {
    const leftPath = state.files.viewFileDiffLeft[0]?.path;
    const rightPath = state.files.viewFileDiffRight[0]?.path;

    if (!leftPath || !rightPath) return;

    showLoading('正在提取文件内容...');

    try {
      const [resultA, resultB] = await Promise.all([
        pywebview.api.extract_file_text({ file_path: leftPath }),
        pywebview.api.extract_file_text({ file_path: rightPath }),
      ]);

      hideLoading();

      if (!resultA.success) {
        alert('文件A读取失败: ' + (resultA.error || '未知错误'));
        return;
      }
      if (!resultB.success) {
        alert('文件B读取失败: ' + (resultB.error || '未知错误'));
        return;
      }

      renderDiffResult(resultA.content, resultB.content);
    } catch (err) {
      hideLoading();
      alert('对比失败: ' + err.message);
    }
  }

  const DIFF_CONTEXT_LINES = 10;

  function renderDiffResult(textA, textB) {
    const changes = Diff.diffLines(textA, textB);

    // Build a flat list of "segments" with type and line info
    // Each segment: { type: 'unchanged'|'removed'|'added', lines: [...], lineNumsA: [...], lineNumsB: [...] }
    const segments = [];
    let lineNumA = 1;
    let lineNumB = 1;

    for (const change of changes) {
      const lines = change.value.split('\n');
      if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
      }
      if (lines.length === 0) continue;

      const seg = { lines: lines, lineNumsA: [], lineNumsB: [], type: 'unchanged' };
      if (change.added) {
        seg.type = 'added';
        for (let i = 0; i < lines.length; i++) seg.lineNumsB.push(lineNumB++);
      } else if (change.removed) {
        seg.type = 'removed';
        for (let i = 0; i < lines.length; i++) seg.lineNumsA.push(lineNumA++);
      } else {
        seg.type = 'unchanged';
        for (let i = 0; i < lines.length; i++) {
          seg.lineNumsA.push(lineNumA++);
          seg.lineNumsB.push(lineNumB++);
        }
      }
      segments.push(seg);
    }

    // Determine which unchanged segments should be shown (within CONTEXT_LINES of a diff)
    const shouldShow = new Array(segments.length).fill(false);
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].type !== 'unchanged') {
        // Mark this segment and nearby unchanged segments
        for (let j = Math.max(0, i - 1); j <= Math.min(segments.length - 1, i + 1); j++) {
          if (segments[j].type === 'unchanged') {
            shouldShow[j] = true;
          } else {
            shouldShow[j] = true; // always show diff segments
          }
        }
      }
    }
    // Also always show diff segments
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].type !== 'unchanged') shouldShow[i] = true;
    }

    // For shown unchanged segments, trim to only CONTEXT_LINES around diff edges
    // Build final render plan
    const renderParts = []; // each part: { type, lines, lineNumsA, lineNumsB } or { type: 'fold', count, startA, endA, startB, endB }

    // Pair consecutive removed+added segments for inline char-level diff
    let htmlA = '';
    let htmlB = '';
    let addedCount = 0;
    let removedCount = 0;
    let curLineA = 1;
    let curLineB = 1;

    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si];

      if (seg.type === 'removed') {
        const nextSeg = si + 1 < segments.length ? segments[si + 1] : null;
        if (nextSeg && nextSeg.type === 'added') {
          // Paired: render removed+added with inline char highlights
          const pairCount = Math.min(seg.lines.length, nextSeg.lines.length);
          addedCount += nextSeg.lines.length;
          removedCount += seg.lines.length;

          for (let i = 0; i < pairCount; i++) {
            const { removedParts, addedParts } = computeInlineDiff(seg.lines[i], nextSeg.lines[i]);
            htmlA += buildDiffLineInline(seg.lineNumsA[i], 'removed', removedParts);
            htmlB += buildDiffLineInline(nextSeg.lineNumsB[i], 'added', addedParts);
          }
          // Extra removed lines (no pair)
          for (let i = pairCount; i < seg.lines.length; i++) {
            htmlA += buildDiffLine(seg.lineNumsA[i], seg.lines[i], 'diff-line-removed');
            htmlB += buildDiffLine('', '', 'diff-line-unchanged');
          }
          // Extra added lines (no pair)
          for (let i = pairCount; i < nextSeg.lines.length; i++) {
            htmlA += buildDiffLine('', '', 'diff-line-unchanged');
            htmlB += buildDiffLine(nextSeg.lineNumsB[i], nextSeg.lines[i], 'diff-line-added');
          }
          si++; // skip the 'added' segment since we already rendered it
        } else {
          // Removed only (no following added)
          removedCount += seg.lines.length;
          for (let i = 0; i < seg.lines.length; i++) {
            htmlA += buildDiffLine(seg.lineNumsA[i], seg.lines[i], 'diff-line-removed');
            htmlB += buildDiffLine('', '', 'diff-line-unchanged');
          }
        }
      } else if (seg.type === 'added') {
        // Added without preceding removed
        addedCount += seg.lines.length;
        for (let i = 0; i < seg.lines.length; i++) {
          htmlA += buildDiffLine('', '', 'diff-line-unchanged');
          htmlB += buildDiffLine(seg.lineNumsB[i], seg.lines[i], 'diff-line-added');
        }
      } else {
        // Unchanged segment
        const hasPrevDiff = si > 0 && segments[si - 1].type !== 'unchanged';
        const hasNextDiff = si < segments.length - 1 && segments[si + 1].type !== 'unchanged';

        if (!hasPrevDiff && !hasNextDiff) {
          // No diff nearby at all — fold entire segment
          const count = seg.lines.length;
          const foldId = 'fold-' + seg.lineNumsA[0] + '-' + seg.lineNumsB[0];
          htmlA += buildFoldLine(foldId, count, seg.lineNumsA[0], seg.lineNumsA[seg.lineNumsA.length - 1]);
          htmlB += buildFoldLine(foldId, count, seg.lineNumsB[0], seg.lineNumsB[seg.lineNumsB.length - 1]);
          let expandedA = '';
          let expandedB = '';
          for (let i = 0; i < seg.lines.length; i++) {
            expandedA += buildDiffLine(seg.lineNumsA[i], seg.lines[i], 'diff-line-unchanged');
            expandedB += buildDiffLine(seg.lineNumsB[i], seg.lines[i], 'diff-line-unchanged');
          }
          htmlA += `<div class="diff-fold-content" id="${foldId}-A" style="display:none;">${expandedA}</div>`;
          htmlB += `<div class="diff-fold-content" id="${foldId}-B" style="display:none;">${expandedB}</div>`;
        } else {
          // Has at least one diff neighbor — split into fold / context parts
          const totalLines = seg.lines.length;
          let startContext = 0;
          let endContext = 0;
          let foldStart = 0;
          let foldEnd = totalLines;

          if (hasPrevDiff && hasNextDiff) {
            startContext = Math.min(DIFF_CONTEXT_LINES, totalLines);
            endContext = Math.min(DIFF_CONTEXT_LINES, totalLines - startContext);
            foldStart = startContext;
            foldEnd = totalLines - endContext;
            if (foldEnd <= foldStart) {
              startContext = totalLines;
              endContext = 0;
              foldStart = 0;
              foldEnd = 0;
            }
          } else if (hasPrevDiff) {
            startContext = Math.min(DIFF_CONTEXT_LINES, totalLines);
            foldStart = startContext;
            foldEnd = totalLines;
          } else if (hasNextDiff) {
            endContext = Math.min(DIFF_CONTEXT_LINES, totalLines);
            foldStart = 0;
            foldEnd = totalLines - endContext;
          }

          // Show leading context (after prev diff)
          for (let i = 0; i < startContext; i++) {
            htmlA += buildDiffLine(seg.lineNumsA[i], seg.lines[i], 'diff-line-unchanged');
            htmlB += buildDiffLine(seg.lineNumsB[i], seg.lines[i], 'diff-line-unchanged');
          }

          // Fold middle
          if (foldEnd > foldStart) {
            const foldCount = foldEnd - foldStart;
            const foldId = 'fold-' + seg.lineNumsA[foldStart] + '-' + seg.lineNumsB[foldStart];
            htmlA += buildFoldLine(foldId, foldCount, seg.lineNumsA[foldStart], seg.lineNumsA[foldEnd - 1]);
            htmlB += buildFoldLine(foldId, foldCount, seg.lineNumsB[foldStart], seg.lineNumsB[foldEnd - 1]);
            let expandedA = '';
            let expandedB = '';
            for (let i = foldStart; i < foldEnd; i++) {
              expandedA += buildDiffLine(seg.lineNumsA[i], seg.lines[i], 'diff-line-unchanged');
              expandedB += buildDiffLine(seg.lineNumsB[i], seg.lines[i], 'diff-line-unchanged');
            }
            htmlA += `<div class="diff-fold-content" id="${foldId}-A" style="display:none;">${expandedA}</div>`;
            htmlB += `<div class="diff-fold-content" id="${foldId}-B" style="display:none;">${expandedB}</div>`;
          }

          // Show trailing context (before next diff)
          for (let i = totalLines - endContext; i < totalLines; i++) {
            htmlA += buildDiffLine(seg.lineNumsA[i], seg.lines[i], 'diff-line-unchanged');
            htmlB += buildDiffLine(seg.lineNumsB[i], seg.lines[i], 'diff-line-unchanged');
          }
        }
      }
    }

    $('#diffContentA').innerHTML = htmlA;
    $('#diffContentB').innerHTML = htmlB;

    $('#diffSummary').textContent = `+${addedCount} 行新增  -${removedCount} 行删除`;

    $('#diffResult').style.display = 'block';
    $('#diffSettings').style.display = 'block';

    setupDiffSyncScroll();
    setupFoldClickHandlers();
  }

  function buildDiffLine(lineNum, text, className) {
    const escapedText = escapeHtml(text);
    return `<div class="diff-line ${className}"><span class="diff-line-num">${lineNum}</span><span class="diff-line-text">${escapedText}</span></div>`;
  }

  // Build a diff line with inline char-level highlights for changed portions
  // lineNum: line number string, text: raw line text, type: 'removed' or 'added', highlightParts: array of {text, changed}
  function buildDiffLineInline(lineNum, type, highlightParts) {
    const className = type === 'removed' ? 'diff-line-removed' : 'diff-line-added';
    const hlClass = type === 'removed' ? 'diff-char-removed' : 'diff-char-added';
    let textHtml = '';
    for (const part of highlightParts) {
      const escaped = escapeHtml(part.value);
      if (part.changed) {
        textHtml += `<span class="${hlClass}">${escaped}</span>`;
      } else {
        textHtml += escaped;
      }
    }
    return `<div class="diff-line ${className}"><span class="diff-line-num">${lineNum}</span><span class="diff-line-text">${textHtml}</span></div>`;
  }

  // Compute inline char-level diff for paired removed/added lines
  function computeInlineDiff(lineA, lineB) {
    const charDiff = Diff.diffChars(lineA, lineB);
    const removedParts = [];
    const addedParts = [];
    for (const part of charDiff) {
      if (part.added) {
        addedParts.push({ value: part.value, changed: true });
      } else if (part.removed) {
        removedParts.push({ value: part.value, changed: true });
      } else {
        removedParts.push({ value: part.value, changed: false });
        addedParts.push({ value: part.value, changed: false });
      }
    }
    return { removedParts, addedParts };
  }

  function buildFoldLine(foldId, count, startLine, endLine) {
    return `<div class="diff-fold" data-fold-id="${foldId}"><span class="diff-fold-arrow">▸</span>相同内容 (${count}行, 第${startLine}-${endLine}行)</div>`;
  }

  function setupFoldClickHandlers() {
    $$('.diff-fold').forEach((fold) => {
      fold.addEventListener('click', () => {
        const foldId = fold.dataset.foldId;
        const contentA = document.getElementById(foldId + '-A');
        const contentB = document.getElementById(foldId + '-B');
        if (!contentA || !contentB) return;

        const isHidden = contentA.style.display === 'none';
        contentA.style.display = isHidden ? 'block' : 'none';
        contentB.style.display = isHidden ? 'block' : 'none';

        const arrow = fold.querySelector('.diff-fold-arrow');
        if (arrow) arrow.textContent = isHidden ? '▾' : '▸';
      });
    });
  }

  function setupDiffSyncScroll() {
    const paneA = $('#diffContentA');
    const paneB = $('#diffContentB');
    let syncing = false;

    paneA.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      paneB.scrollTop = paneA.scrollTop;
      syncing = false;
    });

    paneB.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      paneA.scrollTop = paneB.scrollTop;
      syncing = false;
    });
  }

  $('#btnExpandAll').addEventListener('click', () => {
    $$('.diff-fold-content').forEach((el) => { el.style.display = 'block'; });
    $$('.diff-fold-arrow').forEach((el) => { el.textContent = '▾'; });
  });

  $('#btnCollapseAll').addEventListener('click', () => {
    $$('.diff-fold-content').forEach((el) => { el.style.display = 'none'; });
    $$('.diff-fold-arrow').forEach((el) => { el.textContent = '▸'; });
  });

  $('#btnExportDiff').addEventListener('click', async () => {
    const container = $('#diffContainer');
    if (!container) return;

    const nameA = state.files.viewFileDiffLeft[0]?.name || 'File A';
    const nameB = state.files.viewFileDiffRight[0]?.name || 'File B';
    const summary = $('#diffSummary').textContent;
    const now = new Date().toLocaleString('zh-CN');

    const reportHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>文件对比报告</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;margin:0;padding:20px;background:#f7f8fa;color:#2c3e50;}
h1{font-size:20px;margin-bottom:4px;}
.meta{font-size:13px;color:#7f8c8d;margin-bottom:20px;}
.diff-container{display:flex;border:1px solid #e1e8ed;border-radius:10px;overflow:hidden;background:#fff;}
.diff-pane{flex:1;min-width:0;overflow:auto;}
.diff-pane-header{padding:8px 14px;font-size:12px;font-weight:600;color:#7f8c8d;text-transform:uppercase;background:#eef1f5;border-bottom:1px solid #e1e8ed;}
.diff-divider{width:1px;background:#e1e8ed;}
.diff-line{display:flex;min-height:22px;padding:0 8px 0 0;border-left:3px solid transparent;font-family:monospace;font-size:12px;line-height:22px;}
.diff-line-num{width:44px;min-width:44px;text-align:right;padding-right:8px;color:#b0bec5;user-select:none;font-size:11px;}
.diff-line-text{flex:1;white-space:pre-wrap;word-break:break-all;padding-left:4px;}
.diff-line-removed{background:rgba(231,76,60,0.12);border-left-color:#e74c3c;}
.diff-line-removed .diff-line-text{color:#e74c3c;}
.diff-line-added{background:rgba(39,174,96,0.12);border-left-color:#27ae60;}
.diff-line-added .diff-line-text{color:#27ae60;}
.diff-line-unchanged{color:#2c3e50;}
.diff-fold{display:flex;align-items:center;justify-content:center;padding:6px 12px;background:#eef1f5;color:#b0bec5;font-size:11px;}
.diff-fold-content{display:none;}
</style>
</head>
<body>
<h1>文件对比报告</h1>
<p class="meta">${escapeHtml(nameA)} vs ${escapeHtml(nameB)} — ${summary} — ${now}</p>
${container.outerHTML}
</body>
</html>`;

    const outputDir = getOutputDir('outputDirFileDiff');
    const defaultName = `diff_report_${Date.now()}.html`;
    let savePath = defaultName;
    if (outputDir) {
      savePath = outputDir + '/' + defaultName;
    }

    if (window.pywebview && pywebview.api) {
      try {
        const result = await pywebview.api.save_diff_report({ content: reportHtml, file_path: savePath });
        if (result.success) {
          showSuccess('报告已保存至: ' + result.file_path);
        } else {
          alert(result.error || '保存失败');
        }
      } catch (err) {
        alert('保存失败: ' + err.message);
      }
    }
  });

  // ---- Expose for debug / external calls ----
  window.pdfToolbox = {
    navigateTo,
    showLoading,
    hideLoading,
    showSuccess,
    setProgress,
    showPasswordModal,
    state,
  };

  // ---- Init: load default output dir ----
  if (window.pywebview) {
    // pywebview ready event
    window.addEventListener('pywebviewready', loadDefaultOutputDir);
  } else {
    // Fallback for dev / demo
    loadDefaultOutputDir();
  }
})();
