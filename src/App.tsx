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
import { BulkImportModal } from './components/BulkImportModal';
import { InsertarReporteModal } from './components/InsertarReporteModal';
import { SyncIndicator } from './components/SyncIndicator';
import { InstalarApp } from './components/InstalarApp';
import { api, alPerderSesion } from './api/client';
import { dbManager } from './db/indexedDB';
import { syncManager } from './sync/syncManager';
import { 
  ActiveTab, 
  MaintenanceRecord, 
  Equipment, 
  UserProfile, 
  DatabaseStats
} from './types';

/** Perfil sin datos: el estado inicial antes de que alguien inicie sesion. */
const PERFIL_VACIO: UserProfile = {
  id: '',
  name: '',
  email: '',
  role: 'Técnico Biomédico',
  institution: '',
  avatarUrl: '',
  isLoggedIn: false
};

export default function App() {
  // Navigation & User State
  const [activeTab, setActiveTab] = useState<ActiveTab>('inicio');
  // El perfil arranca vacio: quien registra debe identificarse.
  // Ese nombre queda en cada mantenimiento, asi que no puede venir
  // quemado en el codigo.
  const [user, setUser] = useState<UserProfile>(PERFIL_VACIO);
  const [cargandoPerfil, setCargandoPerfil] = useState(true);

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
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showInsertarReporte, setShowInsertarReporte] = useState(false);

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

  /**
   * Recuperar la sesion al abrir.
   *
   * El perfil se guarda en el dispositivo para que la aplicacion arranque
   * util sin conexion: un tecnico en ronda no puede quedarse en la
   * pantalla de ingreso porque el hospital no tiene senal. Si hay red, se
   * verifica el token contra el servidor y se refresca el perfil.
   */
  useEffect(() => {
    let vigente = true;

    (async () => {
      const guardado = await dbManager.leerPreferencia<UserProfile | null>(
        'perfilUsuario',
        null
      );

      if (!api.hayToken()) {
        // Sin token no hay sesion, aunque quede un perfil viejo guardado.
        if (vigente) setCargandoPerfil(false);
        return;
      }

      // Se entra de una con lo guardado, para no hacer esperar a nadie.
      if (guardado?.name && vigente) {
        setUser({ ...guardado, isLoggedIn: true });
      }

      try {
        const perfil = await api.miPerfil();
        if (!vigente) return;
        setUser({ ...perfil, isLoggedIn: true });
        dbManager.guardarPreferencia('perfilUsuario', perfil).catch(() => {});
      } catch {
        // Sin red se sigue con lo guardado. Si el token estuviera vencido,
        // el cliente ya habria disparado el aviso de sesion perdida.
      } finally {
        if (vigente) setCargandoPerfil(false);
      }
    })();

    return () => {
      vigente = false;
    };
  }, []);

  // El servidor rechazo el token: se vuelve a la pantalla de ingreso sin
  // tocar los datos locales, que siguen ahi esperando a sincronizar.
  useEffect(() => alPerderSesion(() => {
    setUser((prev) => ({ ...prev, isLoggedIn: false }));
  }), []);

  /**
   * Atajos del icono instalado.
   *
   * Al dejar sostenido el icono en la pantalla de inicio, Android muestra
   * "Registrar mantenimiento" y "Ver seguimientos". Cada uno abre la
   * aplicacion con ?ir=... y aqui se traduce a la pestaña que toca.
   *
   * La direccion se limpia despues para que recargar no vuelva a
   * arrastrar al tecnico a la misma pestaña.
   */
  useEffect(() => {
    const destino = new URLSearchParams(window.location.search).get('ir');

    if (destino === 'registrar' || destino === 'documentos' || destino === 'inicio') {
      setActiveTab(destino as ActiveTab);
    }

    if (destino) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Initialize DB and network listeners
  useEffect(() => {
    loadDatabase();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Arranca el puente IndexedDB -> Laravel -> PostgreSQL.
    // Devuelve su propia funcion de limpieza (listeners e intervalos).
    const detenerSync = syncManager.iniciar();

    // Cada vez que la cola cambia, refrescamos la vista para que los
    // registros pasen de "pendiente" a "sincronizado" sin recargar.
    const dejarDeEscuchar = syncManager.suscribir((estado) => {
      if (estado.estado === 'inactivo' && estado.pendientes === 0) {
        loadDatabase();
      }
    });

    // El service worker es lo que hace que la aplicacion se pueda
    // instalar y que abra sin conexion. Sin el registrado, Android ni
    // siquiera ofrece el boton de instalar.
    //
    // En desarrollo se salta: con Vite el HMR y un service worker
    // guardando archivos se estorban.
    let revisarActualizacion: number | undefined;

    // El cast es el mismo que usa api/client.ts: este tsconfig no carga
    // los tipos de Vite, asi que import.meta.env no esta declarado.
    const enProduccion = Boolean((import.meta as any).env?.PROD);

    if ('serviceWorker' in navigator && enProduccion) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registro) => {
          // Cuando Luis deje la aplicacion abierta durante dias, esto le
          // trae la version nueva sin que tenga que hacer nada.
          revisarActualizacion = window.setInterval(
            () => registro.update().catch(() => {}),
            60 * 60 * 1000
          );
        })
        .catch(() => {
          // Sin service worker la aplicacion sigue funcionando: los
          // registros viven en IndexedDB, no en el cache. Solo se pierde
          // poder instalarla y abrirla sin señal.
        });
    }

    return () => {
      if (revisarActualizacion) window.clearInterval(revisarActualizacion);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      detenerSync();
      dejarDeEscuchar();
    };
  }, [loadDatabase]);

  // Handler: Add New Maintenance Record
  const handleSaveRecord = async (
    recordData: Omit<MaintenanceRecord, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    await dbManager.addRecord(recordData);
    await loadDatabase();

    // Intento inmediato de subida. Si no hay red no pasa nada: el registro
    // ya quedo en la cola y el syncManager lo reintentara solo.
    syncManager.sincronizar('registro-nuevo').catch(() => {});

    setActiveTab('documentos');
  };

  // Handler: Update Existing Maintenance Record
  const handleUpdateRecord = async (updated: MaintenanceRecord) => {
    await dbManager.updateRecord(updated);
    await loadDatabase();
    syncManager.sincronizar('registro-editado').catch(() => {});
    setSelectedRecord(updated);
  };

  // Handler: Update Status directly
  const handleUpdateStatus = async (record: MaintenanceRecord, newStatus: string) => {
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

  // Handler: borrar todos los datos del dispositivo.
  // Se avisa cuantos registros quedarian sin subir, porque esos se
  // pierden para siempre.
  const handleResetData = async () => {
    const pendientes = await dbManager.contarPendientes();

    if (pendientes > 0) {
      const seguir = window.confirm(
        `Atención: hay ${pendientes} registro(s) que todavía no se han ` +
        `subido al servidor. Si borra ahora, esos datos se pierden.\n\n` +
        `¿Desea continuar de todas formas?`
      );
      if (!seguir) return;
    }

    await dbManager.borrarTodosLosDatos();
    await loadDatabase();
    await syncManager.refrescarPendientes();
    alert('Se borraron todos los datos guardados en este dispositivo.');
  };

  // Handler: User Profile updates
  const handleUpdateUser = (updatedProfile: Partial<UserProfile>) => {
    setUser((prev) => {
      const nuevo = { ...prev, ...updatedProfile };
      dbManager.guardarPreferencia('perfilUsuario', nuevo).catch(() => {});

      // Tambien al servidor, para que sobreviva a un cambio de dispositivo.
      // Si no hay red no pasa nada: la copia local ya quedo guardada.
      api
        .actualizarPerfil({
          name: nuevo.name,
          cargo: nuevo.role,
          institucion: nuevo.institution,
        })
        .catch(() => {});

      return nuevo;
    });
  };

  /**
   * Cerrar sesion.
   *
   * Se avisa si hay registros sin subir: el token se revoca y sin sesion
   * no se puede sincronizar, asi que ese trabajo quedaria varado en el
   * dispositivo hasta que alguien vuelva a entrar.
   */
  const handleLogout = async () => {
    const pendientes = await dbManager.contarPendientes();

    if (pendientes > 0) {
      const seguir = window.confirm(
        `Hay ${pendientes} registro(s) sin subir al servidor.\n\n` +
        'Al cerrar sesión no se pierden, pero se quedan esperando en este ' +
        'dispositivo hasta que alguien vuelva a entrar.\n\n' +
        '¿Desea cerrar sesión de todas formas?'
      );
      if (!seguir) return;
    }

    await api.cerrarSesion();
    setUser((prev) => ({ ...prev, isLoggedIn: false }));
  };

  // Mientras se lee el perfil guardado no se muestra nada, para evitar
  // que la pantalla de login parpadee en cada arranque.
  if (cargandoPerfil) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // If not logged in, render login screen
  if (!user.isLoggedIn) {
    return (
      <>
        <LoginScreen
          onLogin={(perfil) => {
            setUser({ ...perfil, isLoggedIn: true });
            dbManager.guardarPreferencia('perfilUsuario', perfil).catch(() => {});
            syncManager.sincronizar('inicio-sesion').catch(() => {});
          }}
        />

        {/* Tambien desde la pantalla de ingreso: instalarla antes de
            entrar es lo mas comodo, y aqui no hay barra inferior que
            estorbe. */}
        <InstalarApp />
      </>
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
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content Body */}
      {/* En escritorio el contenido se ensancha; en el celular se queda
          en una columna comoda para el pulgar. */}
      <main className="flex-1 w-full max-w-md lg:max-w-6xl mx-auto">

        {/* Estado de sincronizacion con PostgreSQL */}
        <div className="px-4 pt-3">
          <SyncIndicator />
        </div>

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
            onOpenBulkImport={() => setShowBulkImportModal(true)}
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
            onOpenBulkImport={() => setShowBulkImportModal(true)}
            onOpenInsertarReporte={() => setShowInsertarReporte(true)}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Invitacion a instalarla en el telefono. Se muestra sola cuando
          el navegador lo permite y no esta instalada todavia. */}
      <InstalarApp />

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
          onLogout={handleLogout}
        />
      )}

      {/* MODAL: Registro masivo desde Excel */}
      {showBulkImportModal && (
        <BulkImportModal
          onClose={() => setShowBulkImportModal(false)}
          onImportado={loadDatabase}
          tecnicoPorDefecto={user.name}
        />
      )}

      {/* MODAL: Insertar un reporte olvidado (renumera los posteriores) */}
      {showInsertarReporte && (
        <InsertarReporteModal
          onClose={() => setShowInsertarReporte(false)}
          onInsertado={async () => {
            // El reporte se creo directamente en el servidor, asi que hay
            // que traerlo para que aparezca en el listado del dispositivo.
            await syncManager.sincronizar('reporte-insertado');
            await loadDatabase();
          }}
          tecnicoPorDefecto={user.name}
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
