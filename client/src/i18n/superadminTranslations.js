/** Super Admin UI translations (EN / FR / ES) */

const permsShared = {
  keys: {
    dashboard: { en: 'Dashboard', fr: 'Tableau de bord', es: 'Panel' },
    analytics: { en: 'Analytics', fr: 'Analytique', es: 'Analítica' },
    fleet: { en: 'Fleet', fr: 'Flotte', es: 'Flota' },
    bookings: { en: 'Bookings', fr: 'Réservations', es: 'Reservas' },
    customers: { en: 'Customers', fr: 'Clients', es: 'Clientes' },
    locations: { en: 'Locations', fr: 'Lieux', es: 'Ubicaciones' },
    calendar: { en: 'Calendar', fr: 'Calendrier', es: 'Calendario' },
    maintenance: { en: 'Maintenance', fr: 'Maintenance', es: 'Mantenimiento' },
    reports: { en: 'Reports', fr: 'Rapports', es: 'Informes' },
    audit: { en: 'Audit log', fr: 'Journal d’audit', es: 'Registro de auditoría' },
    contracts: { en: 'Contracts & invoices', fr: 'Contrats & factures', es: 'Contratos y facturas' },
    templates: { en: 'Export templates', fr: 'Modèles d’export', es: 'Plantillas de exportación' },
  },
  desc: {
    dashboard: {
      en: 'Overview metrics and ops dashboard',
      fr: 'Indicateurs et tableau de bord opérationnel',
      es: 'Métricas y panel operativo',
    },
    analytics: {
      en: 'Revenue analytics and charts',
      fr: 'Analytique de revenus et graphiques',
      es: 'Analítica de ingresos y gráficos',
    },
    fleet: {
      en: 'Vehicles, catalog order, and fleet assets',
      fr: 'Véhicules, ordre du catalogue et actifs',
      es: 'Vehículos, orden del catálogo y activos',
    },
    bookings: {
      en: 'Reservations, walk-in, and booking workflow',
      fr: 'Réservations, sur place et workflow',
      es: 'Reservas, presencial y flujo de trabajo',
    },
    customers: {
      en: 'CRM customers, notes, and ratings',
      fr: 'Clients CRM, notes et évaluations',
      es: 'Clientes CRM, notas y valoraciones',
    },
    locations: {
      en: 'Pickup and delivery locations',
      fr: 'Lieux de prise en charge et livraison',
      es: 'Ubicaciones de recogida y entrega',
    },
    calendar: {
      en: 'Booking calendar view',
      fr: 'Vue calendrier des réservations',
      es: 'Vista de calendario de reservas',
    },
    maintenance: {
      en: 'Maintenance records and fleet health',
      fr: 'Maintenance et santé de la flotte',
      es: 'Mantenimiento y estado de la flota',
    },
    reports: {
      en: 'Business reports and exports',
      fr: 'Rapports métier et exports',
      es: 'Informes de negocio y exportaciones',
    },
    audit: {
      en: 'Security and activity audit trail',
      fr: 'Journal de sécurité et d’activité',
      es: 'Registro de seguridad y actividad',
    },
    contracts: {
      en: 'Contracts, invoices, and PDF documents',
      fr: 'Contrats, factures et documents PDF',
      es: 'Contratos, facturas y documentos PDF',
    },
    templates: {
      en: 'Document templates, logos, and stamps',
      fr: 'Modèles de documents, logos et tampons',
      es: 'Plantillas, logos y sellos',
    },
  },
}

