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
  | 'common.comingSoon'
  | 'common.create'
  | 'common.save'
  | 'common.saving'
  | 'common.search'
  | 'common.applyFilters'
  | 'common.allStatuses'
  | 'common.status'
  | 'common.name'
  | 'common.code'
  | 'kpi.students'
  | 'kpi.staffHint'
  | 'kpi.attendanceToday'
  | 'kpi.present'
  | 'kpi.absent'
  | 'kpi.collected'
  | 'kpi.outstanding'
  | 'kpi.overdue'
  | 'kpi.late'
  | 'kpi.excused'
  | 'kpi.loadError'
  | 'students.title'
  | 'students.description'
  | 'students.add'
  | 'students.displayName'
  | 'students.studentCode'
  | 'students.empty'
  | 'students.loadError'
  | 'students.createError'
  | 'students.searchPlaceholder'
  | 'students.back'
  | 'students.updated'
  | 'students.saveChanges'
  | 'students.enrollments'
  | 'students.noEnrollments'
  | 'students.createEnrollment'
  | 'students.fees'
  | 'students.guardians'
  | 'students.student'
  | 'students.noInvoices'
  | 'students.createInvoice'
  | 'students.noGuardians'
  | 'students.guardiansDirectory'
  | 'students.balance'
  | 'students.total'
  | 'fees.title'
  | 'fees.description'
  | 'fees.officeBanner'
  | 'fees.structures'
  | 'fees.structuresHint'
  | 'fees.invoices'
  | 'fees.invoicesHint'
  | 'fees.receipts'
  | 'fees.receiptsHint'
  | 'fees.back'
  | 'fees.invoicesTitle'
  | 'fees.invoicesDescription'
  | 'fees.createDraft'
  | 'fees.student'
  | 'fees.selectStudent'
  | 'fees.academicYear'
  | 'fees.selectYear'
  | 'fees.feeStructure'
  | 'fees.manualLine'
  | 'fees.lineDescription'
  | 'fees.amountTzs'
  | 'fees.filterInvoices'
  | 'fees.allStudents'
  | 'fees.allYears'
  | 'fees.structuresTitle'
  | 'fees.structuresDescription'
  | 'fees.createStructure'
  | 'fees.receiptsTitle'
  | 'fees.receiptsDescription'
  | 'fees.emptyInvoices'
  | 'fees.emptyStructures'
  | 'fees.emptyReceipts'
  | 'fees.receiptNumber'
  | 'fees.issued'
  | 'fees.total'
  | 'fees.balance'
  | 'fees.currency'
  | 'fees.year'
  | 'fees.addItem'
  | 'fees.itemName'
  | 'fees.itemsLegend'
  | 'fees.linesFromStructure'
  | 'fees.createDraftBtn'
  | 'reportCards.pickExam'
  | 'reportCards.empty'
  | 'reportCards.downloadPdf'
  | 'reportCards.print'
  | 'reportCards.average'
  | 'reportCards.grade'
  | 'reportCards.subject'
  | 'reportCards.score'
  | 'reportCards.max'
  | 'reportCards.percent'
  | 'reportCards.noMarks'
  | 'reportCards.class'
  | 'reportCards.exam';

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
  'common.create': 'Create',
  'common.save': 'Save',
  'common.saving': 'Saving…',
  'common.search': 'Search',
  'common.applyFilters': 'Apply filters',
  'common.allStatuses': 'All statuses',
  'common.status': 'Status',
  'common.name': 'Name',
  'common.code': 'Code',
  'kpi.students': 'Students',
  'kpi.staffHint': 'Active registry count',
  'kpi.attendanceToday': 'Attendance today',
  'kpi.present': 'Present',
  'kpi.absent': 'Absent',
  'kpi.collected': 'Fees collected',
  'kpi.outstanding': 'Outstanding',
  'kpi.overdue': 'Overdue invoices',
  'kpi.late': 'Late',
  'kpi.excused': 'Excused',
  'kpi.loadError': 'Could not load one or more dashboard figures.',
  'students.title': 'Students',
  'students.description': 'Student registry. Create and edit names, codes, and status.',
  'students.add': 'Add student',
  'students.displayName': 'Display name',
  'students.studentCode': 'Student code (optional)',
  'students.empty': 'No students yet.',
  'students.loadError': 'Could not load students.',
  'students.createError': 'Could not create student.',
  'students.searchPlaceholder': 'Name or code',
  'students.back': 'Students',
  'students.updated': 'Student updated.',
  'students.saveChanges': 'Save changes',
  'students.enrollments': 'Enrollments',
  'students.noEnrollments': 'No enrollments yet for this student.',
  'students.createEnrollment': 'Create enrollment',
  'students.fees': 'Fees',
  'students.guardians': 'Guardians',
  'students.student': 'Student',
  'students.noInvoices': 'No invoices yet for this student.',
  'students.createInvoice': 'Create invoice',
  'students.noGuardians': 'No active guardian links for this student.',
  'students.guardiansDirectory': 'Guardians directory',
  'students.balance': 'Balance',
  'students.total': 'Total',
  'fees.title': 'Fees',
  'fees.description':
    'Bursar path: structures → invoices → office payment (cash/bank/cheque) → receipts.',
  'fees.officeBanner':
    'Collect fees at the office (cash, bank, or cheque). Mobile money waits until a ClickPesa account exists (PAY-007).',
  'fees.structures': 'Fee structures',
  'fees.structuresHint': 'Named fee items by academic year',
  'fees.invoices': 'Invoices',
  'fees.invoicesHint': 'Draft, issue, void, filter, office pay',
  'fees.receipts': 'Receipts',
  'fees.receiptsHint': 'Payment receipts by number and status',
  'fees.back': 'Fees',
  'fees.invoicesTitle': 'Invoices',
  'fees.invoicesDescription': 'Draft and issued student invoices. Balance is derived (read-only).',
  'fees.createDraft': 'Create draft invoice',
  'fees.student': 'Student',
  'fees.selectStudent': 'Select student',
  'fees.academicYear': 'Academic year',
  'fees.selectYear': 'Select year',
  'fees.feeStructure': 'Fee structure (optional)',
  'fees.manualLine': 'Manual line only',
  'fees.lineDescription': 'Line description',
  'fees.amountTzs': 'Amount (TZS major)',
  'fees.filterInvoices': 'Filter invoices',
  'fees.allStudents': 'All students',
  'fees.allYears': 'All years',
  'fees.structuresTitle': 'Fee structures',
  'fees.structuresDescription': 'Named fee packages by academic year. Filter the list by year and status.',
  'fees.createStructure': 'Create structure',
  'fees.receiptsTitle': 'Receipts',
  'fees.receiptsDescription': 'Issued after succeeded office payments.',
  'fees.emptyInvoices': 'No invoices yet.',
  'fees.emptyStructures': 'No fee structures yet.',
  'fees.emptyReceipts': 'No receipts yet.',
  'fees.receiptNumber': 'Receipt #',
  'fees.issued': 'Issued',
  'fees.total': 'Total',
  'fees.balance': 'Balance',
  'fees.currency': 'Currency',
  'fees.year': 'Year',
  'fees.addItem': 'Add item',
  'fees.itemName': 'Item name',
  'fees.itemsLegend': 'Items (TZS major)',
  'fees.linesFromStructure': 'Lines will be copied from the selected structure items.',
  'fees.createDraftBtn': 'Create draft',
  'reportCards.pickExam': 'Select an exam with approved marks',
  'reportCards.empty': 'No report cards for this exam yet. Approve subject marks first.',
  'reportCards.downloadPdf': 'Download PDF',
  'reportCards.print': 'Print',
  'reportCards.average': 'Average',
  'reportCards.grade': 'Grade',
  'reportCards.subject': 'Subject',
  'reportCards.score': 'Score',
  'reportCards.max': 'Max',
  'reportCards.percent': '%',
  'reportCards.noMarks': 'No marks found for this student.',
  'reportCards.class': 'Class',
  'reportCards.exam': 'Exam',
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
  'common.create': 'Unda',
  'common.save': 'Hifadhi',
  'common.saving': 'Inahifadhi…',
  'common.search': 'Tafuta',
  'common.applyFilters': 'Tumia vichujio',
  'common.allStatuses': 'Hali zote',
  'common.status': 'Hali',
  'common.name': 'Jina',
  'common.code': 'Nambari',
  'kpi.students': 'Wanafunzi',
  'kpi.staffHint': 'Idadi katika daftari',
  'kpi.attendanceToday': 'Mahudhurio leo',
  'kpi.present': 'Waliopo',
  'kpi.absent': 'Wasiohudhuria',
  'kpi.collected': 'Ada zilizokusanywa',
  'kpi.outstanding': 'Deni',
  'kpi.overdue': 'Ankara zilizochelewa',
  'kpi.late': 'Waliochelewa',
  'kpi.excused': 'Waliokosa kwa ruhusa',
  'kpi.loadError': 'Imeshindikana kupakia baadhi ya takwimu za dashibodi.',
  'students.title': 'Wanafunzi',
  'students.description': 'Daftari la wanafunzi. Unda na hariri majina, nambari, na hali.',
  'students.add': 'Ongeza mwanafunzi',
  'students.displayName': 'Jina la kuonyesha',
  'students.studentCode': 'Nambari ya mwanafunzi (si lazima)',
  'students.empty': 'Hakuna wanafunzi bado.',
  'students.loadError': 'Imeshindikana kupakia wanafunzi.',
  'students.createError': 'Imeshindikana kuunda mwanafunzi.',
  'students.searchPlaceholder': 'Jina au nambari',
  'students.back': 'Wanafunzi',
  'students.updated': 'Mwanafunzi amesasishwa.',
  'students.saveChanges': 'Hifadhi mabadiliko',
  'students.enrollments': 'Usajili wa madarasa',
  'students.noEnrollments': 'Hakuna usajili bado kwa mwanafunzi huyu.',
  'students.createEnrollment': 'Unda usajili',
  'students.fees': 'Ada',
  'students.guardians': 'Walezi',
  'students.student': 'Mwanafunzi',
  'students.noInvoices': 'Hakuna ankara bado kwa mwanafunzi huyu.',
  'students.createInvoice': 'Unda ankara',
  'students.noGuardians': 'Hakuna walezi waliohusishwa na mwanafunzi huyu.',
  'students.guardiansDirectory': 'Orodha ya walezi',
  'students.balance': 'Salio',
  'students.total': 'Jumla',
  'fees.title': 'Ada',
  'fees.description':
    'Njia ya mhasibu: miundo → ankara → malipo ofisini (pesa taslimu/benki/hundi) → risiti.',
  'fees.officeBanner':
    'Kusanya ada ofisini (pesa taslimu, benki, au hundi). Simu-pesa itakuja baada ya akaunti ya ClickPesa (PAY-007).',
  'fees.structures': 'Miundo ya ada',
  'fees.structuresHint': 'Vipengele vya ada kwa mwaka wa masomo',
  'fees.invoices': 'Ankara',
  'fees.invoicesHint': 'Andika rasimu, toa, batilisha, chuja, lipa ofisini',
  'fees.receipts': 'Risiti',
  'fees.receiptsHint': 'Risiti kwa nambari na hali',
  'fees.back': 'Ada',
  'fees.invoicesTitle': 'Ankara',
  'fees.invoicesDescription': 'Ankara za rasimu na zilizotolewa. Salio linatokana na mahesabu (soma tu).',
  'fees.createDraft': 'Unda rasimu ya ankara',
  'fees.student': 'Mwanafunzi',
  'fees.selectStudent': 'Chagua mwanafunzi',
  'fees.academicYear': 'Mwaka wa masomo',
  'fees.selectYear': 'Chagua mwaka',
  'fees.feeStructure': 'Muundo wa ada (si lazima)',
  'fees.manualLine': 'Mstari wa mkono tu',
  'fees.lineDescription': 'Maelezo ya mstari',
  'fees.amountTzs': 'Kiasi (TZS)',
  'fees.filterInvoices': 'Chuja ankara',
  'fees.allStudents': 'Wanafunzi wote',
  'fees.allYears': 'Miaka yote',
  'fees.structuresTitle': 'Miundo ya ada',
  'fees.structuresDescription': 'Vifurushi vya ada kwa mwaka. Chuja orodha kwa mwaka na hali.',
  'fees.createStructure': 'Unda muundo',
  'fees.receiptsTitle': 'Risiti',
  'fees.receiptsDescription': 'Hutolewa baada ya malipo ya ofisi kufanikiwa.',
  'fees.emptyInvoices': 'Hakuna ankara bado.',
  'fees.emptyStructures': 'Hakuna miundo ya ada bado.',
  'fees.emptyReceipts': 'Hakuna risiti bado.',
  'fees.receiptNumber': 'Namba ya risiti',
  'fees.issued': 'Imetolewa',
  'fees.total': 'Jumla',
  'fees.balance': 'Salio',
  'fees.currency': 'Sarafu',
  'fees.year': 'Mwaka',
  'fees.addItem': 'Ongeza kipengele',
  'fees.itemName': 'Jina la kipengele',
  'fees.itemsLegend': 'Vipengele (TZS)',
  'fees.linesFromStructure': 'Mistari itanakiliwa kutoka vipengele vya muundo uliochaguliwa.',
  'fees.createDraftBtn': 'Unda rasimu',
  'reportCards.pickExam': 'Chagua mtihani wenye alama zilizoidhinishwa',
  'reportCards.empty': 'Hakuna ripoti kwa mtihani huu bado. Idhinisha alama za masomo kwanza.',
  'reportCards.downloadPdf': 'Pakua PDF',
  'reportCards.print': 'Chapisha',
  'reportCards.average': 'Wastani',
  'reportCards.grade': 'Daraja',
  'reportCards.subject': 'Somo',
  'reportCards.score': 'Alama',
  'reportCards.max': 'Upeo',
  'reportCards.percent': '%',
  'reportCards.noMarks': 'Hakuna alama kwa mwanafunzi huyu.',
  'reportCards.class': 'Darasa',
  'reportCards.exam': 'Mtihani',
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
