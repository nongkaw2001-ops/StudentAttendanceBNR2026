(function createStore(global) {
    const { db } = global.AppFirebase;
    const ROOT = "schools/bnr2026";

    function sanitizeClassId(name) {
        return name
            .trim()
            .toLowerCase()
            .replace(/[.#$\[\]/]/g, "-")
            .replace(/\s+/g, "-")
            .slice(0, 60);
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function normalizeSnapshot(snapshot) {
        return snapshot.val() || {};
    }

    const paths = {
        classes: () => `${ROOT}/classes`,
        classItem: (classId) => `${ROOT}/classes/${classId}`,
        students: (classId) => `${ROOT}/classes/${classId}/students`,
        student: (classId, studentId) => `${ROOT}/classes/${classId}/students/${studentId}`,
        attendance: (classId, dateKey) => `${ROOT}/classes/${classId}/attendance/${dateKey}`,
        attendanceItem: (classId, dateKey, studentId) => `${ROOT}/classes/${classId}/attendance/${dateKey}/${studentId}`,
        user: (uid) => `${ROOT}/users/${uid}`
    };

    async function getUserProfile(uid) {
        const snapshot = await db.ref(paths.user(uid)).once("value");
        const profile = normalizeSnapshot(snapshot);
        return {
            role: profile.role === "admin" ? "admin" : "teacher",
            displayName: profile.displayName || ""
        };
    }

    async function addClass(name) {
        const trimmed = name.trim();
        if (!trimmed) throw new Error("กรุณากรอกชื่อห้องเรียน");

        const id = sanitizeClassId(trimmed) || `class-${Date.now()}`;
        await db.ref(paths.classItem(id)).update({
            name: trimmed,
            createdAt: nowIso(),
            updatedAt: nowIso()
        });
        return id;
    }

    function subscribeClasses(callback, onError) {
        const ref = db.ref(paths.classes());
        ref.on("value", (snapshot) => callback(normalizeSnapshot(snapshot)), onError);
        return () => ref.off();
    }

    function subscribeStudents(classId, callback, onError) {
        if (!classId) return () => {};
        const ref = db.ref(paths.students(classId));
        ref.on("value", (snapshot) => callback(normalizeSnapshot(snapshot)), onError);
        return () => ref.off();
    }

    function subscribeAttendance(classId, dateKey, callback, onError) {
        if (!classId || !dateKey) return () => {};
        const ref = db.ref(paths.attendance(classId, dateKey));
        ref.on("value", (snapshot) => callback(normalizeSnapshot(snapshot)), onError);
        return () => ref.off();
    }

    async function addStudent(classId, name) {
        const trimmed = name.trim();
        if (!classId) throw new Error("กรุณาเลือกห้องเรียน");
        if (!trimmed) throw new Error("กรุณากรอกชื่อนักเรียน");

        const ref = db.ref(paths.students(classId)).push();
        await ref.set({
            name: trimmed,
            active: true,
            createdAt: nowIso(),
            updatedAt: nowIso()
        });
    }

    async function archiveStudent(classId, studentId) {
        await db.ref(paths.student(classId, studentId)).update({
            active: false,
            archivedAt: nowIso(),
            updatedAt: nowIso()
        });
    }

    async function setAttendance(classId, dateKey, studentId, status) {
        await db.ref(paths.attendanceItem(classId, dateKey, studentId)).set({
            status,
            updatedAt: nowIso()
        });
    }

    async function markAllPresent(classId, dateKey, students) {
        const updates = {};
        Object.keys(students).forEach((studentId) => {
            if (students[studentId].active === false) return;
            updates[`${studentId}/status`] = "present";
            updates[`${studentId}/updatedAt`] = nowIso();
        });
        await db.ref(paths.attendance(classId, dateKey)).update(updates);
    }

    global.AppStore = {
        addClass,
        addStudent,
        archiveStudent,
        getUserProfile,
        markAllPresent,
        setAttendance,
        subscribeAttendance,
        subscribeClasses,
        subscribeStudents
    };
})(window);