const buildPerms = (lang) => ({
  title: { en: 'Access control', fr: 'Contrôle d’accès', es: 'Control de acceso' }[lang],
  subtitle: {
    en: 'Grant module access for this admin. Empty selection = full access. Capability chips are informational — they describe what each module unlocks.',
    fr: 'Accordez l’accès aux modules. Sélection vide = accès complet. Les pastilles d’actions sont informatives.',
    es: 'Conceda acceso por módulo. Selección vacía = acceso completo. Los chips de acciones son informativos.',
  }[lang],
  hubTitle: { en: 'Admin permissions', fr: 'Permissions admin', es: 'Permisos de admin' }[lang],
  hubSubtitle: {
    en: 'Search admins, compare access, and edit the permission matrix without changing roles or auth rules.',
    fr: 'Recherchez des admins, comparez les accès et modifiez la matrice sans changer les rôles.',
    es: 'Busque admins, compare accesos y edite la matriz sin cambiar roles.',
  }[lang],
  editing: {
    en: 'Editing: {{name}}',
    fr: 'Modification : {{name}}',
    es: 'Editando: {{name}}',
  }[lang],
  unsaved: { en: 'Unsaved changes', fr: 'Modifications non enregistrées', es: 'Cambios sin guardar' }[lang],
  summaryFull: { en: 'Full access (all modules)', fr: 'Accès complet (tous les modules)', es: 'Acceso completo (todos los módulos)' }[lang],
  summaryRestricted: {
    en: '{{granted}} of {{total}} modules',
    fr: '{{granted}} modules sur {{total}}',
    es: '{{granted}} de {{total}} módulos',
  }[lang],
  lastUpdated: { en: 'Record updated {{date}}', fr: 'Fiche mise à jour {{date}}', es: 'Registro actualizado {{date}}' }[lang],
  modeFull: { en: 'Full access', fr: 'Accès complet', es: 'Acceso completo' }[lang],
  modeRestricted: { en: 'Restricted', fr: 'Restreint', es: 'Restringido' }[lang],
  selectAll: { en: 'Select all modules', fr: 'Tout sélectionner', es: 'Seleccionar todos' }[lang],
  clearFull: { en: 'Clear → full access', fr: 'Vider → accès complet', es: 'Vaciar → acceso completo' }[lang],
  revert: { en: 'Revert changes', fr: 'Annuler les changements', es: 'Revertir cambios' }[lang],
  searchPerms: { en: 'Filter permissions', fr: 'Filtrer les permissions', es: 'Filtrar permisos' }[lang],
  searchPermsPlaceholder: {
    en: 'Search modules…',
    fr: 'Rechercher un module…',
    es: 'Buscar módulos…',
  }[lang],
  copyFrom: { en: 'Copy from admin', fr: 'Copier depuis un admin', es: 'Copiar de un admin' }[lang],
  copyFromPlaceholder: { en: 'Choose admin…', fr: 'Choisir un admin…', es: 'Elegir admin…' }[lang],
  copy: { en: 'Copy', fr: 'Copier', es: 'Copiar' }[lang],
  compareWith: { en: 'Compare with', fr: 'Comparer avec', es: 'Comparar con' }[lang],
  comparePlaceholder: { en: 'No comparison', fr: 'Pas de comparaison', es: 'Sin comparación' }[lang],
  compareTitle: {
    en: 'Diff vs {{name}} (peer relative to draft)',
    fr: 'Écart vs {{name}} (par rapport au brouillon)',
    es: 'Diff vs {{name}} (respecto al borrador)',
  }[lang],
  comparePeerSummary: {
    en: 'Peer access: {{summary}}',
    fr: 'Accès de l’autre admin : {{summary}}',
    es: 'Acceso del otro admin: {{summary}}',
  }[lang],
  sessionNote: {
    en: 'Saving permissions revokes this admin’s active sessions (they must sign in again).',
    fr: 'Enregistrer révoque les sessions actives de cet admin (reconnexion requise).',
    es: 'Guardar revoca las sesiones activas de este admin (debe volver a iniciar sesión).',
  }[lang],
  noMatch: { en: 'No permissions match your filter.', fr: 'Aucune permission ne correspond.', es: 'Ningún permiso coincide.' }[lang],
  colModule: { en: 'Module', fr: 'Module', es: 'Módulo' }[lang],
  colAccess: { en: 'Access', fr: 'Accès', es: 'Acceso' }[lang],
  selectModule: { en: 'Select module', fr: 'Sélectionner le module', es: 'Seleccionar módulo' }[lang],
  clearModule: { en: 'Clear module', fr: 'Vider le module', es: 'Vaciar módulo' }[lang],
  resetModule: { en: 'Reset module', fr: 'Réinitialiser', es: 'Restablecer' }[lang],
  partial: { en: 'Partial', fr: 'Partiel', es: 'Parcial' }[lang],
  sensitive: { en: 'Sensitive', fr: 'Sensible', es: 'Sensible' }[lang],
  dirtyHint: {
    en: 'You have unsaved permission changes.',
    fr: 'Vous avez des modifications non enregistrées.',
    es: 'Hay cambios de permisos sin guardar.',
  }[lang],
  cleanHint: {
    en: 'Permissions match the saved profile.',
    fr: 'Les permissions correspondent au profil enregistré.',
    es: 'Los permisos coinciden con el perfil guardado.',
  }[lang],
  cancel: { en: 'Cancel', fr: 'Annuler', es: 'Cancelar' }[lang],
  save: { en: 'Save permissions', fr: 'Enregistrer', es: 'Guardar permisos' }[lang],
  saving: { en: 'Saving…', fr: 'Enregistrement…', es: 'Guardando…' }[lang],
  saveSuccess: {
    en: 'Permissions updated',
    fr: 'Permissions mises à jour',
    es: 'Permisos actualizados',
  }[lang],
  confirmSave: {
    en: 'Save permission changes? The admin will be signed out of active sessions.',
    fr: 'Enregistrer les permissions ? L’admin sera déconnecté des sessions actives.',
    es: '¿Guardar permisos? El admin cerrará sesiones activas.',
  }[lang],
  confirmSensitive: {
    en: 'You are changing sensitive access (contracts, templates, reports, or audit). Continue and revoke active sessions?',
    fr: 'Vous modifiez un accès sensible (contrats, modèles, rapports ou audit). Continuer et révoquer les sessions ?',
    es: 'Está cambiando acceso sensible (contratos, plantillas, informes o auditoría). ¿Continuar y revocar sesiones?',
  }[lang],
  badgeFull: { en: 'Full access', fr: 'Accès complet', es: 'Acceso completo' }[lang],
  badgeCount: { en: '{{granted}}/{{total}}', fr: '{{granted}}/{{total}}', es: '{{granted}}/{{total}}' }[lang],
  loading: { en: 'Loading permissions…', fr: 'Chargement des permissions…', es: 'Cargando permisos…' }[lang],
  retry: { en: 'Retry', fr: 'Réessayer', es: 'Reintentar' }[lang],
  searchAdmins: {
    en: 'Search admins by name, email, agency…',
    fr: 'Rechercher par nom, e-mail, agence…',
    es: 'Buscar por nombre, correo, agencia…',
  }[lang],
  filterAccessAll: { en: 'All access types', fr: 'Tous les accès', es: 'Todos los accesos' }[lang],
  filterAccessFull: { en: 'Full access only', fr: 'Accès complet seul', es: 'Solo acceso completo' }[lang],
  filterAccessRestricted: { en: 'Restricted only', fr: 'Restreint seul', es: 'Solo restringido' }[lang],
  filterStatusAll: { en: 'All statuses', fr: 'Tous les statuts', es: 'Todos los estados' }[lang],
  filterStatusActive: { en: 'Active', fr: 'Actif', es: 'Activo' }[lang],
  filterStatusSuspended: { en: 'Suspended', fr: 'Suspendu', es: 'Suspendido' }[lang],
  filterStatusDisabled: { en: 'Disabled', fr: 'Désactivé', es: 'Deshabilitado' }[lang],
  noAdmins: { en: 'No admins match filters.', fr: 'Aucun admin ne correspond.', es: 'Ningún admin coincide.' }[lang],
  adminCount: {
    en: 'Showing {{count}} of {{total}}',
    fr: '{{count}} sur {{total}}',
    es: 'Mostrando {{count}} de {{total}}',
  }[lang],
  openProfile: { en: 'Open admin profile →', fr: 'Ouvrir le profil admin →', es: 'Abrir perfil del admin →' }[lang],
  selectAdmin: {
    en: 'Select an admin to edit permissions.',
    fr: 'Sélectionnez un admin pour modifier les permissions.',
    es: 'Seleccione un admin para editar permisos.',
  }[lang],
  nav: { en: 'Permissions', fr: 'Permissions', es: 'Permisos' }[lang],
  groups: {
    overview: { en: 'Overview', fr: 'Vue d’ensemble', es: 'Resumen' }[lang],
    bookings: { en: 'Bookings', fr: 'Réservations', es: 'Reservas' }[lang],
    fleet: { en: 'Fleet', fr: 'Flotte', es: 'Flota' }[lang],
    documents: { en: 'Documents', fr: 'Documents', es: 'Documentos' }[lang],
    reporting: { en: 'Reporting & system', fr: 'Rapports & système', es: 'Informes y sistema' }[lang],
  },
  actions: {
    view: { en: 'View', fr: 'Voir', es: 'Ver' }[lang],
    create: { en: 'Create', fr: 'Créer', es: 'Crear' }[lang],
    edit: { en: 'Edit', fr: 'Modifier', es: 'Editar' }[lang],
    delete: { en: 'Delete', fr: 'Supprimer', es: 'Eliminar' }[lang],
    manage: { en: 'Manage', fr: 'Gérer', es: 'Gestionar' }[lang],
    export: { en: 'Export', fr: 'Exporter', es: 'Exportar' }[lang],
  },
  keys: Object.fromEntries(Object.entries(permsShared.keys).map(([k, v]) => [k, v[lang]])),
  desc: Object.fromEntries(Object.entries(permsShared.desc).map(([k, v]) => [k, v[lang]])),
})

export const superadminEn = {
  perms: buildPerms('en'),
}

export const superadminFr = {
  perms: buildPerms('fr'),
}

export const superadminEs = {
  perms: buildPerms('es'),
}
