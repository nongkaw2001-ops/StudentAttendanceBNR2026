(function startApp(global) {
    const { auth } = global.AppFirebase;
    const store = global.AppStore;
    const ui = global.AppUi;

    const state = {
        attendance: {},
        classes: {},
        currentDate: new Date(),
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
            subscribeClassData();
        }, handleError));
    }

    function subscribeClassData() {
        state.unsubs.splice(1).forEach((unsub) => unsub());
        if (!state.selectedClassId) return;

        state.unsubs.push(store.subscribeStudents(state.selectedClassId, (students) => {
            state.students = students;
            ui.renderStudents(students);
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
            const input = document.getElementById("historyDate");
            const selectedDate = new Date(`${input.value}T00:00:00`);
            const ref = global.AppFirebase.db.ref(`schools/bnr2026/classes/${state.selectedClassId}/attendance/${input.value}`);
            const snapshot = await ref.once("value");
            ui.renderHistory(state.students, snapshot.val() || {}, thaiDate(selectedDate));
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

    function init() {
        bindEvents();
        document.getElementById("historyDate").value = dateKey(new Date());

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
