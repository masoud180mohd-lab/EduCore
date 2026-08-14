export type UiLocale = 'en' | 'sw';

export type MessageKey =
  | 'shell.menu'
  | 'shell.logout'
  | 'shell.office'
  | 'shell.closeMenu'
  | 'shell.teacherAttendance'
  | 'shell.themeLight'
  | 'shell.themeDark'
  | 'shell.language'
  | 'shell.checkingAccess'
  | 'shell.adminUnavailable'
  | 'shell.adminUnavailableBody'
  | 'shell.openParent'
  | 'shell.openTeacher'
  | 'nav.home'
  | 'nav.users'
  | 'nav.staff'
  | 'nav.memberships'
  | 'nav.organizations'
  | 'nav.students'
  | 'nav.guardians'
  | 'nav.roles'
  | 'nav.academic'
  | 'nav.attendance'
  | 'nav.exams'
  | 'nav.reportCards'
  | 'nav.fees'
  | 'nav.notifications'
  | 'nav.announcements'
  | 'nav.reports'
  | 'nav.settings'
  | 'group.home'
  | 'group.registry'
  | 'group.access'
  | 'group.academic'
  | 'group.fees'
  | 'group.communications'
  | 'group.insights'
  | 'group.settings'
  | 'hub.title'
  | 'hub.description'
  | 'hub.loadingSchool'
  | 'hub.loadingAreas'
  | 'hub.quickStarts'
  | 'hub.emptyAreas'
  | 'page.attendance.title'
  | 'page.attendance.description'
  | 'page.exams.title'
  | 'page.exams.description'
  | 'page.staff.title'
  | 'page.staff.description'
  | 'page.reportCards.title'
  | 'page.reportCards.description'
  | 'page.reportCards.soon'
  | 'page.reports.title'
  | 'page.reports.description'
  | 'page.announcements.title'
  | 'page.announcements.description'
  | 'page.announcements.soon'
  | 'common.open'
  | 'common.loading'
  | 'common.comingSoon';

const EN: Record<MessageKey, string> = {
  'shell.menu': 'Menu',
  'shell.logout': 'Log out',
  'shell.office': 'Office',
  'shell.closeMenu': 'Close menu',
  'shell.teacherAttendance': 'Teacher attendance',
  'shell.themeLight': 'Light',
  'shell.themeDark': 'Dark',
  'shell.language': 'Language',
  'shell.checkingAccess': 'Checking access…',
  'shell.adminUnavailable': 'Admin unavailable',
  'shell.adminUnavailableBody':
    'You do not have access to Admin for this school. Sign in with an admin account, or open your teacher/parent workspace.',
  'shell.openParent': 'Open parent portal',
  'shell.openTeacher': 'Open teacher workspace',
  'nav.home': 'Home',
  'nav.users': 'Users',
  'nav.staff': 'Staff',
  'nav.memberships': 'Memberships',
  'nav.organizations': 'Organizations',
  'nav.students': 'Students',
  'nav.guardians': 'Guardians',
  'nav.roles': 'Roles',
  'nav.academic': 'Academic',
  'nav.attendance': 'Attendance',
  'nav.exams': 'Exams & marks',
  'nav.reportCards': 'Report cards',
  'nav.fees': 'Fees',
  'nav.notifications': 'SMS',
  'nav.announcements': 'Announcements',
  'nav.reports': 'Reports',
  'nav.settings': 'Settings',
  'group.home': 'Home',
  'group.registry': 'Registry',
  'group.access': 'Access',
  'group.academic': 'Academic',
  'group.fees': 'Fees',
  'group.communications': 'Communications',
  'group.insights': 'Insights',
  'group.settings': 'Settings',
  'hub.title': 'Office',
  'hub.description': 'Pick a registry, fees, or settings job.',
  'hub.loadingSchool': 'Loading school…',
  'hub.loadingAreas': 'Loading admin areas…',
  'hub.quickStarts': 'Common next steps',
  'hub.emptyAreas':
    'No admin areas are available for your permissions. Ask an owner to grant access, or use Teacher / Parent from the school switcher if those roles apply.',
  'page.attendance.title': 'Attendance',
  'page.attendance.description': 'Review sessions recorded by teachers. Open a session to see marks.',
  'page.exams.title': 'Exams & marks',
  'page.exams.description': 'Exams, subject marks, and approval status across the school.',
  'page.staff.title': 'Staff & teachers',
  'page.staff.description': 'Invite staff, assign roles, and open teacher workspaces.',
  'page.reportCards.title': 'Report cards',
  'page.reportCards.description': 'Generate printable report cards from approved exam marks.',
  'page.reportCards.soon':
    'PDF report cards are not live yet. Enter and approve marks under Exams first; generation will land in a follow-up release.',
  'page.reports.title': 'Reports',
  'page.reports.description': 'Operational exports and summaries. Analytics dashboards will follow.',
  'page.announcements.title': 'Announcements',
  'page.announcements.description': 'In-app notices for staff and classes.',
  'page.announcements.soon':
    'In-app announcements are not live yet. Use SMS under Notifications for parent messages today.',
  'common.open': 'Open',
  'common.loading': 'Loading…',
  'common.comingSoon': 'Coming soon',
};

