const icDir = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23F5A623'><path d='M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'/></svg>`;
const icFile = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23717970'><path d='M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z'/></svg>`;
let currentRoot = '';
let currentFile = '';
let currentParent = '';
let longPressTimer = null;
let longPressTriggered = false;
let pendingDelFolder = null;
let warnToastTimer = null;
let danmakuMode = 1;
let danmakuSize = 25;
let dialogClosing = false;

function search() {
    doAction('search', { word: $('#keyword').val() });
}

function push() {
    doAction('push', { url: $('#push_url').val() });
}

function setting() {
    doAction('setting', { text: $('#setting_text').val(), name: $('#setting_name').val() });
}

function sendDanmaku() {
    const text = $('#danmaku_text').val().trim();
    if (!text) return;
    doAction('danmaku', { text: `[0.0,${danmakuMode},${danmakuSize},16777215]${text}` });
    $('#danmaku_text').val('');
}

function showDanmakuModeDialog() {
    $('#danmakuModeDialog .md-dialog-list-item').removeClass('active');
    $(`#danmakuModeDialog .md-dialog-list-item[data-val="${danmakuMode}"]`).addClass('active');
    openDialog('danmakuModeDialog');
}

function setDanmakuMode(val, label) {
    danmakuMode = val;
    $('#danmaku_mode_label').text(label);
    closeDialog('danmakuModeDialog');
}

function showDanmakuSizeDialog() {
    $('#danmakuSizeDialog .md-dialog-list-item').removeClass('active');
    $(`#danmakuSizeDialog .md-dialog-list-item[data-val="${danmakuSize}"]`).addClass('active');
    openDialog('danmakuSizeDialog');
}

function setDanmakuSize(val, label) {
    danmakuSize = val;
    $('#danmaku_size_label').text(label);
    closeDialog('danmakuSizeDialog');
}

function doAction(action, kv) {
    $.post('/action', { ...kv, do: action });
}

function openDialog(id) {
    $('#' + id).show();
    history.pushState({ dialog: id }, '');
}

function closeDialog(id) {
    dialogClosing = true;
    $('#' + id).hide();
    history.back();
}

function startLongPress(callback) {
    longPressTriggered = false;
    longPressTimer = setTimeout(() => {
        longPressTriggered = true;
        callback();
    }, 500);
}

function cancelLongPress() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
}

