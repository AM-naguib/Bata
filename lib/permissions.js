'use strict';
// DENY-BY-DEFAULT authorization policy for future DB-backed API middleware.
// Input principal MUST come from a verified server-side session, NEVER from request JSON.
// isAssignedToCourse MUST consult an active lecturer_courses row in PostgreSQL.
const OWN = ['profile.read.self', 'profile.update.self', 'profile.password.change.self', 'session.logout'];
const ADMIN = [
  'lecturer.create', 'lecturer.list',
  'course.catalog.list', 'assignment.list', 'assignment.grant', 'assignment.revoke'
];
const LECTURER = [
  'course.assigned.list',
  'lecture.create', 'lecture.read', 'lecture.close', 'lecture.open',
  'lecture.archive', 'lecture.restore',
  'attendance.read', 'attendance.export', 'attendance.record.correct',
  'enrollment.list', 'enrollment.add', 'enrollment.remove',
  'device.reset.course'
];
const COURSED = new Set(LECTURER.filter(x => !['course.assigned.list'].includes(x)));
const SELF = new Set(OWN.filter(x => x.startsWith('profile.')));
const ALLOWED = Object.freeze({
  superadmin: new Set([...OWN, ...ADMIN]),
  lecturer: new Set([...OWN, ...LECTURER])
});
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const reject = (status, reason) => Object.freeze({allowed: false, status, reason});
const ALLOW = Object.freeze({allowed: true, status: 200});

function allowsRole(role, action) {
  return Boolean(ALLOWED[role] && ALLOWED[role].has(action));
}

async function authorize({
  principal, action, courseId, targetUserId, isAssignedToCourse
} = {}) {
  if (!principal || typeof principal.id !== 'string') return reject(401, 'AUTH_REQUIRED');
  if (principal.disabled_at || principal.disabledAt) return reject(403, 'ACCOUNT_DISABLED');
  if (!allowsRole(principal.role, action)) return reject(403, 'FORBIDDEN');
  if (principal.must_change_password || principal.mustChangePassword) {
    if (!['profile.password.change.self', 'session.logout'].includes(action)) {
      return reject(403, 'PASSWORD_CHANGE_REQUIRED');
    }
  }
  if (SELF.has(action) && targetUserId !== principal.id) return reject(403, 'SELF_ONLY');
  if (COURSED.has(action)) {
    if (principal.role !== 'lecturer') return reject(403, 'LECTURER_ONLY');
    if (typeof courseId !== 'string' || !UUID.test(courseId)) return reject(403, 'COURSE_REQUIRED');
    // No caller-supplied assignment flags: only server-side DB query can authorize.
    if (typeof isAssignedToCourse !== 'function') return reject(403, 'DB_ASSIGNMENT_REQUIRED');
    try {
      const assigned = await isAssignedToCourse(principal.id, courseId);
      if (assigned !== true) return reject(403, 'COURSE_NOT_ASSIGNED');
    } catch {
      return reject(503, 'AUTHORIZATION_STORE_UNAVAILABLE'); // fail closed
    }
  }
  return ALLOW;
}

module.exports = { allowsRole, authorize, ADMIN, LECTURER };