const SW: Record<MessageKey, string> = {
  'shell.menu': 'Menyu',
  'shell.logout': 'Toka',
  'shell.office': 'Ofisi',
  'shell.closeMenu': 'Funga menyu',
  'shell.teacherAttendance': 'Mahudhurio ya walimu',
  'shell.themeLight': 'Mwanga',
  'shell.themeDark': 'Giza',
  'shell.language': 'Lugha',
  'shell.checkingAccess': 'Inakagua ruhusa…',
  'shell.adminUnavailable': 'Admin haipatikani',
  'shell.adminUnavailableBody':
    'Huna ruhusa ya Admin kwa shule hii. Ingia kwa akaunti ya admin, au fungua eneo la mwalimu/mzazi.',
  'shell.openParent': 'Fungua portal ya mzazi',
  'shell.openTeacher': 'Fungua eneo la mwalimu',
  'nav.home': 'Nyumbani',
  'nav.users': 'Watumiaji',
  'nav.staff': 'Wafanyakazi',
  'nav.memberships': 'Uanachama',
  'nav.organizations': 'Mashirika',
  'nav.students': 'Wanafunzi',
  'nav.guardians': 'Walezi',
  'nav.roles': 'Majukumu',
  'nav.academic': 'Masomo',
  'nav.attendance': 'Mahudhurio',
  'nav.exams': 'Mitihani na alama',
  'nav.reportCards': 'Ripoti za matokeo',
  'nav.fees': 'Ada',
  'nav.notifications': 'SMS',
  'nav.announcements': 'Matangazo',
  'nav.reports': 'Ripoti',
  'nav.settings': 'Mipangilio',
  'group.home': 'Nyumbani',
  'group.registry': 'Daftari',
  'group.access': 'Ruhusa',
  'group.academic': 'Masomo',
  'group.fees': 'Ada',
  'group.communications': 'Mawasiliano',
  'group.insights': 'Muhtasari',
  'group.settings': 'Mipangilio',
  'hub.title': 'Ofisi',
  'hub.description': 'Chagua kazi ya daftari, ada, au mipangilio.',
  'hub.loadingSchool': 'Inapakia shule…',
  'hub.loadingAreas': 'Inapakia maeneo ya admin…',
  'hub.quickStarts': 'Hatua za kawaida',
  'hub.emptyAreas':
    'Hakuna maeneo ya admin kwa ruhusa zako. Muombe mmiliki aongeze ruhusa, au tumia Mwalimu / Mzazi ikiwa inafaa.',
  'page.attendance.title': 'Mahudhurio',
  'page.attendance.description':
    'Angalia vipindi vilivyorekodiwa na walimu. Fungua kipindi kuona alama.',
  'page.exams.title': 'Mitihani na alama',
  'page.exams.description': 'Mitihani, alama za masomo, na hali ya idhini shuleni.',
  'page.staff.title': 'Wafanyakazi na walimu',
  'page.staff.description': 'Alika wafanyakazi, weka majukumu, na fungua eneo la mwalimu.',
  'page.reportCards.title': 'Ripoti za matokeo',
  'page.reportCards.description': 'Tengeneza ripoti za matokeo kutoka alama zilizoidhinishwa.',
  'page.reportCards.soon':
    'Ripoti za PDF bado hazijapatikana. Weka na idhinisha alama chini ya Mitihani kwanza.',
  'page.reports.title': 'Ripoti',
  'page.reports.description': 'Muhtasari wa shughuli. Dashibodi ya takwimu itafuata.',
  'page.announcements.title': 'Matangazo',
  'page.announcements.description': 'Matangazo ya ndani kwa wafanyakazi na madarasa.',
  'page.announcements.soon':
    'Matangazo ya ndani bado hayajapatikana. Tumia SMS chini ya Arifa kwa wazazi leo.',
  'common.open': 'Fungua',
  'common.loading': 'Inapakia…',
  'common.comingSoon': 'Inakuja hivi karibuni',
};

export const MESSAGES: Record<UiLocale, Record<MessageKey, string>> = { en: EN, sw: SW };

export function resolveUiLocale(raw: string | null | undefined): UiLocale {
  if (raw === null || raw === undefined) return 'en';
  const lower = raw.toLowerCase();
  if (lower.startsWith('sw')) return 'sw';
  return 'en';
}

export function navMessageKey(id: string): MessageKey {
  return `nav.${id}` as MessageKey;
}

export function groupMessageKey(id: string): MessageKey {
  return `group.${id}` as MessageKey;
}