function escPath(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildParentItem() {
    return `<a class="file-item" href="javascript:void(0)" onclick="history.back()">
    <img class="file-icon" src="${icDir}" alt="">
    <div class="file-info"><div class="file-name">..</div></div>
    </a>`;
}

function buildDirItem(name, time, path) {
    const ep = escPath(path);
    return `<a class="file-item" href="javascript:void(0)" ontouchstart="startLongPress(()=>showDelFolderDialog('${ep}',currentRoot))" ontouchmove="cancelLongPress()" ontouchend="cancelLongPress()" oncontextmenu="return false" onclick="if(!longPressTriggered)listFile('${ep}',true)">
    <img class="file-icon" src="${icDir}" alt="">
    <div class="file-info"><div class="file-name">${escHtml(name)}</div><div class="file-time">${escHtml(time)}</div></div>
    </a>`;
}

function buildFileItem(name, time, path) {
    const ep = escPath(path);
    return `<a class="file-item" href="javascript:void(0)" ontouchstart="startLongPress(()=>showDelFileDialog('${ep}'))" ontouchmove="cancelLongPress()" ontouchend="cancelLongPress()" oncontextmenu="return false" onclick="if(!longPressTriggered)selectFile('${ep}')">
    <img class="file-icon" src="${icFile}" alt="">
    <div class="file-info"><div class="file-name">${escHtml(name)}</div><div class="file-time">${escHtml(time)}</div></div>
    </a>`;
}

function addFile(node) {
    $('#file_list').append(node);
}

function selectFile(path) {
    currentFile = path;
    $("#fileUrl").text("file:/" + path);
    openDialog('fileInfoDialog');
}

function pushFile(yes) {
    closeDialog('fileInfoDialog');
    if (yes === 1) doAction('file', { path: "file:/" + currentFile });
}

function listFile(path, addHistory = false) {
    const loadingTimer = setTimeout(() => $('#loadingToast').show(), 200);
    $.get('/file' + path, function (res) {
        clearTimeout(loadingTimer);
        let info;
        try {
            info = JSON.parse(res);
        } catch (e) {
            $('#loadingToast').hide();
            warnToast('响应格式错误');
            return;
        }
        const parent = info.parent;
        currentRoot = path;
        currentParent = parent;
        const array = info.files;
        if (path === '' && array.length === 0) warnToast('可能没有存储权限');
        $('#file_list').html('');
        if (parent !== '.') addFile(buildParentItem());
        array.forEach(node => {
            if (node.dir === 1) addFile(buildDirItem(node.name, node.time, node.path));
            else addFile(buildFileItem(node.name, node.time, node.path));
        });
        if (addHistory) history.pushState(path, '');
        $('#loadingToast').hide();
    }).fail(function () {
        clearTimeout(loadingTimer);
        $('#loadingToast').hide();
        warnToast('加载失败');
    });
}

function uploadFile() {
    $('#file_uploader').click();
}

function onFileSelected() {
    const files = $('#file_uploader')[0].files;
    if (files.length === 0) return;
    const tip = Array.from(files).map(f => f.name).join(', ');
    $('#uploadTipContent').text(tip);
    openDialog('uploadTip');
}

function confirmUpload(yes) {
    closeDialog('uploadTip');
    if (yes !== 1) return;
    const files = $('#file_uploader')[0].files;
    if (files.length === 0) return;
    const formData = new FormData();
    formData.append('path', currentRoot);
    Array.from(files).forEach((f, i) => formData.append('files-' + i, f));
    $('#loadingToast').show();
    $.ajax({
        url: '/upload',
        type: 'post',
        data: formData,
        processData: false,
        contentType: false,
        complete: function () {
            $('#loadingToast').hide();
            $('#file_uploader').val('');
            listFile(currentRoot);
        }
    });
}

function showNewFolderDialog() {
    openDialog('newFolder');
}

function confirmNewFolder(yes) {
    closeDialog('newFolder');
    const name = $('#newFolderContent').val().trim();
    $('#newFolderContent').val('');
    if (yes !== 1 || name.length === 0) return;
    $('#loadingToast').show();
    $.post('/newFolder', { path: currentRoot, name }, function () {
        $('#loadingToast').hide();
        listFile(currentRoot);
    }).fail(function () {
        $('#loadingToast').hide();
        warnToast('新建失败');
    });
}

function showDelFolderDialog(path, refreshPath) {
    pendingDelFolder = { path, refreshPath };
    $('#delFolderContent').text('是否刪除 ' + path);
    openDialog('delFolder');
}

function confirmDelFolder(yes) {
    closeDialog('delFolder');
    if (yes !== 1 || !pendingDelFolder) { pendingDelFolder = null; return; }
    const { path, refreshPath } = pendingDelFolder;
    pendingDelFolder = null;
    $('#loadingToast').show();
    $.post('/delFolder', { path }, function () {
        $('#loadingToast').hide();
        listFile(refreshPath);
    }).fail(function () {
        $('#loadingToast').hide();
        warnToast('删除失败');
    });
}

function showDelFileDialog(path) {
    currentFile = path;
    $('#delFileContent').text('是否刪除 ' + path);
    openDialog('delFile');
}

function confirmDelFile(yes) {
    closeDialog('delFile');
    if (yes !== 1) return;
    $('#loadingToast').show();
    $.post('/delFile', { path: currentFile }, function () {
        $('#loadingToast').hide();
        listFile(currentRoot);
    }).fail(function () {
        $('#loadingToast').hide();
        warnToast('删除失败');
    });
}

function warnToast(msg) {
    $('#warnToastContent').text(msg);
    $('#warnToast').show();
    if (warnToastTimer) clearTimeout(warnToastTimer);
    warnToastTimer = setTimeout(() => { $('#warnToast').hide(); warnToastTimer = null; }, 1000);
}

function showPanel(id) {
    for (let i = 1; i <= 7; i++) {
        document.getElementById('panel' + i).classList.toggle('active', i === id);
        document.getElementById('tab' + i).classList.toggle('active', i === id);
    }
    if (id === 5 && document.getElementById('file_list').innerHTML === '') listFile('');
    if (id === 7 && document.getElementById('wp_grid').innerHTML === '') loadWallpapers();
}

/* ═══════════ 网盘 Cookie ═══════════ */

function loadCookie() {
    const type = $('#cookie_type').val();
    $.get('/cookie?type=' + type, function (res) {
        try {
            const info = typeof res === 'string' ? JSON.parse(res) : res;
            $('#cookie_content').val(info.content || '');
            $('#cookie_state').text(info.content ? '已配置（' + info.file + '）' : '未配置');
        } catch (e) {
            $('#cookie_state').text('读取失败');
        }
    }).fail(function () { $('#cookie_state').text('读取失败'); });
}

function saveCookie() {
    const type = $('#cookie_type').val();
    const content = $('#cookie_content').val();
    $.post('/cookie', { type: type, content: content }, function (data) {
        let r = {};
        try { r = typeof data === 'string' ? JSON.parse(data) : data; } catch (e) {}
        const written = r.written === undefined ? -1 : r.written;
        const allFiles = r.allFiles !== false;
        const hint = $('#cookie_hint');
        if (allFiles && written >= 10) {
            $('#cookie_state').text('已保存（写入 ' + written + ' 个位置）');
            hint.hide();
        } else if (allFiles) {
            $('#cookie_state').text('已保存（写入 ' + written + ' 个位置）');
            hint.hide();
        } else {
            $('#cookie_state').text('已保存，但写入不完整（' + written + ' 个位置）');
            hint.html('⚠️ 未获得「所有文件访问」权限，Cookie 无法写入公共目录，网盘源会提示未配置 Cookie。'
                + '<button class="md-btn md-btn-tonal cookie-warn-btn" onclick="requestPermission()">在电视上授权</button>')
                .show();
        }
    }).fail(function (xhr) {
        $('#cookie_state').text('保存失败：' + (xhr.responseText || ''));
    });
}

function requestPermission() {
    $('#cookie_hint').html('已发送授权请求，请查看电视屏幕上的系统设置页，打开「允许访问所有文件」后返回。'
        + '<button class="md-btn md-btn-tonal cookie-warn-btn" onclick="requestPermission()">再次触发</button>');
    $.get('/action?do=permission', function () {});
}

/* ═══════════ 背景主题 ═══════════ */

function loadWallpapers() {
    $.get('/wallpaper', function (res) {
        let info;
        try { info = typeof res === 'string' ? JSON.parse(res) : res; } catch (e) { return; }
        const grid = $('#wp_grid').html('');
        (info.presets || []).forEach(p => {
            grid.append('<div class="wp-card" onclick="applyPreset(\'' + p.id + '\')"><img loading="lazy" src="/wallpaper/preset/' + p.id + '.jpg"/><span>' + p.name + '</span></div>');
        });
        if (info.custom) $('#wp_state').text('当前使用自定义背景');
    }).fail(function () { $('#wp_state').text('加载失败'); });
}

function applyPreset(id) {
    $('#wp_state').text('应用中...');
    $.post('/wallpaper', { preset: id }, function (data) {
        $('#wp_state').text(data === 'OK' ? '已应用，重启应用后生效更佳' : data);
    }).fail(function (xhr) {
        $('#wp_state').text('应用失败：' + (xhr.responseText || ''));
    });
}

function uploadWallpaper() {
    const files = $('#wp_uploader')[0].files;
    if (files.length === 0) return;
    const formData = new FormData();
    formData.append('files-0', files[0]);
    $('#wp_state').text('上传中...');
    $.ajax({
        url: '/wallpaper',
        type: 'post',
        data: formData,
        processData: false,
        contentType: false,
        success: function (data) {
            $('#wp_state').text(data === 'OK' ? '已应用自定义背景' : data);
            $('#wp_uploader').val('');
        },
        error: function (xhr) {
            $('#wp_state').text('上传失败：' + (xhr.responseText || ''));
        }
    });
}

function resetWallpaper() {
    $.post('/wallpaper', { action: 'reset' }, function (data) {
        $('#wp_state').text(data === 'OK' ? '已恢复默认' : data);
    }).fail(function (xhr) {
        $('#wp_state').text('重置失败：' + (xhr.responseText || ''));
    });
}

const tab = parseInt(new URLSearchParams(window.location.search).get('tab')) || 1;
history.replaceState(null, '');
showPanel(tab);

window.addEventListener('popstate', function () {
    if (dialogClosing) { dialogClosing = false; return; }
    const visible = $('.md-dialog-overlay:visible');
    if (visible.length) { visible.first().hide(); return; }
    listFile(currentParent);
});

$(function () {
    $('#keyword').on('keydown', function (e) { if (e.key === 'Enter') { this.blur(); search(); } });
    $('#push_url').on('keydown', function (e) { if (e.key === 'Enter') { this.blur(); push(); } });
    $('#danmaku_text').on('keydown', function (e) { if (e.key === 'Enter') { this.blur(); sendDanmaku(); } });
    $('#setting_name, #setting_text').on('keydown', function (e) { if (e.key === 'Enter') { this.blur(); setting(); } });
    $('#newFolderContent').on('keydown', function (e) { if (e.key === 'Enter') { this.blur(); confirmNewFolder(1); } });
});
