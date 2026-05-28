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
    },
    pageOrder: [],       // array of page indices for Page Manager
    pageRotations: {},   // { pageIndex: degrees }
    pdfPath: null,       // current PDF in Page Manager
    pdfPassword: null,   // password for encrypted PDF in Page Manager
    passwordCallback: null,
  };

  const viewTitles = {
    viewHome: 'PDF全能工具箱',
    viewPdfToWord: 'PDF转Word',
    viewPdfToImage: 'PDF转图片',
    viewImageToPdf: '图片转PDF',
    viewPageManager: '页面操作',
    viewMergePdf: '合并PDF',
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
  function setupDropZone(zoneId, viewId, fileTypes, multiple) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;
    const input = zone.querySelector('input[type="file"]');

    if (input) {
      input.multiple = multiple !== false;
      input.accept = fileTypes || '*';
    }

    zone.addEventListener('dragover', (e) => {
      // Only accept external file drags (not internal reorder drags)
      if (e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        zone.classList.add('drag-over');
      }
    });

    zone.addEventListener('dragleave', (e) => {
      // Only remove highlight if leaving the zone entirely
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('drag-over');
      }
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');

      // Ignore internal reorder drags (they set effectAllowed='move')
      if (e.dataTransfer.effectAllowed === 'move') return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length) {
        // In PyWebView, dropped files expose .path property
        const hasPaths = files.some((f) => f.path);
        if (hasPaths) {
          addFiles(viewId, files, false);
        } else {
          // Browser doesn't expose file paths - fall back to pywebview dialog
          openPywebviewFileDialog(zoneId, viewId, fileTypes);
        }
      }
    });

    // Click to open file dialog
    zone.addEventListener('click', (e) => {
      if (e.target === input) return;
      e.preventDefault();
      e.stopPropagation();

      if (window.pywebview && pywebview.api) {
        openPywebviewFileDialog(zoneId, viewId, fileTypes);
      } else {
        if (input) input.click();
      }
    });

    // Native file input handler (fallback)
    if (input) {
      input.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      input.addEventListener('change', () => {
        const files = Array.from(input.files);
        if (files.length) addFiles(viewId, files, false);
        input.value = '';
      });
    }
  }

  async function openPywebviewFileDialog(zoneId, viewId, fileTypes) {
    if (!window.pywebview || !pywebview.api) return;
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

  function addFiles(viewId, files, isPathObjects) {
    if (!state.files[viewId]) state.files[viewId] = [];

    // Page Manager only allows single PDF
    if (viewId === 'viewPageManager') {
      state.files[viewId] = [];
      state.pdfPassword = null;
    }

    const items = isPathObjects
      ? files.map((f) => ({ name: f.name, path: f.path, size: f.size || 0 }))
      : files.map((f) => ({ name: f.name, path: f.path || '', size: f.size }));

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
  }

  function removeFile(viewId, index) {
    state.files[viewId].splice(index, 1);
    renderFileList(viewId);
    updateButtonStates(viewId);

    if (viewId === 'viewMergePdf') checkMergePageSizes();
    if (viewId === 'viewImageToPdf') updateBaseImageSelector();
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
      <div class="file-item ${isSortable ? 'sortable-item' : ''}" data-index="${i}" draggable="${isSortable}">
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

    // Setup drag reorder if sortable
    if (isSortable) setupDragReorder(listEl, viewId);
  }

  function updateButtonStates(viewId) {
    const files = state.files[viewId] || [];
    const btnMap = {
      viewPdfToWord: '#btnStartPdfToWord',
      viewPdfToImage: '#btnStartPdfToImage',
      viewImageToPdf: '#btnStartImageToPdf',
      viewMergePdf: '#btnStartMergePdf',
    };
    const btn = document.querySelector(btnMap[viewId]);
    if (btn) btn.disabled = files.length === 0;

    // Page Manager special
    if (viewId === 'viewPageManager') {
      const hasPdf = files.length > 0;
      $('#pageToolbar').style.display = hasPdf ? 'flex' : 'none';
      $('#pageManagerActions').style.display = hasPdf ? 'flex' : 'none';
    }
  }

  // ---- Drag Reorder for File Lists ----
  function setupDragReorder(listEl, viewId) {
    let dragIdx = null;

    listEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    listEl.querySelectorAll('.file-item').forEach((item) => {
      item.addEventListener('dragstart', (e) => {
        dragIdx = parseInt(item.dataset.index, 10);
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', 'reorder');
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        dragIdx = null;
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dropIdx = parseInt(item.dataset.index, 10);
        if (dragIdx !== null && dragIdx !== dropIdx) {
          const arr = state.files[viewId];
          const [moved] = arr.splice(dragIdx, 1);
          arr.splice(dropIdx, 0, moved);
          renderFileList(viewId);
        }
      });
    });
  }

  // ---- Setup Drop Zones ----
  setupDropZone('dropPdfToWord', 'viewPdfToWord', '.pdf');
  setupDropZone('dropPdfToImage', 'viewPdfToImage', '.pdf');
  setupDropZone('dropImageToPdf', 'viewImageToPdf', '.jpg,.jpeg,.png');
  setupDropZone('dropPageManager', 'viewPageManager', '.pdf', false);
  setupDropZone('dropMergePdf', 'viewMergePdf', '.pdf');

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

    // Try to get page sizes from backend
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
              loadThumbnails(); // Now uses state.pdfPassword
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
      // Demo mode: show placeholder thumbnails
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
        <div class="thumb-card" data-page-index="${pageIdx}" data-display-index="${displayIdx}" draggable="true">
          ${imgTag}
          <div class="thumb-label">第 ${pageIdx + 1} 页</div>
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
        const idx = parseInt(btn.dataset.pageIndex, 10);
        rotatePage(idx);
      });
    });

    // Delete single page
    grid.querySelectorAll('.thumb-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.pageIndex, 10);
        deleteSinglePage(idx);
      });
    });

    // Drag reorder thumbnails
    setupThumbnailDragReorder();
  }

  function setupThumbnailDragReorder() {
    const grid = $('#thumbnailGrid');
    let dragDisplayIdx = null;

    grid.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    grid.querySelectorAll('.thumb-card').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        dragDisplayIdx = parseInt(card.dataset.displayIndex, 10);
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', 'thumb-reorder');
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        dragDisplayIdx = null;
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dropDisplayIdx = parseInt(card.dataset.displayIndex, 10);
        if (dragDisplayIdx !== null && dragDisplayIdx !== dropDisplayIdx) {
          const [moved] = state.pageOrder.splice(dragDisplayIdx, 1);
          state.pageOrder.splice(dropDisplayIdx, 0, moved);
          renderThumbnails(getCurrentThumbnails());
        }
      });
    });
  }

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

    // Convert 1-based to 0-based and filter
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
    // from/to are 1-based display positions
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

    const outputDir = getOutputDir('outputDirPdfToWord');

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
    const outputDir = getOutputDir('outputDirPdfToImage');

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
    const outputDir = getOutputDir('outputDirImageToPdf');

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

    showLoading('正在保存修改...');

    try {
      const params = {
        file_path: state.pdfPath,
        page_order: state.pageOrder,
        rotations: state.pageRotations,
      };
      if (state.pdfPassword) params.password = state.pdfPassword;

      const result = await pywebview.api.reorder_pages(params);

      hideLoading();

      if (result.success) {
        showSuccess('保存成功！');
      } else if (result.need_password) {
        showPasswordModal(async (password) => {
          state.pdfPassword = password;
          showLoading('正在解锁并保存...');
          const retry = await pywebview.api.reorder_pages({
            file_path: state.pdfPath,
            page_order: state.pageOrder,
            rotations: state.pageRotations,
            password: password,
          });
          hideLoading();
          if (retry.success) {
            showSuccess('保存成功！');
          } else {
            alert(retry.error || '保存失败');
          }
        });
      } else {
        alert(result.error || '保存失败');
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
    const outputDir = getOutputDir('outputDirMergePdf');

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
})();
