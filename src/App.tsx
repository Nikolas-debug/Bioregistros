/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { LoginScreen } from './components/LoginScreen';
import { HomeTab } from './components/HomeTab';
import { RegisterTab } from './components/RegisterTab';
import { DocumentsTab } from './components/DocumentsTab';
import { AnnualDownloadModal } from './components/AnnualDownloadModal';
import { RecordDetailModal } from './components/RecordDetailModal';
import { EditRecordModal } from './components/EditRecordModal';
import { SettingsModal } from './components/SettingsModal';
import { NewEquipmentModal } from './components/NewEquipmentModal';
import { dbManager } from './db/indexedDB';
import { 
  ActiveTab, 
  MaintenanceRecord, 
  Equipment, 
  UserProfile, 
  DatabaseStats, 
  MaintenanceStatus 
} from './types';

export default function App() {
  // Navigation & User State
  const [activeTab, setActiveTab] = useState<ActiveTab>('inicio');
  const [user, setUser] = useState<UserProfile>({
    id: 'usr-001',
    name: 'Luis Machado',
    email: 'luis.machado@clinicadelnino.com',
    role: 'Ingeniero Biomédico Jefe',
    institution: 'Clínica del Niño',
    professionalCard: 'T.P. BIO-88942',
    avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
    isLoggedIn: true // Default logged in for immediate review, with ability to log out to test login screen
  });

  // Data state from IndexedDB
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [stats, setStats] = useState<DatabaseStats>({
    totalRecords: 0,
    preventiveCount: 0,
    correctiveCount: 0,
    otherCount: 0,
    operationalCount: 0,
    pendingPartsCount: 0,
    outOfServiceCount: 0,
    totalEquipments: 0,
    lastSyncTimestamp: Date.now()
  });

  // Offline / Network Status
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Modals state
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAnnualModal, setShowAnnualModal] = useState(false);
  const [showNewEquipmentModal, setShowNewEquipmentModal] = useState(false);

  // Load records and statistics from IndexedDB
  const loadDatabase = useCallback(async () => {
    try {
      const allRecords = await dbManager.getAllRecords();
      const allEquipments = await dbManager.getAllEquipments();
      const currentStats = await dbManager.getDatabaseStats();

      setRecords(allRecords);
      setEquipments(allEquipments);
      setStats(currentStats);
    } catch (err) {
      console.error('Error cargando IndexedDB:', err);
    }
  }, []);

  // Initialize DB and network listeners
  useEffect(() => {
    loadDatabase();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register Service Worker for offline PWA caching if supported
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('PWA Service Worker registrado con éxito:', reg.scope))
        .catch((err) => console.log('Error registrando Service Worker:', err));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadDatabase]);

  // Handler: Add New Maintenance Record
  const handleSaveRecord = async (
    recordData: Omit<MaintenanceRecord, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    await dbManager.addRecord(recordData);
    await loadDatabase();
    setActiveTab('documentos');
  };

  // Handler: Update Existing Maintenance Record
  const handleUpdateRecord = async (updated: MaintenanceRecord) => {
    await dbManager.updateRecord(updated);
    await loadDatabase();
    setSelectedRecord(updated);
  };

  // Handler: Update Status directly
  const handleUpdateStatus = async (record: MaintenanceRecord, newStatus: MaintenanceStatus) => {
    const updated = { ...record, finalStatus: newStatus };
    await dbManager.updateRecord(updated);
    await loadDatabase();
    setSelectedRecord(updated);
  };

  // Handler: Delete Record
  const handleDeleteRecord = async (id: string) => {
    await dbManager.deleteRecord(id);
    await loadDatabase();
    setSelectedRecord(null);
  };

  // Handler: Add Equipment
  const handleSaveEquipment = async (eq: Equipment) => {
    await dbManager.addEquipment(eq);
    await loadDatabase();
  };

  // Handler: Export Backup JSON
  const handleExportBackup = async () => {
    const json = await dbManager.exportBackupJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ClinicaDelNino_Backup_Biomedica_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handler: Import Backup
  const handleImportBackup = async (file: File) => {
    try {
      const text = await file.text();
      const result = await dbManager.importBackupJSON(text);
      await loadDatabase();
      alert(`¡Restauración exitosa! Se importaron ${result.recordsImported} registros y ${result.equipmentsImported} equipos a IndexedDB.`);
    } catch (e) {
      console.error(e);
      alert('El archivo no tiene el formato de respaldo válido.');
    }
  };

  // Handler: Reset Database to clinic demo
  const handleResetData = async () => {
    await dbManager.resetToDemoData();
    await loadDatabase();
    alert('Base de datos local IndexedDB restablecida con los datos clínicos.');
  };

  // Handler: User Profile updates
  const handleUpdateUser = (updatedProfile: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...updatedProfile }));
  };

  // If not logged in, render login screen
  if (!user.isLoggedIn) {
    return (
      <LoginScreen
        onLogin={(loggedUser) =>
          setUser((prev) => ({
            ...prev,
            ...loggedUser,
            isLoggedIn: true
          }))
        }
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between font-sans">
      
      {/* Top Application Header */}
      <Header
        user={user}
        onOpenSettings={() => setShowSettingsModal(true)}
        isOnline={isOnline}
        totalRecordsCount={records.length}
      />

      {/* Main Content Body */}
      <main className="flex-1 w-full max-w-md mx-auto">
        {activeTab === 'inicio' && (
          <HomeTab
            user={user}
            records={records}
            equipments={equipments}
            onNavigateTab={setActiveTab}
            onSelectRecord={(rec) => setSelectedRecord(rec)}
            onOpenAnnualModal={() => setShowAnnualModal(true)}
            onOpenNewEquipmentModal={() => setShowNewEquipmentModal(true)}
          />
        )}

        {activeTab === 'registrar' && (
          <RegisterTab
            onSaveRecord={handleSaveRecord}
            onCancel={() => setActiveTab('inicio')}
            equipments={equipments}
            technicianName={user.name}
          />
        )}

        {activeTab === 'documentos' && (
          <DocumentsTab
            records={records}
            onSelectRecord={(rec) => setSelectedRecord(rec)}
            onEditRecord={(rec) => setEditingRecord(rec)}
            onDeleteRecord={handleDeleteRecord}
            onImportBackup={handleImportBackup}
            onOpenAnnualModal={() => setShowAnnualModal(true)}
            onNewRecord={() => setActiveTab('registrar')}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* MODAL: Record Detail View */}
      {selectedRecord && (
        <RecordDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onEdit={(rec) => {
            setSelectedRecord(null);
            setEditingRecord(rec);
          }}
          onDelete={handleDeleteRecord}
          onUpdateStatus={handleUpdateStatus}
        />
      )}

      {/* MODAL: Edit Record */}
      {editingRecord && (
        <EditRecordModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSave={handleUpdateRecord}
        />
      )}

      {/* MODAL: Annual / Monthly Report Download */}
      {showAnnualModal && (
        <AnnualDownloadModal
          records={records}
          onClose={() => setShowAnnualModal(false)}
        />
      )}

      {/* MODAL: Settings & IndexedDB Database Manager */}
      {showSettingsModal && (
        <SettingsModal
          user={user}
          stats={stats}
          isOnline={isOnline}
          onClose={() => setShowSettingsModal(false)}
          onUpdateUser={handleUpdateUser}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onResetData={handleResetData}
          onLogout={() => setUser((prev) => ({ ...prev, isLoggedIn: false }))}
        />
      )}

      {/* MODAL: Quick Add Equipment to Inventory */}
      {showNewEquipmentModal && (
        <NewEquipmentModal
          onClose={() => setShowNewEquipmentModal(false)}
          onSaveEquipment={handleSaveEquipment}
        />
      )}

    </div>
  );
}
