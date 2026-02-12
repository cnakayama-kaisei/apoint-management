// Firebase設定
const firebaseConfig = {
    apiKey: "AIzaSyCQXLJdwou5Wxg0e44sIro74mIkzq2Gea0",
    authDomain: "apoint-management.firebaseapp.com",
    databaseURL: "https://apoint-management-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "apoint-management",
    storageBucket: "apoint-management.firebasestorage.app",
    messagingSenderId: "978886800554",
    appId: "1:978886800554:web:bbc58959dd367cc67cccd3",
    measurementId: "G-E7Y4RECQQH"
};

// Firebase初期化
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// グローバル変数
let members = [];
let history = [];
let currentFilter = 'all';
let editingMemberId = null;
let membersListener = null;
let historyListener = null;

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// アプリ初期化
function initializeApp() {
    initializeFilters();
    listenToMembers();
    listenToHistory();
}

// メンバーデータのリアルタイム監視
function listenToMembers() {
    membersListener = database.ref('members');
    membersListener.on('value', function(snapshot) {
        members = [];
        snapshot.forEach(function(childSnapshot) {
            members.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
        renderMembers();
        checkNotifications();
    });
}

// 履歴データのリアルタイム監視
function listenToHistory() {
    historyListener = database.ref('history');
    historyListener.on('value', function(snapshot) {
        history = [];
        snapshot.forEach(function(childSnapshot) {
            history.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });
    });
}

// ローディング表示
function showLoading() {
    document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
}

// メンバー一覧表示
function renderMembers() {
    const grid = document.getElementById('membersGrid');
    
    let filteredMembers = members;
    if (currentFilter !== 'all') {
        filteredMembers = members.filter(m => m.status === currentFilter);
    }
    
    if (filteredMembers.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p class="empty-state-text">メンバーが登録されていません</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filteredMembers.map(member => {
        const statusClass = getStatusClass(member.status);
        const setDate = formatDate(member.statusSetDate);
        const endDate = member.statusEndDate ? formatDate(member.statusEndDate) : '未設定';
        const daysSince = getDaysSince(member.statusSetDate);
        
        return `
            <div class="member-card ${statusClass}" onclick="openEditModal('${member.id}')">
                <div class="member-name">${member.name}</div>
                <div class="status-badge ${statusClass}">${member.status}</div>
                <div class="member-info">
                    <div class="member-info-row">
                        <span class="member-info-label">設定日:</span>
                        <span>${setDate} (${daysSince}日前)</span>
                    </div>
                    <div class="member-info-row">
                        <span class="member-info-label">解除予定:</span>
                        <span>${endDate}</span>
                    </div>
                </div>
                ${member.memo ? `<div class="member-memo">💬 ${member.memo}</div>` : ''}
            </div>
        `;
    }).join('');
}

// ステータスに応じたクラス名取得
function getStatusClass(status) {
    const statusMap = {
        'アポイント停止': 'status-stop',
        'アポイント制限': 'status-limited',
        'トレアポのみ': 'status-training',
        'トレアポ+通常アポ': 'status-trainplus'
    };
    return statusMap[status] || '';
}

// 日付フォーマット
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
}

// 経過日数計算
function getDaysSince(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// 通知チェック
function checkNotifications() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    
    const notifications = [];
    
    members.forEach(member => {
        if (!member.statusEndDate) return;
        
        const endDate = new Date(member.statusEndDate);
        endDate.setHours(0, 0, 0, 0);
        
        if (endDate.getTime() === today.getTime()) {
            notifications.push(`${member.name}さんのステータス解除予定日は本日です`);
        } else if (endDate >= today && endDate <= threeDaysLater) {
            const daysLeft = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));
            notifications.push(`${member.name}さんのステータス解除予定日まであと${daysLeft}日です`);
        }
    });
    
    if (notifications.length > 0) {
        const banner = document.getElementById('notificationBanner');
        const text = document.getElementById('notificationText');
        text.innerHTML = '🔔 ' + notifications.join('<br>🔔 ');
        banner.classList.add('show');
    }
}

// フィルター初期化
function initializeFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderMembers();
        });
    });
}

// 追加モーダルを開く
function openAddModal() {
    editingMemberId = null;
    document.getElementById('modalTitle').textContent = '新しいメンバーを追加';
    document.getElementById('memberForm').reset();
    document.getElementById('memberId').value = '';
    document.getElementById('deleteBtn').style.display = 'none';
    document.getElementById('historySection').style.display = 'none';
    document.getElementById('memberModal').classList.add('show');
}

// 編集モーダルを開く
function openEditModal(memberId) {
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    
    editingMemberId = memberId;
    document.getElementById('modalTitle').textContent = 'メンバー情報編集';
    document.getElementById('memberId').value = member.id;
    document.getElementById('memberName').value = member.name;
    document.getElementById('memberStatus').value = member.status;
    document.getElementById('memberMemo').value = member.memo || '';
    
    if (member.statusEndDate) {
        document.getElementById('hasEndDate').checked = true;
        document.getElementById('statusEndDate').value = member.statusEndDate.split('T')[0];
        document.getElementById('endDateGroup').style.display = 'block';
    } else {
        document.getElementById('hasEndDate').checked = false;
        document.getElementById('endDateGroup').style.display = 'none';
    }
    
    document.getElementById('deleteBtn').style.display = 'inline-block';
    
    // 履歴表示
    renderHistory(memberId);
    
    document.getElementById('memberModal').classList.add('show');
}

