// User Roles
export var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["MANAGER"] = "manager";
})(UserRole || (UserRole = {}));
/**
 * Map Appwrite / spreadsheet / UI role values to `UserRole` so `isAdmin` checks stay reliable.
 */
export function normalizeUserRole(raw) {
    const coerced = raw != null && typeof raw === 'object'
        ? (raw.slug ?? raw.key ?? raw.name ?? raw.label ?? raw.$id ?? '')
        : raw;
    const s = String(coerced ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
    if (s === UserRole.ADMIN || s === 'administrator' || s === 'super_admin' || s === 'superadmin' || s === 'sysadmin') {
        return UserRole.ADMIN;
    }
    if (s === UserRole.MANAGER || s === 'mgr' || s === 'senior_manager' || s === 'seniormanager' || s === 'coordinator') {
        return UserRole.MANAGER;
    }
    return UserRole.ADMIN;
}
// User Status
export var UserStatus;
(function (UserStatus) {
    UserStatus["ACTIVE"] = "active";
    UserStatus["INACTIVE"] = "inactive";
})(UserStatus || (UserStatus = {}));
// Trainee Status
export var TraineeStatus;
(function (TraineeStatus) {
    TraineeStatus["ENROLLED"] = "enrolled";
    TraineeStatus["IN_PROGRESS"] = "in_progress";
    TraineeStatus["COMPLETED"] = "completed";
    TraineeStatus["DROPPED"] = "dropped";
})(TraineeStatus || (TraineeStatus = {}));
// Trainer Role
export var TrainerRole;
(function (TrainerRole) {
    TrainerRole["TRAINER"] = "trainer";
    TrainerRole["SENIOR_TRAINER"] = "senior_trainer";
})(TrainerRole || (TrainerRole = {}));
// Program Status
export var ProgramStatus;
(function (ProgramStatus) {
    ProgramStatus["UPCOMING"] = "upcoming";
    ProgramStatus["ONGOING"] = "ongoing";
    ProgramStatus["COMPLETED"] = "completed";
})(ProgramStatus || (ProgramStatus = {}));
// Gender
export var Gender;
(function (Gender) {
    Gender["MALE"] = "M";
    Gender["FEMALE"] = "F";
    Gender["OTHER"] = "Other";
})(Gender || (Gender = {}));
