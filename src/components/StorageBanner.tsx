import React, { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, Database, AlertTriangle } from 'lucide-react';
import { checkPersisted, requestPersist, estimateStorage } from '../utils/storageSafety';

export const StorageBanner: React.FC = () => {
  const [isPersisted, setIsPersisted] = useState<boolean>(true);
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number }>({ usage: 0, quota: 0 });
  const [showBanner, setShowBanner] = useState<boolean>(false);

  useEffect(() => {
    const checkStorage = async () => {
      const persisted = await checkPersisted();
      const estimate = await estimateStorage();
      setIsPersisted(persisted);
      setStorageInfo(estimate);

      const usageRatio = estimate.quota > 0 ? estimate.usage / estimate.quota : 0;
      if (!persisted || usageRatio > 0.85) {
        setShowBanner(true);
      }
    };
    checkStorage();
  }, []);

  const handleRequestPersist = async () => {
    const success = await requestPersist();
    setIsPersisted(success);
    if (success) {
      // Check if we still need the banner for quota
      const usageRatio = storageInfo.quota > 0 ? storageInfo.usage / storageInfo.quota : 0;
      if (usageRatio <= 0.85) {
        setShowBanner(false);
      }
    }
  };

  if (!showBanner) return null;

  const usageRatio = storageInfo.quota > 0 ? storageInfo.usage / storageInfo.quota : 0;
  const isNearlyFull = usageRatio > 0.85;

  return (
    <div className="bg-amber-50 border-b border-amber-200 p-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {isNearlyFull ? (
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        ) : (
          <ShieldAlert className="w-5 h-5 text-amber-600" />
        )}
        <div className="text-sm text-amber-900">
          {isNearlyFull ? (
            <p><strong>Storage nearly full:</strong> {(storageInfo.usage / 1024 / 1024).toFixed(1)}MB used. Please export a backup soon.</p>
          ) : (
            <p><strong>Offline storage protection:</strong> Your data might be cleared by the OS if storage is low.</p>
          )}
        </div>
      </div>
      
      {!isPersisted && (
        <button
          onClick={handleRequestPersist}
          className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Enable Protection
        </button>
      )}
      
      {isPersisted && isNearlyFull && (
        <div className="flex items-center gap-2 text-amber-700 text-xs font-medium">
          <Database className="w-3.5 h-3.5" />
          {Math.round(usageRatio * 100)}% Used
        </div>
      )}
    </div>
  );
};
