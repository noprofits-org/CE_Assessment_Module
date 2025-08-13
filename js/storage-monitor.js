class StorageMonitor {
    constructor() {
        this.maxStorageSize = 10 * 1024 * 1024; // 10MB approximate limit
        this.warningThreshold = 0.8; // Warn at 80% usage
        this.criticalThreshold = 0.95; // Critical at 95% usage
    }

    // Get current localStorage size
    getStorageSize() {
        let totalSize = 0;
        
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                const value = localStorage.getItem(key);
                // Rough estimate: 2 bytes per character (UTF-16)
                totalSize += (key.length + value.length) * 2;
            }
        }
        
        return totalSize;
    }

    // Get storage usage percentage
    getUsagePercentage() {
        const currentSize = this.getStorageSize();
        return (currentSize / this.maxStorageSize) * 100;
    }

    // Format bytes to human readable
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Get storage breakdown by key
    getStorageBreakdown() {
        const breakdown = [];
        
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                const value = localStorage.getItem(key);
                const size = (key.length + value.length) * 2;
                breakdown.push({
                    key: key,
                    size: size,
                    formattedSize: this.formatBytes(size),
                    percentage: (size / this.getStorageSize()) * 100
                });
            }
        }
        
        return breakdown.sort((a, b) => b.size - a.size);
    }

    // Check storage status
    checkStorageStatus() {
        const usagePercentage = this.getUsagePercentage();
        const currentSize = this.getStorageSize();
        
        return {
            currentSize: currentSize,
            formattedSize: this.formatBytes(currentSize),
            maxSize: this.maxStorageSize,
            formattedMaxSize: this.formatBytes(this.maxStorageSize),
            usagePercentage: usagePercentage,
            status: usagePercentage >= this.criticalThreshold ? 'critical' : 
                   usagePercentage >= this.warningThreshold ? 'warning' : 'ok',
            availableSpace: this.maxStorageSize - currentSize,
            formattedAvailableSpace: this.formatBytes(this.maxStorageSize - currentSize)
        };
    }

    // Clean old data
    cleanOldData(daysToKeep = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        const keysToClean = [];
        
        // Clean old test history
        const testHistory = JSON.parse(localStorage.getItem('ce_housing_assessor') || '{}').testHistory || [];
        const filteredHistory = testHistory.filter(test => 
            new Date(test.date) > cutoffDate
        );
        
        if (filteredHistory.length < testHistory.length) {
            const data = JSON.parse(localStorage.getItem('ce_housing_assessor') || '{}');
            data.testHistory = filteredHistory;
            localStorage.setItem('ce_housing_assessor', JSON.stringify(data));
        }
        
        // Clean old daily study data
        const dailyStudy = JSON.parse(localStorage.getItem('ce_housing_assessor') || '{}').dailyStudy || {};
        const filteredDailyStudy = {};
        
        Object.keys(dailyStudy).forEach(date => {
            if (new Date(date) > cutoffDate) {
                filteredDailyStudy[date] = dailyStudy[date];
            }
        });
        
        if (Object.keys(filteredDailyStudy).length < Object.keys(dailyStudy).length) {
            const data = JSON.parse(localStorage.getItem('ce_housing_assessor') || '{}');
            data.dailyStudy = filteredDailyStudy;
            localStorage.setItem('ce_housing_assessor', JSON.stringify(data));
        }
        
        // Clean gamification daily stats
        const gamificationData = JSON.parse(localStorage.getItem('ce_housing_gamification') || '{}');
        if (gamificationData.dailyStats) {
            const filteredStats = {};
            Object.keys(gamificationData.dailyStats).forEach(date => {
                if (new Date(date) > cutoffDate) {
                    filteredStats[date] = gamificationData.dailyStats[date];
                }
            });
            gamificationData.dailyStats = filteredStats;
            localStorage.setItem('ce_housing_gamification', JSON.stringify(gamificationData));
        }
        
        return this.checkStorageStatus();
    }

    // Export data before cleanup
    exportDataForBackup() {
        const data = {};
        
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                data[key] = localStorage.getItem(key);
            }
        }
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ce-study-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Show storage usage UI
    showStorageUI() {
        const status = this.checkStorageStatus();
        const breakdown = this.getStorageBreakdown();
        
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'storageModal';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Storage Usage</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-4">
                            <h6>Overall Usage</h6>
                            <div class="progress" style="height: 30px;">
                                <div class="progress-bar ${
                                    status.status === 'critical' ? 'bg-danger' : 
                                    status.status === 'warning' ? 'bg-warning' : 'bg-success'
                                }" style="width: ${status.usagePercentage}%">
                                    ${status.usagePercentage.toFixed(1)}%
                                </div>
                            </div>
                            <small class="text-muted">
                                ${status.formattedSize} of ${status.formattedMaxSize} used
                                (${status.formattedAvailableSpace} available)
                            </small>
                        </div>
                        
                        ${status.status !== 'ok' ? `
                            <div class="alert alert-${status.status === 'critical' ? 'danger' : 'warning'}">
                                <i class="fas fa-exclamation-triangle"></i>
                                Storage is ${status.status === 'critical' ? 'critically' : 'getting'} full!
                                Consider cleaning up old data or exporting your progress.
                            </div>
                        ` : ''}
                        
                        <h6>Storage Breakdown</h6>
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Data Type</th>
                                        <th>Size</th>
                                        <th>Percentage</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${breakdown.map(item => `
                                        <tr>
                                            <td><code>${item.key}</code></td>
                                            <td>${item.formattedSize}</td>
                                            <td>
                                                <div class="progress" style="height: 15px;">
                                                    <div class="progress-bar bg-info" 
                                                         style="width: ${item.percentage}%">
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="storageMonitor.exportDataForBackup()">
                            <i class="fas fa-download"></i> Export Backup
                        </button>
                        <button type="button" class="btn btn-warning" onclick="storageMonitor.cleanOldDataWithConfirm()">
                            <i class="fas fa-broom"></i> Clean Old Data
                        </button>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }

    // Clean old data with confirmation
    cleanOldDataWithConfirm() {
        if (confirm('This will remove test history and daily stats older than 30 days. Continue?')) {
            const beforeSize = this.getStorageSize();
            const status = this.cleanOldData();
            const afterSize = this.getStorageSize();
            const saved = beforeSize - afterSize;
            
            alert(`Cleanup complete! Freed ${this.formatBytes(saved)} of space.`);
            
            // Refresh the modal
            document.getElementById('storageModal')?.querySelector('[data-bs-dismiss="modal"]')?.click();
            setTimeout(() => this.showStorageUI(), 300);
        }
    }

    // Add storage indicator to UI
    addStorageIndicator() {
        const status = this.checkStorageStatus();
        
        // Only show if usage is above warning threshold
        if (status.usagePercentage >= this.warningThreshold * 100) {
            const indicator = document.createElement('div');
            indicator.className = `alert alert-${status.status === 'critical' ? 'danger' : 'warning'} alert-dismissible fade show position-fixed bottom-0 end-0 m-3`;
            indicator.style.zIndex = '9999';
            indicator.innerHTML = `
                <strong>Storage ${status.status === 'critical' ? 'Critical' : 'Warning'}!</strong>
                ${status.formattedSize} of ${status.formattedMaxSize} used.
                <button type="button" class="btn btn-sm btn-link" onclick="storageMonitor.showStorageUI()">
                    Manage Storage
                </button>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            
            document.body.appendChild(indicator);
        }
    }
}

// Create global instance
const storageMonitor = new StorageMonitor();

// Check storage on load
document.addEventListener('DOMContentLoaded', () => {
    storageMonitor.addStorageIndicator();
});

// Make it available globally
window.StorageMonitor = StorageMonitor;
window.storageMonitor = storageMonitor;