// 履歴表示
function renderHistory(memberId) {
    const memberHistory = history.filter(h => h.memberId === memberId);
    const historySection = document.getElementById('historySection');
    const historyList = document.getElementById('historyList');
    
    if (memberHistory.length === 0) {
        historySection.style.display = 'none';
        return;
    }
    
    historySection.style.display = 'block';
    historyList.innerHTML = memberHistory
        .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))
        .map(h => `
            <div class="history-item">
                <div class="history-date">${formatDate(h.changedAt)} ${formatTime(h.changedAt)}</div>
                <div class="history-change">
                    ${h.fromStatus ? `「${h.fromStatus}」→` : ''}「${h.toStatus}」に変更
                </div>
                ${h.memo ? `<div class="history-change">💬 ${h.memo}</div>` : ''}
            </div>
        `).join('');
}

// 時刻フォーマット
function formatTime(dateString) {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// モーダルを閉じる
function closeModal() {
    document.getElementById('memberModal').classList.remove('show');
    editingMemberId = null;
}

// 解除予定日の表示切替
function toggleEndDate() {
    const checkbox = document.getElementById('hasEndDate');
    const endDateGroup = document.getElementById('endDateGroup');
    endDateGroup.style.display = checkbox.checked ? 'block' : 'none';
}

// メンバー保存
function saveMember() {
    const name = document.getElementById('memberName').value.trim();
    const status = document.getElementById('memberStatus').value;
    const memo = document.getElementById('memberMemo').value.trim();
    const hasEndDate = document.getElementById('hasEndDate').checked;
    const endDate = hasEndDate ? document.getElementById('statusEndDate').value : null;
    
    if (!name) {
        alert('メンバー名を入力してください');
        return;
    }
    
    showLoading();
    const now = new Date().toISOString();
    
    if (editingMemberId) {
        // 編集
        const member = members.find(m => m.id === editingMemberId);
        const oldStatus = member.status;
        
        const updates = {
            name: name,
            status: status,
            memo: memo,
            statusEndDate: endDate ? new Date(endDate).toISOString() : null,
            updatedAt: now
        };
        
        // ステータスが変わった場合は設定日も更新
        if (oldStatus !== status) {
            updates.statusSetDate = now;
        }
        
        // メンバー情報を更新
        database.ref('members/' + editingMemberId).update(updates)
            .then(() => {
                // 履歴に記録
                if (oldStatus !== status || member.memo !== memo) {
                    const historyRef = database.ref('history').push();
                    return historyRef.set({
                        memberId: editingMemberId,
                        changedAt: now,
                        changedBy: 'マネージャー',
                        fromStatus: oldStatus,
                        toStatus: status,
                        memo: memo
                    });
                }
            })
            .then(() => {
                hideLoading();
                closeModal();
            })
            .catch(error => {
                hideLoading();
                alert('保存に失敗しました: ' + error.message);
            });
    } else {
        // 新規追加
        const newMemberRef = database.ref('members').push();
        const newMemberId = newMemberRef.key;
        
        newMemberRef.set({
            name: name,
            status: status,
            statusSetDate: now,
            statusEndDate: endDate ? new Date(endDate).toISOString() : null,
            memo: memo,
            createdAt: now,
            updatedAt: now
        })
            .then(() => {
                // 履歴に記録
                const historyRef = database.ref('history').push();
                return historyRef.set({
                    memberId: newMemberId,
                    changedAt: now,
                    changedBy: 'マネージャー',
                    fromStatus: null,
                    toStatus: status,
                    memo: memo
                });
            })
            .then(() => {
                hideLoading();
                closeModal();
            })
            .catch(error => {
                hideLoading();
                alert('保存に失敗しました: ' + error.message);
            });
    }
}

// メンバー削除
function deleteMember() {
    if (!editingMemberId) return;
    
    const member = members.find(m => m.id === editingMemberId);
    if (!confirm(`${member.name}さんを削除してもよろしいですか?`)) {
        return;
    }
    
    showLoading();
    
    // メンバーを削除
    database.ref('members/' + editingMemberId).remove()
        .then(() => {
            // 関連する履歴も削除
            const historyPromises = [];
            history.forEach(h => {
                if (h.memberId === editingMemberId) {
                    historyPromises.push(database.ref('history/' + h.id).remove());
                }
            });
            return Promise.all(historyPromises);
        })
        .then(() => {
            hideLoading();
            closeModal();
        })
        .catch(error => {
            hideLoading();
            alert('削除に失敗しました: ' + error.message);
        });
}

// モーダル外クリックで閉じる
document.getElementById('memberModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});
