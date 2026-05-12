(function startApp(global) {
    const { auth } = global.AppFirebase;
    const store = global.AppStore;
    const ui = global.AppUi;

    const state = {
        attendance: {},
        classes: {},
        currentDate: new Date(),
        historyClassId: "all",
        historyStudentId: "all",
        role: "teacher",
        selectedClassId: "",
        students: {},
        unsubs: []
    };

    function dateKey(date) {
        const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 10);
    }

    function thaiDate(date) {
        return date.toLocaleDateString("th-TH", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }

    function shortThaiDate(dateKey) {
        return new Date(`${dateKey}T00:00:00`).toLocaleDateString("th-TH", {
            day: "numeric",
            month: "short"
        });
    }

    function setDefaultHistoryRange() {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        document.getElementById("historyFromDate").value = dateKey(firstDay);
        document.getElementById("historyToDate").value = dateKey(now);
    }

    function applyHistoryPreset() {
        const preset = document.getElementById("historyPreset").value;
        const now = new Date();
        const from = new Date(now);

        if (preset === "custom") return;
        if (preset === "this-month") from.setDate(1);
        if (preset === "last-7") from.setDate(now.getDate() - 6);
        if (preset === "last-30") from.setDate(now.getDate() - 29);

        document.getElementById("historyFromDate").value = dateKey(from);
        document.getElementById("historyToDate").value = dateKey(now);
    }

    function getDateRange(fromKey, toKey) {
        if (!fromKey || !toKey) throw new Error("กรุณาเลือกช่วงวันที่");
        const from = new Date(`${fromKey}T00:00:00`);
        const to = new Date(`${toKey}T00:00:00`);
        if (from > to) throw new Error("วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด");

        const keys = [];
        const cursor = new Date(from);
        while (cursor <= to) {
            keys.push(dateKey(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        if (keys.length > 92) throw new Error("เลือกช่วงเวลาได้ไม่เกิน 92 วันต่อครั้ง");
        return keys;
    }

    function toArray(record) {
        return Object.entries(record || {})
            .map(([id, value]) => ({ id, ...value }))
            .filter((item) => item.active !== false)
            .sort((a, b) => (a.name || "").localeCompare(b.name || "", "th"));
    }

    function emptyCounts() {
        return { possible: 0, present: 0, absent: 0, late: 0, unmarked: 0, presentRate: 0 };
    }

    function addStatus(counts, status) {
        counts.possible += 1;
        if (status === "present") counts.present += 1;
        else if (status === "absent") counts.absent += 1;
        else if (status === "late") counts.late += 1;
        else counts.unmarked += 1;
    }

    function finalizeCounts(counts) {
        counts.presentRate = counts.possible ? Math.round((counts.present / counts.possible) * 100) : 0;
        return counts;
    }

    function cleanupSubscriptions() {
        state.unsubs.forEach((unsub) => unsub());
        state.unsubs = [];
    }

    function handleError(error) {
        console.error(error);
        ui.setAuthMessage(error.message || "เกิดข้อผิดพลาด", true);
    }

    async function loadAppData() {
        cleanupSubscriptions();

        state.unsubs.push(store.subscribeClasses((classes) => {
            state.classes = classes;
            const classIds = Object.keys(classes);
            if (!state.selectedClassId || !classes[state.selectedClassId]) {
                state.selectedClassId = classIds[0] || "";
            }
            ui.renderClasses(classes, state.selectedClassId);
            ui.renderHistoryFilters(classes, state.historyClassId, state.students, state.historyStudentId);
            subscribeClassData();
        }, handleError));
    }

    function subscribeClassData() {
        state.unsubs.splice(1).forEach((unsub) => unsub());
        if (!state.selectedClassId) return;

        state.unsubs.push(store.subscribeStudents(state.selectedClassId, (students) => {
            state.students = students;
            ui.renderStudents(students);
            if (state.historyClassId === state.selectedClassId) {
                ui.renderHistoryFilters(state.classes, state.historyClassId, students, state.historyStudentId);
            }
            renderAttendance();
        }, handleError));

        state.unsubs.push(store.subscribeAttendance(state.selectedClassId, dateKey(state.currentDate), (attendance) => {
            state.attendance = attendance;
            renderAttendance();
        }, handleError));
    }

    function renderAttendance() {
        ui.setDateLabel(thaiDate(state.currentDate));
        ui.renderAttendance(state.students, state.attendance);
    }

    function bindEvents() {
        const el = ui.getElements();

        document.querySelectorAll(".tab").forEach((tab) => {
            tab.addEventListener("click", () => ui.showSection(tab.dataset.section));
        });

        document.getElementById("signInButton").addEventListener("click", async () => {
            const email = document.getElementById("emailInput").value.trim();
            const password = document.getElementById("passwordInput").value;
            try {
                ui.setAuthMessage("กำลังเข้าสู่ระบบ...");
                await auth.signInWithEmailAndPassword(email, password);
            } catch (error) {
                handleError(error);
            }
        });

        document.getElementById("signOutButton").addEventListener("click", () => auth.signOut());

        document.getElementById("previousDateButton").addEventListener("click", () => changeDate(-1));
        document.getElementById("nextDateButton").addEventListener("click", () => changeDate(1));

        document.getElementById("historyPreset").addEventListener("change", applyHistoryPreset);

        document.getElementById("historyClassSelect").addEventListener("change", async (event) => {
            state.historyClassId = event.target.value || "all";
            state.historyStudentId = "all";

            const students = state.historyClassId === "all"
                ? {}
                : state.historyClassId === state.selectedClassId
                ? state.students
                : await store.getStudentsOnce(state.historyClassId);
            ui.renderHistoryFilters(state.classes, state.historyClassId, students, state.historyStudentId);
        });

        document.getElementById("historyStudentSelect").addEventListener("change", (event) => {
            state.historyStudentId = event.target.value || "all";
        });

        el.classSelect.addEventListener("change", () => {
            state.selectedClassId = el.classSelect.value;
            state.students = {};
            state.attendance = {};
            subscribeClassData();
        });

        document.getElementById("classForm").addEventListener("submit", async (event) => {
            event.preventDefault();
            const input = document.getElementById("newClassName");
            try {
                if (state.role !== "admin") throw new Error("บัญชีนี้ไม่มีสิทธิ์เพิ่มห้องเรียน");
                state.selectedClassId = await store.addClass(input.value);
                input.value = "";
            } catch (error) {
                alert(error.message);
            }
        });

        document.getElementById("studentForm").addEventListener("submit", async (event) => {
            event.preventDefault();
            const input = document.getElementById("newStudentName");
            try {
                if (state.role !== "admin") throw new Error("บัญชีนี้ไม่มีสิทธิ์เพิ่มนักเรียน");
                await store.addStudent(state.selectedClassId, input.value);
                input.value = "";
            } catch (error) {
                alert(error.message);
            }
        });

        document.getElementById("markAllPresentButton").addEventListener("click", async () => {
            try {
                await store.markAllPresent(state.selectedClassId, dateKey(state.currentDate), state.students);
            } catch (error) {
                alert(error.message);
            }
        });

        document.getElementById("historyForm").addEventListener("submit", async (event) => {
            event.preventDefault();
            try {
                const report = await buildAnalyticsReport();
                ui.renderAnalytics(report);
            } catch (error) {
                alert(error.message);
            }
        });

        document.body.addEventListener("click", async (event) => {
            const target = event.target.closest("[data-action]");
            if (!target) return;

            const action = target.dataset.action;
            const studentId = target.dataset.studentId;

            try {
                if (action === "set-attendance") {
                    await store.setAttendance(state.selectedClassId, dateKey(state.currentDate), studentId, target.dataset.status);
                }

                if (action === "archive-student" && confirm("นำชื่อนักเรียนคนนี้ออกจากห้อง?")) {
                    if (state.role !== "admin") throw new Error("บัญชีนี้ไม่มีสิทธิ์นำนักเรียนออก");
                    await store.archiveStudent(state.selectedClassId, studentId);
                }
            } catch (error) {
                alert(error.message);
            }
        });
    }

    function changeDate(days) {
        state.currentDate.setDate(state.currentDate.getDate() + days);
        state.attendance = {};
        subscribeClassData();
    }

    async function buildAnalyticsReport() {
        const fromKey = document.getElementById("historyFromDate").value;
        const toKey = document.getElementById("historyToDate").value;
        const dateKeys = getDateRange(fromKey, toKey);
        const historyClassId = document.getElementById("historyClassSelect").value || "all";
        const historyStudentId = document.getElementById("historyStudentSelect").value || "all";
        const classEntries = Object.entries(state.classes || {})
            .filter(([classId]) => historyClassId === "all" || classId === historyClassId)
            .sort((a, b) => (a[1].name || "").localeCompare(b[1].name || "", "th"));

        if (classEntries.length === 0) throw new Error("ยังไม่มีห้องเรียนให้สร้างรายงาน");

        const totals = emptyCounts();
        const classSummaries = [];
        let selectedClassData = null;

        for (const [classId, classInfo] of classEntries) {
            const students = await store.getStudentsOnce(classId);
            const attendanceByDate = await store.getAttendanceRange(classId, dateKeys);
            const studentList = toArray(students);
            const counts = emptyCounts();

            studentList.forEach((student) => {
                dateKeys.forEach((key) => addStatus(counts, attendanceByDate[key]?.[student.id]?.status));
            });

            finalizeCounts(counts);
            Object.keys(totals).forEach((key) => {
                if (key !== "presentRate") totals[key] += counts[key];
            });

            classSummaries.push({
                id: classId,
                name: classInfo.name || classId,
                studentCount: studentList.length,
                ...counts
            });

            if (classId === historyClassId) {
                selectedClassData = { classId, classInfo, students: studentList, attendanceByDate };
            }
        }

        finalizeCounts(totals);

        return {
            title: historyClassId === "all" ? "ภาพรวมทุกห้อง" : `ห้อง ${state.classes[historyClassId]?.name || historyClassId}`,
            rangeLabel: `${shortThaiDate(fromKey)} - ${shortThaiDate(toKey)}`,
            dateKeys,
            totals,
            classSummaries,
            matrix: selectedClassData ? buildMatrix(selectedClassData, dateKeys) : null,
            individual: selectedClassData && historyStudentId !== "all"
                ? buildIndividual(selectedClassData, dateKeys, historyStudentId)
                : null
        };
    }

    function buildMatrix(classData, dateKeys) {
        return {
            className: classData.classInfo.name || classData.classId,
            dateKeys,
            rows: classData.students.map((student) => {
                const counts = emptyCounts();
                const cells = dateKeys.map((key) => {
                    const status = classData.attendanceByDate[key]?.[student.id]?.status || "";
                    addStatus(counts, status);
                    return { status, symbol: statusSymbol(status) };
                });
                finalizeCounts(counts);
                return {
                    id: student.id,
                    name: student.name,
                    cells,
                    present: counts.present,
                    totalDays: dateKeys.length,
                    presentRate: counts.presentRate
                };
            })
        };
    }

    function buildIndividual(classData, dateKeys, studentId) {
        const student = classData.students.find((item) => item.id === studentId);
        if (!student) return null;

        const counts = emptyCounts();
        const days = dateKeys.map((key) => {
            const status = classData.attendanceByDate[key]?.[studentId]?.status || "";
            addStatus(counts, status);
            return {
                label: shortThaiDate(key),
                status,
                statusLabel: statusLabel(status)
            };
        });
        finalizeCounts(counts);

        return {
            name: student.name,
            days,
            ...counts
        };
    }

    function statusSymbol(status) {
        if (status === "present") return "✓";
        if (status === "absent") return "ข";
        if (status === "late") return "ส";
        return "-";
    }

    function statusLabel(status) {
        if (status === "present") return "มา";
        if (status === "absent") return "ไม่มา";
        if (status === "late") return "สาย";
        return "ยังไม่เช็ค";
    }

    function init() {
        bindEvents();
        setDefaultHistoryRange();

        auth.onAuthStateChanged(async (user) => {
            ui.setAuthState(user);
            cleanupSubscriptions();
            if (!user) {
                state.role = "teacher";
                ui.setRole(state.role);
                return;
            }

            try {
                ui.setRole("teacher");
                const profile = await store.getUserProfile(user.uid);
                state.role = profile.role;
                ui.setRole(state.role);
                await loadAppData();
            } catch (error) {
                handleError(error);
            }
        });
    }

    document.addEventListener("DOMContentLoaded", init);
})(window);
