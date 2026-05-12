(function createUi(global) {
    const STATUS_LABELS = {
        present: "มา",
        absent: "ไม่มา",
        late: "สาย"
    };

    function getElements() {
        return {
            appView: document.getElementById("appView"),
            authMessage: document.getElementById("authMessage"),
            authView: document.getElementById("authView"),
            attendanceList: document.getElementById("attendanceList"),
            absentCount: document.getElementById("absentCount"),
            classSelect: document.getElementById("classSelect"),
            currentDateLabel: document.getElementById("currentDateLabel"),
            historyList: document.getElementById("historyList"),
            lateCount: document.getElementById("lateCount"),
            presentCount: document.getElementById("presentCount"),
            studentCount: document.getElementById("studentCount"),
            studentList: document.getElementById("studentList"),
            totalCount: document.getElementById("totalCount"),
            userEmail: document.getElementById("userEmail"),
            userPanel: document.getElementById("userPanel")
        };
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function toArray(record) {
        return Object.entries(record || {})
            .map(([id, value]) => ({ id, ...value }))
            .sort((a, b) => (a.name || "").localeCompare(b.name || "", "th"));
    }

    function activeStudents(students) {
        return toArray(students).filter((student) => student.active !== false);
    }

    function setAuthState(user) {
        const el = getElements();
        el.authView.hidden = Boolean(user);
        el.appView.hidden = !user;
        el.userPanel.hidden = !user;
        el.userEmail.textContent = user ? user.email : "";
        setAuthMessage("");
    }

    function setRole(role) {
        const isAdmin = role === "admin";
        document.body.dataset.role = role || "teacher";
        document.querySelectorAll("[data-admin-only]").forEach((element) => {
            element.hidden = !isAdmin;
        });

        if (!isAdmin && document.getElementById("studentsSection").classList.contains("active")) {
            showSection("attendance");
        }
    }

    function setAuthMessage(message, isError = false) {
        const el = getElements();
        el.authMessage.textContent = message || "";
        el.authMessage.classList.toggle("error", Boolean(isError));
    }

    function showSection(sectionName) {
        document.querySelectorAll(".section").forEach((section) => {
            section.classList.toggle("active", section.id === `${sectionName}Section`);
        });
        document.querySelectorAll(".tab").forEach((tab) => {
            tab.classList.toggle("active", tab.dataset.section === sectionName);
        });
    }

    function renderClasses(classes, selectedClassId) {
        const el = getElements();
        const classList = toArray(classes);
        if (classList.length === 0) {
            el.classSelect.innerHTML = `<option value="">ยังไม่มีห้องเรียน</option>`;
            el.classSelect.value = "";
            return;
        }

        el.classSelect.innerHTML = classList
            .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
            .join("");
        el.classSelect.value = selectedClassId || classList[0]?.id || "";
    }

    function renderStudents(students) {
        const el = getElements();
        const list = activeStudents(students);
        el.studentCount.textContent = list.length;

        if (list.length === 0) {
            el.studentList.innerHTML = `<li class="empty-state">ยังไม่มีนักเรียนในห้องนี้</li>`;
            return;
        }

        el.studentList.innerHTML = list.map((student) => `
            <li class="student-item">
                <div>
                    <div class="student-name">${escapeHtml(student.name)}</div>
                    <div class="student-meta">รหัส: ${escapeHtml(student.id)}</div>
                </div>
                <button class="button button-danger" data-action="archive-student" data-student-id="${escapeHtml(student.id)}" type="button">นำออก</button>
            </li>
        `).join("");
    }

    function renderAttendance(students, attendance) {
        const el = getElements();
        const list = activeStudents(students);
        const counts = { present: 0, absent: 0, late: 0 };

        list.forEach((student) => {
            const status = attendance?.[student.id]?.status;
            if (counts[status] !== undefined) counts[status] += 1;
        });

        el.totalCount.textContent = list.length;
        el.presentCount.textContent = counts.present;
        el.absentCount.textContent = counts.absent;
        el.lateCount.textContent = counts.late;

        if (list.length === 0) {
            el.attendanceList.innerHTML = `<li class="empty-state">ยังไม่มีนักเรียนหรือยังไม่ได้เลือกห้องเรียน</li>`;
            return;
        }

        el.attendanceList.innerHTML = list.map((student) => {
            const status = attendance?.[student.id]?.status || "";
            return `
                <li class="student-item">
                    <span class="student-name">${escapeHtml(student.name)}</span>
                    <div class="status-buttons">
                        ${renderStatusButton(student.id, "present", status)}
                        ${renderStatusButton(student.id, "absent", status)}
                        ${renderStatusButton(student.id, "late", status)}
                    </div>
                </li>
            `;
        }).join("");
    }

    function renderStatusButton(studentId, value, currentStatus) {
        const active = value === currentStatus ? "active" : "";
        return `<button class="status-btn ${value} ${active}" data-action="set-attendance" data-student-id="${escapeHtml(studentId)}" data-status="${value}" type="button">${STATUS_LABELS[value]}</button>`;
    }

    function renderHistory(students, attendance, dateLabel) {
        const el = getElements();
        const list = activeStudents(students);

        if (list.length === 0) {
            el.historyList.innerHTML = `<div class="empty-state">ยังไม่มีนักเรียนในห้องนี้</div>`;
            return;
        }

        const counts = { present: 0, absent: 0, late: 0 };
        list.forEach((student) => {
            const status = attendance?.[student.id]?.status;
            if (counts[status] !== undefined) counts[status] += 1;
        });

        const rows = list.map((student) => {
            const status = attendance?.[student.id]?.status;
            const label = STATUS_LABELS[status] || "-";
            return `
                <li class="student-item">
                    <span class="student-name">${escapeHtml(student.name)}</span>
                    <span class="status-btn ${status || ""} active">${escapeHtml(label)}</span>
                </li>
            `;
        }).join("");

        el.historyList.innerHTML = `
            <div class="history-card">
                <div class="history-title">${escapeHtml(dateLabel)}</div>
                <div class="history-details">
                    <span class="history-stat"><i class="dot present"></i> มา: ${counts.present}</span>
                    <span class="history-stat"><i class="dot absent"></i> ไม่มา: ${counts.absent}</span>
                    <span class="history-stat"><i class="dot late"></i> สาย: ${counts.late}</span>
                </div>
            </div>
            <ul class="student-list">${rows}</ul>
        `;
    }

    function setDateLabel(label) {
        getElements().currentDateLabel.textContent = label;
    }

    global.AppUi = {
        getElements,
        renderAttendance,
        renderClasses,
        renderHistory,
        renderStudents,
        setAuthMessage,
        setAuthState,
        setRole,
        setDateLabel,
        showSection
    };
})(window);
